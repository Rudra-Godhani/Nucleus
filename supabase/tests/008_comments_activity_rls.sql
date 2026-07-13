-- RLS PROOF: comments and the activity feed.
--
-- Three separate claims, and they fail in different ways:
--
--   1. Comments are workspace-scoped like everything else — a non-member reads none
--      of them and can write none of them.
--
--   2. A THREAD cannot cross a tenant boundary. `comments.parent_id` is a plain
--      foreign key to `comments (id)`, so nothing in the schema stops a reply in one
--      workspace from pointing at a comment in another. This is the same shape as the
--      cross-tenant write closed in the tenant_scoped_foreign_keys migration — that
--      migration scoped `issue_id` and left `parent_id` behind.
--
--   3. Activity is HISTORY, and history that its subject can edit is worth nothing.
--      The activity table has a SELECT policy and no write policies at all: rows come
--      from a trigger, and a user must not be able to insert, alter or erase them —
--      not even inside their own workspace, not even their own.
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
  ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bob@rls-proof.test', 'x', now(), now(), now(),
   '{}'::jsonb, '{"display_name":"Bob"}'::jsonb),
  ('c0000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mallory@rls-proof.test', 'x', now(), now(), now(),
   '{}'::jsonb, '{"display_name":"Mallory"}'::jsonb);

-- Alice owns Acme, Bob is a member of it. Mallory owns an unrelated workspace.
insert into public.workspaces (id, name, slug, created_by) values
  ('11111111-1111-1111-1111-111111111111', 'Acme', 'acme',
   'a0000000-0000-0000-0000-00000000000a'),
  ('22222222-2222-2222-2222-222222222222', 'Mallory Co', 'mallory-co',
   'c0000000-0000-0000-0000-00000000000c');

insert into public.workspace_members (workspace_id, user_id, role)
values ('11111111-1111-1111-1111-111111111111',
        'b0000000-0000-0000-0000-00000000000b', 'member');

insert into public.projects (id, workspace_id, name, key) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111', 'Platform', 'PLAT'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '22222222-2222-2222-2222-222222222222', 'Mallory Platform', 'MPLAT');

insert into public.issues (id, workspace_id, project_id, title, created_by) values
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme issue',
   'a0000000-0000-0000-0000-00000000000a'),
  ('b1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Mallory issue',
   'c0000000-0000-0000-0000-00000000000c');

-- A comment in each workspace, so there is something on the other side to reach for.
insert into public.comments (id, workspace_id, issue_id, author_id, body) values
  ('ccccccc1-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
   'a1111111-1111-1111-1111-111111111111',
   'a0000000-0000-0000-0000-00000000000a', 'Acme comment'),
  ('ccccccc2-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222',
   'b1111111-1111-1111-1111-111111111111',
   'c0000000-0000-0000-0000-00000000000c', 'Mallory comment');

-- ===========================================================================
-- PART 1 — A member can hold a conversation, and cannot forge who said what.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}';

do $$
declare
  reply_id uuid;
  n int;
begin
  -- Bob replies to Alice. Threading works inside a workspace.
  insert into public.comments (workspace_id, issue_id, parent_id, author_id, body)
  values ('11111111-1111-1111-1111-111111111111',
          'a1111111-1111-1111-1111-111111111111',
          'ccccccc1-cccc-cccc-cccc-cccccccccccc',
          'b0000000-0000-0000-0000-00000000000b', 'Bob replies')
  returning id into reply_id;

  if reply_id is null then
    raise exception 'FAIL: a member could not reply to a comment in their own workspace';
  end if;

  -- Alice's comment and Bob's reply: two, and only two.
  select count(*) into n from public.comments;
  if n <> 2 then
    raise exception 'FAIL: member sees % comments in their workspace, expected 2', n;
  end if;

  -- Bob cannot put words in Alice's mouth. The WITH CHECK pins author_id to the JWT.
  begin
    insert into public.comments (workspace_id, issue_id, author_id, body)
    values ('11111111-1111-1111-1111-111111111111',
            'a1111111-1111-1111-1111-111111111111',
            'a0000000-0000-0000-0000-00000000000a', 'Alice did NOT say this');
    raise exception 'RLS FAIL: a member posted a comment under another user''s name';
  exception when insufficient_privilege then null;  -- expected
  end;

  -- Nor edit hers, even though it is in his workspace.
  update public.comments set body = 'tampered'
   where id = 'ccccccc1-cccc-cccc-cccc-cccccccccccc';
  if found then
    raise exception 'RLS FAIL: a member edited someone else''s comment';
  end if;

  delete from public.comments where id = 'ccccccc1-cccc-cccc-cccc-cccccccccccc';
  if found then
    raise exception 'RLS FAIL: a member deleted someone else''s comment';
  end if;

  -- His own, he owns.
  update public.comments set body = 'Bob, on reflection' where id = reply_id;
  if not found then
    raise exception 'FAIL: a member could not edit their own comment';
  end if;
end;
$$;

