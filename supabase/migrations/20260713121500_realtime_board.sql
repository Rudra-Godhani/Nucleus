-- Live board: broadcast every issue change to the project's private channel.
--
-- ---------------------------------------------------------------------------
-- WHY BROADCAST-FROM-DATABASE AND NOT postgres_changes
-- ---------------------------------------------------------------------------
-- `postgres_changes` streams the WAL and re-checks RLS per subscriber, per row, in
-- a single Realtime process — it does not scale, and every subscriber pays for
-- every other tenant's writes. Broadcast-from-database instead has Postgres itself
-- decide, once, at write time, which topic a change belongs to, and Realtime simply
-- fans it out.
--
-- The trade is that authorization moves to the CHANNEL: whoever may join the topic
-- receives everything on it. So the policy below is the entire security boundary
-- for this feature, and it is worth reading carefully.
--
-- ---------------------------------------------------------------------------
-- WHY NOT THE POLICY IN SUPABASE'S DOCS
-- ---------------------------------------------------------------------------
-- The documented example for this feature is:
--
--   create policy "authenticated can receive broadcasts"
--   on realtime.messages for select to authenticated using (true);
--
-- In a multi-tenant app that is a complete tenancy bypass: any signed-in user
-- receives every message on every topic, including the full row payloads of issues
-- in workspaces they have never been near. Naming a topic is not a secret — the
-- project id is in the URL of anyone who has ever opened the board.
--
-- The policy here resolves the topic back to a project and demands membership of
-- that project's workspace. supabase/tests/007 proves it, and would go red on the
-- `using (true)` version.

-- ---------------------------------------------------------------------------
-- The trigger: one broadcast per issue change, on the project's topic.
-- ---------------------------------------------------------------------------
create or replace function public.broadcast_issue_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  topic text;
begin
  -- On DELETE there is no NEW row, so the topic has to come from OLD. Branching
  -- explicitly rather than `coalesce(new, old)`: this is the line that decides
  -- which tenant's channel a message lands on, and it should not be clever.
  if tg_op = 'DELETE' then
    topic := 'project:' || old.project_id::text;
  else
    topic := 'project:' || new.project_id::text;
  end if;

  perform realtime.broadcast_changes(
    topic,             -- topic_name: the channel the board subscribes to
    tg_op,             -- event_name: INSERT | UPDATE | DELETE
    tg_op,             -- operation
    tg_table_name,
    tg_table_schema,
    new,
    old
  );

  -- AFTER trigger: the return value is discarded.
  return null;
end;
$$;

-- SECURITY DEFINER in `public` is a public RPC endpoint unless the grant Postgres
-- hands to PUBLIC on every new function is taken back. Triggers still fire. See the
-- note in the profiles migration, and CLAUDE.md.
revoke execute on function public.broadcast_issue_change() from public, anon, authenticated;

create trigger issues_broadcast_change
  after insert or update or delete on public.issues
  for each row execute function public.broadcast_issue_change();

-- ---------------------------------------------------------------------------
-- The policy: who may join `project:<id>`.
-- ---------------------------------------------------------------------------
-- Realtime authorizes a subscriber by setting `realtime.topic` to the requested
-- channel name and running SELECT against realtime.messages under that user's JWT.
-- `realtime.topic()` is simply `current_setting('realtime.topic')`.
--
-- Note there is no INSERT policy, and that is deliberate: clients never send on this
-- channel. The only writer is the trigger above, which runs as its definer and
-- bypasses RLS. A client that tries to broadcast is refused by default.
create policy issues_board_broadcast_select on realtime.messages
  for select to authenticated
  using (
    -- Gate on the extension, not the topic alone. Otherwise joining the channel
    -- would also hand out presence, and any future message type that lands on it.
    extension = 'broadcast'

    -- The row's OWN topic must be the one being joined.
    --
    -- Easy to leave out, and supabase/tests/007 caught its absence: the membership
    -- check below reads `realtime.topic()`, which is a session setting, not a
    -- column — so without this line the predicate does not depend on the row at
    -- all, and joining ONE project's channel authorizes EVERY broadcast row in the
    -- table, every tenant's included. Realtime happens not to stream rows this way,
    -- so nothing would have leaked in practice; a policy whose safety rests on a
    -- caller's good manners is not one worth having.
    and topic = (select realtime.topic())

    and exists (
      select 1
        from public.projects p
       where 'project:' || p.id::text = (select realtime.topic())
         and (select private.is_workspace_member(p.workspace_id))
    )
  );
