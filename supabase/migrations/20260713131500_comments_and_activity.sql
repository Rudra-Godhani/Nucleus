-- Close a cross-tenant thread, and give the activity feed its only writer.
--
-- ---------------------------------------------------------------------------
-- 1. A THREAD MAY NOT CROSS A TENANT BOUNDARY
-- ---------------------------------------------------------------------------
-- `comments.parent_id` was a plain foreign key to `comments (id)`. Every RLS policy
-- on comments checks the row being written — its workspace, its author — and none of
-- them look at what the row POINTS AT. So a member of Acme could post a comment that
-- is Acme's by every check made, whose parent is a comment inside another tenant's
-- workspace.
--
-- This is the same hole, in the same shape, as the one closed for issues in
-- tenant_scoped_foreign_keys. That migration scoped `issue_id` and left `parent_id`
-- behind — which is precisely why the fix there was a CONSTRAINT and not a policy:
-- a policy is a check, and a check can be forgotten at the next column. Here is the
-- next column.
--
-- Concretely, left open: Mallory deletes her own comment, the cascade follows the
-- dangling parent link, and a comment inside Acme's workspace silently disappears.
-- She would never know, and neither would they.
--
-- Caught by supabase/tests/008, which failed on exactly this before this migration.

-- The referenced side of a composite FK needs a matching unique constraint. `id` is
-- already unique alone, so this adds no new restriction — it exists purely to give
-- the foreign key something to point at.
alter table public.comments
  add constraint comments_id_workspace_key unique (id, workspace_id);

alter table public.comments drop constraint comments_parent_id_fkey;

alter table public.comments
  add constraint comments_parent_fkey
  foreign key (parent_id, workspace_id)
  references public.comments (id, workspace_id)
  on delete cascade;

-- ---------------------------------------------------------------------------
-- 2. THE ACTIVITY FEED
-- ---------------------------------------------------------------------------
-- `activity` has a SELECT policy and NO write policies — not for members, not for
-- admins, not for the author of the issue. That is deliberate: a feed its own subject
-- can edit is not history, it is a draft. Nobody may forge "Bob closed this", quietly
-- delete an inconvenient entry, or rewrite one.
--
-- Which means the only way a row can get in is a SECURITY DEFINER trigger, running as
-- its owner and bypassing RLS. That is not a loophole around the policy — it IS the
-- policy: exactly one writer, and it is this function.
--
-- `auth.uid()` still works inside a SECURITY DEFINER function: it reads the request's
-- JWT claims from the session, which SECURITY DEFINER does not change. So the feed
-- records who actually did the thing, not who owns the function. Where there is no
-- JWT — a migration, a proof, a psql session — the actor is null, and `actor_id` is
-- nullable for exactly that reason.
create or replace function public.record_issue_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.activity (workspace_id, issue_id, actor_id, kind, data)
    values (new.workspace_id, new.id, actor, 'created',
            jsonb_build_object('title', new.title));
    return null;
  end if;

  -- One row per field that actually changed, rather than one "issue updated" row.
  -- "Ada moved this to In Progress" is history; "Ada updated this issue" is noise
  -- wearing history's clothes.
  --
  -- `is distinct from`, not `<>`: null <> null is null, not true, so a plain
  -- comparison would silently miss every assignment to and from Unassigned — which
  -- is most of them.
  if new.status is distinct from old.status then
    insert into public.activity (workspace_id, issue_id, actor_id, kind, data)
    values (new.workspace_id, new.id, actor, 'status_changed',
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  if new.priority is distinct from old.priority then
    insert into public.activity (workspace_id, issue_id, actor_id, kind, data)
    values (new.workspace_id, new.id, actor, 'priority_changed',
            jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into public.activity (workspace_id, issue_id, actor_id, kind, data)
    values (new.workspace_id, new.id, actor, 'assignee_changed',
            jsonb_build_object('from', old.assignee_id, 'to', new.assignee_id));
  end if;

  if new.title is distinct from old.title then
    insert into public.activity (workspace_id, issue_id, actor_id, kind, data)
    values (new.workspace_id, new.id, actor, 'title_changed',
            jsonb_build_object('from', old.title, 'to', new.title));
  end if;

  -- Deliberately NOT recorded: description edits, and `position`. A feed that
  -- announces every typo fix and every drag across a board is a feed nobody reads,
  -- and an unread feed is the same as no feed at all.

  return null;
end;
$$;

-- SECURITY DEFINER in `public` is an anon-callable RPC endpoint unless the grant
-- Postgres hands to PUBLIC on every new function is taken back. Triggers still fire.
revoke execute on function public.record_issue_activity() from public, anon, authenticated;

create trigger issues_record_activity
  after insert or update on public.issues
  for each row execute function public.record_issue_activity();

-- Serves the feed: one issue's history, already in the order it is read.
create index activity_issue_idx on public.activity (issue_id, created_at desc);

-- Serves the thread: one issue's comments, oldest first.
create index comments_issue_idx on public.comments (issue_id, created_at);
