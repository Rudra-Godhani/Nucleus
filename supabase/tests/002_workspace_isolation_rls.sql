-- RLS PROOF: workspace isolation — the core multi-tenancy guarantee.
--
-- THE CLAIM: a user who is not a member of a workspace receives ZERO rows from
-- every tenant-scoped table in it, and cannot write into it either.
--
-- Cast:
--   alice   — member of Acme
--   bob     — member of Acme (proves the policies are not simply denying everyone)
--   mallory — member of NOTHING, and separately of her own workspace, so she is a
--             legitimate signed-in user rather than a stranger with no session.
--             This is the important distinction: the threat is an authenticated
--             customer reading another customer's data, not an anonymous visitor.
--
-- Runs in a transaction that always rolls back. Failure RAISEs, which aborts —
-- a silent pass is impossible.

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

-- Seed as a privileged role. RLS is exercised further down, after we drop to
-- `authenticated` — seeding through the policies would only prove the seed works.
insert into public.workspaces (id, name, slug, created_by) values
  ('11111111-1111-1111-1111-111111111111', 'Acme', 'acme',
   'a0000000-0000-0000-0000-00000000000a'),
  ('22222222-2222-2222-2222-222222222222', 'Mallory Co', 'mallory-co',
   'c0000000-0000-0000-0000-00000000000c');
-- The on_workspace_created trigger made alice owner of Acme and mallory owner of
-- Mallory Co. Add bob to Acme so it has two members.
insert into public.workspace_members (workspace_id, user_id, role)
values ('11111111-1111-1111-1111-111111111111',
        'b0000000-0000-0000-0000-00000000000b', 'member');

insert into public.projects (id, workspace_id, name, key) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
   'Platform', 'PLAT');

insert into public.labels (id, workspace_id, name) values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'bug');

insert into public.issues (id, workspace_id, project_id, title, created_by, status) values
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333', 'Acme secret issue',
   'a0000000-0000-0000-0000-00000000000a', 'todo');

insert into public.issue_labels (issue_id, label_id, workspace_id) values
  ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444',
   '11111111-1111-1111-1111-111111111111');

insert into public.comments (id, workspace_id, issue_id, author_id, body) values
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111',
   '55555555-5555-5555-5555-555555555555', 'a0000000-0000-0000-0000-00000000000a',
   'Acme internal discussion');

insert into public.activity (workspace_id, issue_id, actor_id, kind) values
  ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555',
   'a0000000-0000-0000-0000-00000000000a', 'created');

insert into public.workspace_invites (workspace_id, code, created_by) values
  ('11111111-1111-1111-1111-111111111111', 'ACME-SECRET-CODE',
   'a0000000-0000-0000-0000-00000000000a');

-- The issue-number trigger should have produced PLAT-1.
do $$
begin
  if (select number from public.issues
       where id = '55555555-5555-5555-5555-555555555555') <> 1 then
    raise exception 'SETUP FAIL: issue number was not assigned by the trigger';
  end if;
end;
$$;

-- ===========================================================================
-- PART 1 — Alice (a member) can see her workspace. If this fails, the policies
-- are too tight and the proof below would pass for the wrong reason: a table
-- nobody can read trivially leaks nothing.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

do $$
begin
  if (select count(*) from public.workspaces) <> 1 then
    raise exception 'FAIL: Alice should see exactly 1 workspace (Acme), saw %',
      (select count(*) from public.workspaces);
  end if;
  if (select count(*) from public.issues) <> 1 then
    raise exception 'FAIL: Alice cannot see her own workspace''s issue';
  end if;
  if (select count(*) from public.comments) <> 1 then
    raise exception 'FAIL: Alice cannot see her own workspace''s comment';
  end if;
  if (select count(*) from public.workspace_members) <> 2 then
    raise exception 'FAIL: Alice should see 2 members of Acme, saw %',
      (select count(*) from public.workspace_members);
  end if;
  -- Alice must be able to see Bob's profile — they share a workspace.
  if (select count(*) from public.profiles
       where id = 'b0000000-0000-0000-0000-00000000000b') <> 1 then
    raise exception 'FAIL: Alice cannot see her teammate Bob''s profile';
  end if;
end;
$$;

reset role;

-- ===========================================================================
-- PART 2 — THE CORE CLAIM. Mallory is authenticated and owns her own workspace,
-- but is not a member of Acme. She must see NOTHING of Acme's.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}';

do $$
declare
  n int;
  wrote int;
