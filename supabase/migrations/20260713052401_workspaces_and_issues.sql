-- Core schema: workspaces, projects, issues, labels, comments, activity.
--
-- ---------------------------------------------------------------------------
-- HOW MULTI-TENANCY WORKS HERE — read this before changing any policy.
-- ---------------------------------------------------------------------------
-- Every tenant-scoped table carries `workspace_id` directly, even where it could
-- be derived by joining (a comment's workspace is knowable via its issue, for
-- example). That denormalisation is deliberate: it lets every RLS policy be a
-- single membership check against the row's own column instead of a join, which
-- keeps policies short enough to read and fast enough to run.
--
-- Membership is answered by `private.is_workspace_member()`. It has to be
-- SECURITY DEFINER because the policy on `workspace_members` would otherwise
-- need to read `workspace_members`, which recurses forever.
--
-- NOTE — this departs from the Supabase Postgres skill, deliberately. That skill
-- shows the helper with EXECUTE revoked from `authenticated`. Tested against this
-- database, that does not work: RLS policy expressions are evaluated as the
-- *calling* role, so revoking EXECUTE makes every query fail with
-- "permission denied for function". The helper must be executable by the caller.
-- What actually keeps it safe is that it lives in the `private` schema, which is
-- not exposed to the Data API (verified: PostgREST returns 404 for it), and that
-- it derives the user from auth.uid() internally rather than trusting an argument.

create schema if not exists private;
revoke all on schema private from anon, authenticated;

-- Enums ----------------------------------------------------------------------

create type public.member_role as enum ('owner', 'admin', 'member');
create type public.issue_status as enum ('backlog', 'todo', 'in_progress', 'done', 'canceled');
create type public.issue_priority as enum ('none', 'low', 'medium', 'high', 'urgent');

-- Workspaces -----------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Every membership lookup goes user -> workspaces, which the PK
-- (workspace_id, user_id) cannot serve. Without this index the helper below does
-- a sequential scan on every RLS check in the app.
create index workspace_members_user_id_idx on public.workspace_members (user_id);

-- Invites: either a shareable code, or an email-addressed invite.
create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code text not null unique,
  email text,
  role public.member_role not null default 'member',
  created_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index workspace_invites_workspace_id_idx on public.workspace_invites (workspace_id);

-- Membership helpers ---------------------------------------------------------

-- `stable` matters: it lets Postgres cache the result within a statement rather
-- than re-running the lookup for every row.
create function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.workspace_members m
     where m.workspace_id = target_workspace_id
       -- The user is taken from the JWT, never from an argument, so a caller
       -- cannot ask "is *someone else* a member?"
       and m.user_id = (select auth.uid())
  );
$$;

create function private.has_workspace_role(target_workspace_id uuid, allowed public.member_role[])
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.workspace_members m
     where m.workspace_id = target_workspace_id
       and m.user_id = (select auth.uid())
       and m.role = any (allowed)
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.has_workspace_role(uuid, public.member_role[]) to authenticated;

-- Projects -------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  -- Short prefix used in issue identifiers, e.g. "API" -> API-14.
  key text not null check (key ~ '^[A-Z][A-Z0-9]{1,5}$'),
  description text,
  -- Per-project issue counter. Kept here rather than counting issues, so two
  -- concurrent inserts cannot be handed the same number.
  issue_counter integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, key)
);

create index projects_workspace_id_idx on public.projects (workspace_id);

-- Labels ---------------------------------------------------------------------

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  color text not null default '#6b7280' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create index labels_workspace_id_idx on public.labels (workspace_id);

-- Issues ---------------------------------------------------------------------

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  -- Human-facing number, unique per project. Assigned by trigger.
  number integer not null,
  title text not null check (length(trim(title)) between 1 and 200),
  description text,
  status public.issue_status not null default 'backlog',
  priority public.issue_priority not null default 'none',
  assignee_id uuid references public.profiles (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  -- Sort key within a board column. Fractional, so a card can be dropped between
  -- two others by writing one row instead of renumbering the whole column.
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, number)
);

-- RLS filters by workspace on every read, so it leads.
create index issues_workspace_id_idx on public.issues (workspace_id);
-- Serves the board: one project's column, already in display order.
create index issues_board_idx on public.issues (project_id, status, position);
create index issues_assignee_idx on public.issues (assignee_id) where assignee_id is not null;

