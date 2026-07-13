-- RLS PROOF: the board's live channel.
--
-- ---------------------------------------------------------------------------
-- WHY THIS PROOF EXISTS
-- ---------------------------------------------------------------------------
-- The Kanban board broadcasts every issue change to a private Realtime channel,
-- `project:<project_id>`, so that a card someone else drags moves on your screen
-- too. The broadcast payload carries the whole issue row — title, description,
-- assignee, everything.
--
-- That makes the channel a SECOND way out of the database, running entirely beside
-- PostgREST. Every RLS policy this codebase has protects the REST path. None of
-- them protect this one: Realtime authorizes a subscriber by running RLS on
-- `realtime.messages`, a table we do not own and did not write policies for.
--
-- So the question this proof answers is not "does the board work". It is: can
-- somebody who is not in the workspace simply *subscribe* to the topic and be sent
-- the issues? Naming a topic costs nothing — the project id is in the URL of anyone
-- who has ever seen the board, and even if it were not, a uuid is guessable in the
-- sense that it can be tried.
--
-- Supabase's own documentation offers this policy for broadcast-from-database:
--
--   create policy "authenticated can receive broadcasts"
--   on realtime.messages for select to authenticated using (true);
--
-- `using (true)` means EVERY signed-in user of this project receives EVERY message
-- on EVERY topic. In a multi-tenant app that is a total tenancy bypass, and it is
-- the documented example. Hence this file.
--
-- ---------------------------------------------------------------------------
-- HOW IT WORKS
-- ---------------------------------------------------------------------------
-- Realtime decides whether a client may join a private channel by setting
-- `realtime.topic` to the channel name and then running SELECT against
-- `realtime.messages` under the subscriber's JWT. `realtime.topic()` is just
-- `current_setting('realtime.topic')` — so we can reproduce that exactly here with
-- `set local`, which makes this a real test of the real policy rather than a
-- reading of it.
--
-- Runs in a transaction that always rolls back.

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@rls-proof.test', 'x', now(), now(), now(),
   '{}'::jsonb, '{"display_name":"Alice"}'::jsonb),
  ('c0000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mallory@rls-proof.test', 'x', now(), now(), now(),
   '{}'::jsonb, '{"display_name":"Mallory"}'::jsonb);

-- Alice is in Acme. Mallory is not, and never will be.
insert into public.workspaces (id, name, slug, created_by) values
  ('11111111-1111-1111-1111-111111111111', 'Acme', 'acme',
   'a0000000-0000-0000-0000-00000000000a'),
  ('22222222-2222-2222-2222-222222222222', 'Mallory Co', 'mallory-co',
   'c0000000-0000-0000-0000-00000000000c');

insert into public.projects (id, workspace_id, name, key) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111', 'Platform', 'PLAT'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '22222222-2222-2222-2222-222222222222', 'Mallory Platform', 'PLAT');

-- `realtime.messages` is range-partitioned by day, and Realtime creates each day's
-- partition as messages arrive. On a project where nothing has broadcast today, the
-- partition does not exist yet and the inserts below fail with "no partition of
-- relation messages found for row" — which looks like a broken proof and is not.
-- Create it if it is missing; the rollback takes it away again.
do $$
begin
  execute format(
    'create table realtime.messages_%s partition of realtime.messages '
    'for values from (%L) to (%L)',
    to_char(current_date, 'YYYY_MM_DD'), current_date, current_date + 1);
exception
  -- Realtime got there first, under this exact name (42P07) or another (42P17,
  -- raised when the new bounds overlap an existing partition). Either is fine.
  when duplicate_table then null;
  when invalid_object_definition then null;
end;
$$;

-- Stand in for what the broadcast trigger writes. Inserted as the migration role,
-- which bypasses RLS — exactly as `realtime.broadcast_changes` does when it is
-- called from a SECURITY DEFINER trigger.
insert into realtime.messages (topic, extension, event, private, payload)
values
  ('project:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'broadcast', 'UPDATE', true,
   '{"record":{"title":"Acme internal roadmap issue"}}'::jsonb),
  ('project:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'broadcast', 'UPDATE', true,
   '{"record":{"title":"Mallory''s own issue"}}'::jsonb),
  -- A different extension on Acme's topic. The policy authorizes broadcast, and
  -- should not hand out presence just because the topic name happens to match.
  ('project:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'presence', 'UPDATE', true,
   '{"record":{"who":"alice"}}'::jsonb);

-- ===========================================================================
-- PART 1 — Mallory subscribes to Acme's board. THE POINT OF THIS FILE.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}';

-- Exactly what Realtime does when a client calls
--   supabase.channel('project:aaaa…', { config: { private: true } })
set local realtime.topic = 'project:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

do $$
declare
  n int;
begin
  select count(*) into n from realtime.messages;
  if n <> 0 then
    raise exception
      'RLS FAIL: a non-member subscribed to Acme''s board and was sent % message(s). '
      'The board leaks every issue to anyone who can name the project id.', n;
  end if;
end;
$$;

reset role;

-- ===========================================================================
-- PART 2 — Alice is in Acme, so the board has to actually work for her.
--
-- Without this half, "deny everyone" would pass Part 1 and ship a dead board.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local realtime.topic = 'project:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

do $$
declare
  n int;
begin
  select count(*) into n from realtime.messages;
  if n = 0 then
    raise exception
      'FAIL: a member of Acme received nothing on their own board. The channel is '
      'authorized to nobody, so the board will never update live.';
  end if;

  -- Exactly one. Two other rows exist and neither may be returned:
  --
  --   * a `presence` row on this same topic — so the policy must gate on the
  --     extension, not just on the topic name;
  --   * a `broadcast` row on MALLORY'S topic — so the policy must compare the row's
  --     own `topic` column against realtime.topic(). Leave that out and the
  --     membership check depends only on a session setting, never on the row, which
  --     authorizes every broadcast in the table. This proof caught exactly that.
  if n <> 1 then
    raise exception
      'RLS FAIL: expected exactly 1 broadcast on Acme''s topic, got %. The policy is '
      'returning rows it should not — check that it compares the row''s own topic '
      'and extension, and not only realtime.topic().', n;
  end if;
end;
$$;

reset role;

-- ===========================================================================
-- PART 3 — Alice names Mallory's topic instead.
--
-- Being a legitimate user of Nucleus is not authorization for someone else's
-- board. This is the same check as Part 1 from the other direction, and it is the
-- one that `using (true)` would fail.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local realtime.topic = 'project:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

do $$
declare
  n int;
begin
  select count(*) into n from realtime.messages;
  if n <> 0 then
    raise exception
      'RLS FAIL: an Acme member subscribed to Mallory''s board and was sent % '
      'message(s).', n;
  end if;
end;
$$;

reset role;

-- ===========================================================================
-- PART 4 — A topic that is not a project at all.
--
-- The policy resolves a topic to a project and then checks membership. A topic
-- that resolves to nothing must deny, not fall through to allow — which is what an
-- `exists(...)` written the wrong way round would do.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local realtime.topic = 'project:99999999-9999-9999-9999-999999999999';

do $$
declare
  n int;
begin
  select count(*) into n from realtime.messages;
  if n <> 0 then
    raise exception 'RLS FAIL: an unknown topic was authorized, returning % row(s)', n;
  end if;
end;
$$;

reset role;

rollback;