begin
  if (select auth.uid()) is distinct from 'c0000000-0000-0000-0000-00000000000c'::uuid then
    raise exception 'SETUP FAIL: impersonation did not take effect';
  end if;

  -- --- ZERO ROWS from every tenant-scoped table -----------------------------
  -- Unfiltered reads: Mallory sees only her own workspace, never Acme's rows.

  select count(*) into n from public.workspaces
   where id = '11111111-1111-1111-1111-111111111111';
  if n <> 0 then raise exception 'RLS FAIL: non-member read Acme workspace (% rows)', n; end if;

  select count(*) into n from public.projects;
  if n <> 0 then raise exception 'RLS FAIL: non-member read % project row(s)', n; end if;

  select count(*) into n from public.issues;
  if n <> 0 then raise exception 'RLS FAIL: non-member read % issue row(s)', n; end if;

  select count(*) into n from public.labels;
  if n <> 0 then raise exception 'RLS FAIL: non-member read % label row(s)', n; end if;

  select count(*) into n from public.issue_labels;
  if n <> 0 then raise exception 'RLS FAIL: non-member read % issue_label row(s)', n; end if;

  select count(*) into n from public.comments;
  if n <> 0 then raise exception 'RLS FAIL: non-member read % comment row(s)', n; end if;

  select count(*) into n from public.activity;
  if n <> 0 then raise exception 'RLS FAIL: non-member read % activity row(s)', n; end if;

  select count(*) into n from public.workspace_invites;
  if n <> 0 then raise exception 'RLS FAIL: non-member read % invite row(s) — invite codes leak!', n; end if;

  -- Membership of a foreign workspace must not be enumerable either: knowing who
  -- works at Acme is itself a leak.
  select count(*) into n from public.workspace_members
   where workspace_id = '11111111-1111-1111-1111-111111111111';
  if n <> 0 then raise exception 'RLS FAIL: non-member enumerated Acme''s members (% rows)', n; end if;

  -- Nor may she read the profile of someone she shares no workspace with.
  select count(*) into n from public.profiles
   where id = 'a0000000-0000-0000-0000-00000000000a';
  if n <> 0 then raise exception 'RLS FAIL: non-member read a stranger''s profile'; end if;

  -- Targeting a row by its exact primary key must not help.
  select count(*) into n from public.issues
   where id = '55555555-5555-5555-5555-555555555555';
  if n <> 0 then raise exception 'RLS FAIL: non-member read Acme issue by direct id'; end if;

  -- --- NO WRITES either ------------------------------------------------------
  -- Zero-row UPDATEs are the trap: Postgres reports success, so app code that
  -- does not check the row count would believe the write landed.

  update public.issues set title = 'pwned'
   where id = '55555555-5555-5555-5555-555555555555';
  get diagnostics wrote = row_count;
  if wrote <> 0 then raise exception 'RLS FAIL: non-member UPDATEd Acme''s issue (% rows)', wrote; end if;

  delete from public.issues where id = '55555555-5555-5555-5555-555555555555';
  get diagnostics wrote = row_count;
  if wrote <> 0 then raise exception 'RLS FAIL: non-member DELETEd Acme''s issue (% rows)', wrote; end if;

  update public.comments set body = 'pwned'
   where id = '66666666-6666-6666-6666-666666666666';
  get diagnostics wrote = row_count;
  if wrote <> 0 then raise exception 'RLS FAIL: non-member UPDATEd Acme''s comment'; end if;

  -- Inserting *into* Acme must be refused outright.
  begin
    insert into public.issues (workspace_id, project_id, title, created_by)
    values ('11111111-1111-1111-1111-111111111111',
            '33333333-3333-3333-3333-333333333333', 'mallory was here',
            'c0000000-0000-0000-0000-00000000000c');
    raise exception 'RLS FAIL: non-member INSERTed an issue into Acme';
  exception when insufficient_privilege then null;  -- expected
  end;

  -- Self-promotion into Acme must be refused. This is the privilege-escalation
  -- path that would defeat every other check above.
  begin
    insert into public.workspace_members (workspace_id, user_id, role)
    values ('11111111-1111-1111-1111-111111111111',
            'c0000000-0000-0000-0000-00000000000c', 'owner');
    raise exception 'RLS FAIL: non-member JOINED Acme by inserting their own membership row';
  exception when insufficient_privilege then null;  -- expected
  end;

  -- The membership helper must not answer questions about other people.
  if (select private.is_workspace_member('11111111-1111-1111-1111-111111111111')) then
    raise exception 'RLS FAIL: is_workspace_member() says the non-member belongs to Acme';
  end if;
end;
$$;

reset role;

-- ===========================================================================
-- PART 3 — A member may not smuggle a row into another workspace by rewriting
-- workspace_id. This is what WITH CHECK on the UPDATE policy defends.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

do $$
declare
  wrote int;
begin
  -- Alice is a member of Acme but not of Mallory Co. Moving her issue there must
  -- fail: USING passes (she may target the row) but WITH CHECK must reject the
  -- new value.
  begin
    update public.issues
       set workspace_id = '22222222-2222-2222-2222-222222222222'
     where id = '55555555-5555-5555-5555-555555555555';
    get diagnostics wrote = row_count;
    if wrote <> 0 then
      raise exception 'RLS FAIL: member moved an issue into a workspace they do not belong to';
    end if;
  exception when insufficient_privilege then null;  -- expected: WITH CHECK rejected it
  end;

  -- A member may not forge authorship on a comment.
  begin
    insert into public.comments (workspace_id, issue_id, author_id, body)
    values ('11111111-1111-1111-1111-111111111111',
            '55555555-5555-5555-5555-555555555555',
            'b0000000-0000-0000-0000-00000000000b',  -- pretending to be Bob
            'Bob definitely said this');
    raise exception 'RLS FAIL: member forged a comment as another user';
  exception when insufficient_privilege then null;  -- expected
  end;

  -- Activity is trigger-written. A member must not be able to fabricate history.
  begin
    insert into public.activity (workspace_id, issue_id, actor_id, kind)
    values ('11111111-1111-1111-1111-111111111111',
            '55555555-5555-5555-5555-555555555555',
            'a0000000-0000-0000-0000-00000000000a', 'forged');
    raise exception 'RLS FAIL: a client wrote to the activity feed';
  exception when insufficient_privilege then null;  -- expected: no INSERT policy
  end;
end;
$$;

reset role;

rollback;