create table public.issue_labels (
  issue_id uuid not null references public.issues (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  primary key (issue_id, label_id)
);

create index issue_labels_label_id_idx on public.issue_labels (label_id);
create index issue_labels_workspace_id_idx on public.issue_labels (workspace_id);

-- Comments -------------------------------------------------------------------

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  issue_id uuid not null references public.issues (id) on delete cascade,
  -- Threading: a reply points at its parent. The UI renders one level; the
  -- schema does not forbid deeper nesting.
  parent_id uuid references public.comments (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete restrict,
  body text not null check (length(trim(body)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comments_issue_id_idx on public.comments (issue_id, created_at);
create index comments_workspace_id_idx on public.comments (workspace_id);

-- Activity -------------------------------------------------------------------

-- Append-only record of what happened to an issue. Written by triggers, never by
-- the client — which is why it has no INSERT/UPDATE/DELETE policy below.
create table public.activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  issue_id uuid not null references public.issues (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_issue_id_idx on public.activity (issue_id, created_at desc);
create index activity_workspace_id_idx on public.activity (workspace_id);

-- Triggers -------------------------------------------------------------------

create trigger workspaces_set_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger issues_set_updated_at before update on public.issues
  for each row execute function public.set_updated_at();
create trigger comments_set_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

-- Whoever creates a workspace owns it. This runs in the same transaction as the
-- insert, so a workspace can never exist with nobody able to reach it.
create function public.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- Assign the next per-project issue number.
create function public.assign_issue_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_number integer;
begin
  -- UPDATE ... RETURNING takes a row lock, so concurrent inserts into the same
  -- project queue up instead of racing. `select max(number) + 1` would hand both
  -- of them the same value.
  update public.projects
     set issue_counter = issue_counter + 1
   where id = new.project_id
  returning issue_counter into next_number;

  if next_number is null then
    raise exception 'Project % does not exist', new.project_id;
  end if;

  new.number := next_number;
  return new;
end;
$$;

create trigger issues_assign_number
  before insert on public.issues
  for each row execute function public.assign_issue_number();

-- Close the RPC endpoints these SECURITY DEFINER trigger functions would
-- otherwise expose. See the note in the profiles migration: Postgres grants
-- EXECUTE to PUBLIC by default and `public` is API-exposed, so without this,
-- /rest/v1/rpc/handle_new_workspace is callable by anon. Revoking does not stop
-- the triggers firing.
revoke execute on function public.handle_new_workspace() from public, anon, authenticated;
revoke execute on function public.assign_issue_number() from public, anon, authenticated;

-- Row Level Security ---------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.projects enable row level security;
alter table public.labels enable row level security;
alter table public.issues enable row level security;
alter table public.issue_labels enable row level security;
alter table public.comments enable row level security;
alter table public.activity enable row level security;

-- Grants. Required since 2026-04-28: without them PostgREST returns 42501 no
-- matter what the policies say. `anon` gets nothing anywhere — Nucleus has no
-- public data.
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.workspace_invites to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.labels to authenticated;
grant select, insert, update, delete on public.issues to authenticated;
grant select, insert, delete on public.issue_labels to authenticated;
grant select, insert, update, delete on public.comments to authenticated;
-- Activity is read-only to clients; triggers write it.
grant select on public.activity to authenticated;

-- workspaces
create policy workspaces_select_member on public.workspaces
  for select to authenticated
  using ((select private.is_workspace_member(id)));

-- Anyone signed in may create a workspace, but only in their own name. Without
-- the WITH CHECK a user could forge `created_by`, and the ownership trigger
-- would hand the new workspace to someone else.
create policy workspaces_insert_self on public.workspaces
  for insert to authenticated
  with check ((select auth.uid()) = created_by);

create policy workspaces_update_admin on public.workspaces
  for update to authenticated
  using ((select private.has_workspace_role(id, array['owner', 'admin']::public.member_role[])))
  with check ((select private.has_workspace_role(id, array['owner', 'admin']::public.member_role[])));

create policy workspaces_delete_owner on public.workspaces
  for delete to authenticated
  using ((select private.has_workspace_role(id, array['owner']::public.member_role[])));

-- workspace_members: members can see who else is in the workspace.
create policy workspace_members_select on public.workspace_members
  for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

-- Members are added by an admin, or by redeeming an invite (a SECURITY DEFINER
-- function, added with the invite flow). There is deliberately NO policy letting
-- a user insert their own membership row — that would let anyone join any
-- workspace just by knowing its id.
create policy workspace_members_insert_admin on public.workspace_members
  for insert to authenticated
  with check ((select private.has_workspace_role(workspace_id, array['owner', 'admin']::public.member_role[])));

create policy workspace_members_update_admin on public.workspace_members
  for update to authenticated
  using ((select private.has_workspace_role(workspace_id, array['owner', 'admin']::public.member_role[])))
  with check ((select private.has_workspace_role(workspace_id, array['owner', 'admin']::public.member_role[])));

-- An admin may remove members; anyone may remove themselves (leave).
create policy workspace_members_delete on public.workspace_members
  for delete to authenticated
  using (
    (select private.has_workspace_role(workspace_id, array['owner', 'admin']::public.member_role[]))
    or user_id = (select auth.uid())
  );

-- workspace_invites: only admins manage them. Redeeming does NOT read this table
-- through RLS — someone who has not joined yet is not a member and cannot see it
-- — so redemption goes through a SECURITY DEFINER function instead.
create policy workspace_invites_select_admin on public.workspace_invites
  for select to authenticated
  using ((select private.has_workspace_role(workspace_id, array['owner', 'admin']::public.member_role[])));

create policy workspace_invites_insert_admin on public.workspace_invites
  for insert to authenticated
  with check (
    (select private.has_workspace_role(workspace_id, array['owner', 'admin']::public.member_role[]))
    and created_by = (select auth.uid())
  );

create policy workspace_invites_delete_admin on public.workspace_invites
  for delete to authenticated
  using ((select private.has_workspace_role(workspace_id, array['owner', 'admin']::public.member_role[])));

-- projects / labels / issues / issue_labels / comments: plain membership.
create policy projects_select on public.projects
  for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy projects_insert on public.projects
  for insert to authenticated with check ((select private.is_workspace_member(workspace_id)));
create policy projects_update on public.projects
  for update to authenticated
  using ((select private.is_workspace_member(workspace_id)))
  with check ((select private.is_workspace_member(workspace_id)));
create policy projects_delete on public.projects
  for delete to authenticated
  using ((select private.has_workspace_role(workspace_id, array['owner', 'admin']::public.member_role[])));

create policy labels_select on public.labels
  for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy labels_insert on public.labels
  for insert to authenticated with check ((select private.is_workspace_member(workspace_id)));
create policy labels_update on public.labels
  for update to authenticated
  using ((select private.is_workspace_member(workspace_id)))
  with check ((select private.is_workspace_member(workspace_id)));
create policy labels_delete on public.labels
  for delete to authenticated using ((select private.is_workspace_member(workspace_id)));

create policy issues_select on public.issues
  for select to authenticated using ((select private.is_workspace_member(workspace_id)));

-- WITH CHECK also pins `created_by`: without it a member could file an issue
-- under a colleague's name.
create policy issues_insert on public.issues
  for insert to authenticated
  with check (
    (select private.is_workspace_member(workspace_id))
    and created_by = (select auth.uid())
  );

-- Both clauses are required. USING alone would let a member move an issue *into*
-- another workspace by rewriting workspace_id; WITH CHECK alone would not stop
-- them targeting a foreign row in the first place.
create policy issues_update on public.issues
  for update to authenticated
  using ((select private.is_workspace_member(workspace_id)))
  with check ((select private.is_workspace_member(workspace_id)));

create policy issues_delete on public.issues
  for delete to authenticated using ((select private.is_workspace_member(workspace_id)));

create policy issue_labels_select on public.issue_labels
  for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy issue_labels_insert on public.issue_labels
  for insert to authenticated with check ((select private.is_workspace_member(workspace_id)));
create policy issue_labels_delete on public.issue_labels
  for delete to authenticated using ((select private.is_workspace_member(workspace_id)));

create policy comments_select on public.comments
  for select to authenticated using ((select private.is_workspace_member(workspace_id)));

create policy comments_insert on public.comments
  for insert to authenticated
  with check (
    (select private.is_workspace_member(workspace_id))
    and author_id = (select auth.uid())
  );

-- You may edit and delete only your own comments, even inside your own workspace.
create policy comments_update_own on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)))
  with check (author_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)));

create policy comments_delete_own on public.comments
  for delete to authenticated
  using (author_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)));

create policy activity_select on public.activity
  for select to authenticated using ((select private.is_workspace_member(workspace_id)));
-- No write policies for activity: it is trigger-written and must stay honest.
-- A user cannot forge history.

-- profiles, revisited --------------------------------------------------------

-- Until now a user could read only their own profile. The app has to render
-- assignees and comment authors, so members of a shared workspace must be able to
-- see each other — and *only* each other. This is an additional permissive policy
-- rather than a replacement, so `profiles_select_own` still covers a user who
-- belongs to no workspace yet.
create policy profiles_select_shared_workspace on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
        from public.workspace_members mine
        join public.workspace_members theirs
          on theirs.workspace_id = mine.workspace_id
       where mine.user_id = (select auth.uid())
         and theirs.user_id = public.profiles.id
    )
  );
