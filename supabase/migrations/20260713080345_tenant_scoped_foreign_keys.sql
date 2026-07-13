-- Close a cross-tenant write, using composite foreign keys.
--
-- ---------------------------------------------------------------------------
-- THE HOLE
-- ---------------------------------------------------------------------------
-- Every tenant-scoped table carries `workspace_id`, and every RLS policy checks
-- it. That is enough to stop a member reading or writing another workspace's ROWS
-- — and it says nothing at all about what their own rows POINT AT.
--
-- A member of Acme could therefore write a row that is legitimately Acme's by
-- every check RLS makes, while pointing it at another tenant's data:
--
--   insert into issues (workspace_id, project_id, ...)
--   values (<acme>, <mallory's project>, ...)  -- RLS: workspace_id is Acme's. Allowed.
--
-- That is not merely untidy. `assign_issue_number` is SECURITY DEFINER, so it
-- bypasses RLS by design — and it would then UPDATE `issue_counter` on a project
-- inside Mallory's workspace. An attacker with no access to her data at all could
-- write into it through a trigger, burning her issue numbers.
--
-- The same shape applied to labels (attach another workspace's label to your own
-- issue) and to assignees (assign work to someone who is not a member).
--
-- Caught by supabase/tests/006, which failed on exactly this before this migration.
--
-- ---------------------------------------------------------------------------
-- THE FIX
-- ---------------------------------------------------------------------------
-- Not another policy. A policy is a *check*, and a check can be forgotten at the
-- next table. Instead, make the bad reference unrepresentable: every foreign key
-- between two tenant-scoped tables now carries `workspace_id` on BOTH sides, so
-- Postgres itself refuses any reference that crosses a tenant boundary. No code
-- path — RLS, trigger, service role, or psql — can produce one.
--
-- This is why `workspace_id` is denormalised onto every table. It was already
-- carried to keep the policy checks fast; here it earns its place a second time.

-- The referenced side of a composite FK needs a matching unique constraint. `id`
-- is already unique on its own, so (id, workspace_id) adds no new restriction — it
-- exists purely to give the FK something to point at.
alter table public.projects add constraint projects_id_workspace_key unique (id, workspace_id);
alter table public.issues   add constraint issues_id_workspace_key   unique (id, workspace_id);
alter table public.labels   add constraint labels_id_workspace_key   unique (id, workspace_id);

-- workspace_members' primary key is (workspace_id, user_id); a composite FK needs
-- a unique constraint on the columns in the order it references them.
alter table public.workspace_members
  add constraint workspace_members_user_workspace_key unique (user_id, workspace_id);

-- issues.project_id -> a project in the SAME workspace ----------------------

alter table public.issues drop constraint issues_project_id_fkey;

alter table public.issues
  add constraint issues_project_fkey
  foreign key (project_id, workspace_id)
  references public.projects (id, workspace_id)
  on delete cascade;

-- issues.assignee_id -> a MEMBER of the same workspace ----------------------
--
-- This used to point at `profiles`, which meant any real user could be assigned —
-- including someone who had never joined the workspace and could not see the issue
-- they had supposedly been given.

alter table public.issues drop constraint issues_assignee_id_fkey;

alter table public.issues
  add constraint issues_assignee_fkey
  foreign key (assignee_id, workspace_id)
  references public.workspace_members (user_id, workspace_id)
  -- `set null (assignee_id)` — the column list is load-bearing. A bare SET NULL
  -- would try to null `workspace_id` as well, which is NOT NULL, and every attempt
  -- to remove a member would fail with a constraint error. Postgres 15+ lets us
  -- name the column to clear, so removing someone simply unassigns their issues
  -- rather than blocking the removal or deleting the work.
  on delete set null (assignee_id);

-- issue_labels -> an issue AND a label from the same workspace --------------

alter table public.issue_labels drop constraint issue_labels_issue_id_fkey;
alter table public.issue_labels drop constraint issue_labels_label_id_fkey;

alter table public.issue_labels
  add constraint issue_labels_issue_fkey
  foreign key (issue_id, workspace_id)
  references public.issues (id, workspace_id)
  on delete cascade;

alter table public.issue_labels
  add constraint issue_labels_label_fkey
  foreign key (label_id, workspace_id)
  references public.labels (id, workspace_id)
  on delete cascade;

-- comments and activity -> an issue in the same workspace -------------------

alter table public.comments drop constraint comments_issue_id_fkey;

alter table public.comments
  add constraint comments_issue_fkey
  foreign key (issue_id, workspace_id)
  references public.issues (id, workspace_id)
  on delete cascade;

alter table public.activity drop constraint activity_issue_id_fkey;

alter table public.activity
  add constraint activity_issue_fkey
  foreign key (issue_id, workspace_id)
  references public.issues (id, workspace_id)
  on delete cascade;

-- Belt and braces on the numbering trigger ----------------------------------
--
-- The composite FK above already makes a cross-workspace project reference
-- impossible, so the guard below can no longer be reached. It is added anyway,
-- because this function is SECURITY DEFINER: it is the one piece of code in the
-- schema that runs with RLS off, and it should not depend on a constraint declared
-- somewhere else for its safety. If a later migration defers or drops that FK,
-- this still refuses.
create or replace function public.assign_issue_number()
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
  -- of them the same number.
  --
  -- The `workspace_id` predicate is the guard: this runs as the function owner and
  -- bypasses RLS, so without it a row pointing at a foreign project would perform
  -- an UPDATE inside another tenant's data.
  update public.projects
     set issue_counter = issue_counter + 1
   where id = new.project_id
     and workspace_id = new.workspace_id
  returning issue_counter into next_number;

  if next_number is null then
    raise exception 'Project % does not exist in workspace %',
      new.project_id, new.workspace_id;
  end if;

  new.number := next_number;
  return new;
end;
$$;

revoke execute on function public.assign_issue_number() from public, anon, authenticated;