-- ===========================================================================
-- PART 2 — A THREAD MAY NOT CROSS A TENANT BOUNDARY.
--
-- Bob is a legitimate member of Acme. Everything about the row below is Acme's —
-- its workspace_id, its issue, its author — so every RLS check passes. Only the
-- PARENT belongs to Mallory.
--
-- RLS looks at the row being written, never at what the row POINTS AT. This is the
-- same hole that let an issue be filed against another tenant's project, and the
-- same fix applies: make it unrepresentable with a tenant-scoped foreign key.
--
-- Left open, Mallory deleting her own comment would cascade into Acme's workspace
-- and silently destroy a comment there.
-- ===========================================================================
do $$
begin
  insert into public.comments (workspace_id, issue_id, parent_id, author_id, body)
  values ('11111111-1111-1111-1111-111111111111',
          'a1111111-1111-1111-1111-111111111111',
          -- Mallory's comment. Not Acme's.
          'ccccccc2-cccc-cccc-cccc-cccccccccccc',
          'b0000000-0000-0000-0000-00000000000b', 'Threaded onto another tenant');

  raise exception
    'CROSS-TENANT FAIL: a reply in Acme was threaded onto a comment in Mallory''s '
    'workspace. RLS only checks the row being written, never what it points at — so '
    'comments.parent_id needs the same tenant-scoped foreign key as issue_id.';
exception
  -- What the composite foreign key raises. This is the pass.
  when foreign_key_violation then null;
end;
$$;

reset role;

-- ===========================================================================
-- PART 3 — Mallory is signed in, and is not in Acme.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}';

do $$
declare
  n int;
  wrote int;
begin
  -- Her own comment, and nothing of Acme's.
  select count(*) into n from public.comments;
  if n <> 1 then
    raise exception 'RLS FAIL: non-member sees % comments, expected only her own 1', n;
  end if;

  -- She cannot post into Acme's issue.
  begin
    insert into public.comments (workspace_id, issue_id, author_id, body)
    values ('11111111-1111-1111-1111-111111111111',
            'a1111111-1111-1111-1111-111111111111',
            'c0000000-0000-0000-0000-00000000000c', 'hello from outside');
    raise exception 'RLS FAIL: a non-member commented on another workspace''s issue';
  exception when insufficient_privilege then null;  -- expected
  end;

  -- Nor edit or delete what is there. Zero rows, not an error — which is exactly
  -- why this is asserted rather than assumed.
  update public.comments set body = 'pwned'
   where workspace_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics wrote = row_count;
  if wrote <> 0 then
    raise exception 'RLS FAIL: non-member updated % of Acme''s comment(s)', wrote;
  end if;

  delete from public.comments
   where workspace_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics wrote = row_count;
  if wrote <> 0 then
    raise exception 'RLS FAIL: non-member deleted % of Acme''s comment(s)', wrote;
  end if;

  -- And she sees none of Acme's history.
  select count(*) into n from public.activity
   where workspace_id = '11111111-1111-1111-1111-111111111111';
  if n <> 0 then
    raise exception 'RLS FAIL: non-member read % activity row(s) from Acme', n;
  end if;
end;
$$;

reset role;

-- ===========================================================================
-- PART 4 — Activity is history, and nobody may rewrite it.
--
-- The table has a SELECT policy and no write policies at all. Rows arrive by
-- trigger. A member must not be able to forge an entry ("Bob closed this"), quietly
-- delete one, or alter one — inside their own workspace, on their own issue, under
-- their own name. History that its subject can edit is not history.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}';

do $$
declare
  n int;
  wrote int;
begin
  -- The trigger must have recorded the issue being created, or there is no feed.
  select count(*) into n from public.activity
   where issue_id = 'a1111111-1111-1111-1111-111111111111';
  if n = 0 then
    raise exception
      'FAIL: no activity was recorded for an issue that was created and commented on. '
      'The feed is written by trigger — check that it exists and is SECURITY DEFINER, '
      'since `activity` has no INSERT policy by design.';
  end if;

  -- Forging an entry.
  begin
    insert into public.activity (workspace_id, issue_id, actor_id, kind, data)
    values ('11111111-1111-1111-1111-111111111111',
            'a1111111-1111-1111-1111-111111111111',
            'b0000000-0000-0000-0000-00000000000b', 'status_changed',
            '{"to":"done"}'::jsonb);
    raise exception 'RLS FAIL: a member wrote a forged entry into the activity feed';
  exception when insufficient_privilege then null;  -- expected
  end;

  -- Rewriting one.
  update public.activity set kind = 'nothing_happened'
   where issue_id = 'a1111111-1111-1111-1111-111111111111';
  get diagnostics wrote = row_count;
  if wrote <> 0 then
    raise exception 'RLS FAIL: a member rewrote % row(s) of the activity feed', wrote;
  end if;

  -- Erasing one.
  delete from public.activity
   where issue_id = 'a1111111-1111-1111-1111-111111111111';
  get diagnostics wrote = row_count;
  if wrote <> 0 then
    raise exception 'RLS FAIL: a member erased % row(s) from the activity feed', wrote;
  end if;
end;
$$;

reset role;

rollback;
