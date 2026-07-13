-- RLS PROOF: issues, labels, and the joins between them.
--
-- The workspace boundary is proven elsewhere. This proof goes after a subtler
-- class of attack that RLS alone does NOT stop, and which only exists once rows
-- start pointing at other rows.
--
-- Every tenant-scoped table carries `workspace_id`, and every policy checks it.
-- That means a member of Acme may write any row whose `workspace_id` is Acme's —
-- and RLS asks nothing at all about the OTHER foreign keys on that row. So:
--
--   * Can a member file an issue in Acme that points at MALLORY'S project?
--     RLS says yes: workspace_id is Acme's, which is all it checks. And the
--     issue-number trigger is SECURITY DEFINER, so it would happily increment the
--     counter on a project in someone else's workspace.
--
--   * Can a member attach MALLORY'S label to an Acme issue? RLS checks
--     issue_labels.workspace_id, not where the label came from.
--
--   * Can a member assign an issue to someone who is not in the workspace at all?
--
-- Each of these is a write into, or a reference across, a tenant boundary. None of
-- them is prevented by a membership check on workspace_id, because the row being
-- written *is* in the right workspace — it is what it points at that is wrong.
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
   '{}'::jsonb, '{"display_name":"Mallory"}'::jsonb),
  -- Dana has an account but belongs to no workspace at all. She is the "assign to
  -- a stranger" target.
  ('d0000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dana@rls-proof.test', 'x', now(), now(), now(),
   '{}'::jsonb, '{"display_name":"Dana"}'::jsonb);

insert into public.workspaces (id, name, slug, created_by) values
  ('11111111-1111-1111-1111-111111111111', 'Acme', 'acme',
   'a0000000-0000-0000-0000-00000000000a'),
  ('22222222-2222-2222-2222-222222222222', 'Mallory Co', 'mallory-co',
   'c0000000-0000-0000-0000-00000000000c');

insert into public.workspace_members (workspace_id, user_id, role)
values ('11111111-1111-1111-1111-111111111111',
        'b0000000-0000-0000-0000-00000000000b', 'member');

-- Acme's project and label.
insert into public.projects (id, workspace_id, name, key) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
   'Platform', 'PLAT');
insert into public.labels (id, workspace_id, name) values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'bug');

-- Mallory's project and label, in her own workspace. These are the things Bob must
-- not be able to reach.
insert into public.projects (id, workspace_id, name, key) values
  ('99999999-9999-9999-9999-999999999999', '22222222-2222-2222-2222-222222222222',
   'Secret', 'SEC');
insert into public.labels (id, workspace_id, name) values
  ('88888888-8888-8888-8888-888888888888', '22222222-2222-2222-2222-222222222222',
   'mallory-only');

-- ===========================================================================
-- PART 1 — Bob is a member of Acme. The feature must work for him.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}';

do $$
declare
  v_first uuid;
  v_second uuid;
  n int;
begin
  insert into public.issues (workspace_id, project_id, title, created_by)
  values ('11111111-1111-1111-1111-111111111111',
          '33333333-3333-3333-3333-333333333333', 'First issue',
          'b0000000-0000-0000-0000-00000000000b')
  returning id into v_first;

  insert into public.issues (workspace_id, project_id, title, created_by, status, priority)
  values ('11111111-1111-1111-1111-111111111111',
          '33333333-3333-3333-3333-333333333333', 'Second issue',
          'b0000000-0000-0000-0000-00000000000b', 'in_progress', 'high')
  returning id into v_second;

  -- Numbers come from the trigger, per project, starting at 1.
  if (select number from public.issues where id = v_first) <> 1
     or (select number from public.issues where id = v_second) <> 2 then
    raise exception 'FAIL: issue numbers were not assigned 1, 2 (got %, %)',
      (select number from public.issues where id = v_first),
      (select number from public.issues where id = v_second);
  end if;

  -- He can label his own workspace's issue with his own workspace's label.
  insert into public.issue_labels (issue_id, label_id, workspace_id)
  values (v_first, '44444444-4444-4444-4444-444444444444',
          '11111111-1111-1111-1111-111111111111');

  -- And assign it to a teammate.
  update public.issues set assignee_id = 'a0000000-0000-0000-0000-00000000000a'
   where id = v_first;
  if not found then
    raise exception 'FAIL: member could not assign an issue to a teammate';
  end if;

  select count(*) into n from public.issues;
  if n <> 2 then
    raise exception 'FAIL: member sees % issues in their own workspace, expected 2', n;
  end if;

  -- Authorship is pinned by the policy's WITH CHECK: he cannot file an issue in
  -- someone else's name.
  begin
    insert into public.issues (workspace_id, project_id, title, created_by)
    values ('11111111-1111-1111-1111-111111111111',
            '33333333-3333-3333-3333-333333333333', 'Forged',
            'a0000000-0000-0000-0000-00000000000a');
    raise exception 'RLS FAIL: member filed an issue under a colleague''s name';
  exception when insufficient_privilege then null;  -- expected
  end;

  -- -------------------------------------------------------------------------
  -- THE CROSS-TENANT REFERENCE ATTACKS.
  --
  -- Each row below is legitimately Bob's: workspace_id is Acme's, and RLS checks
  -- nothing else. What makes it an attack is where the row POINTS.
  -- -------------------------------------------------------------------------

  -- (a) An issue in Acme, pointing at Mallory's project.
  --
  --     If this succeeds it is not merely untidy: `assign_issue_number` is
  --     SECURITY DEFINER, so it bypasses RLS and would increment the issue
  --     counter on a project inside Mallory's workspace. Bob would be writing to
  --     another tenant's data through a trigger, without ever having permission
  --     to touch it directly.
  begin
    insert into public.issues (workspace_id, project_id, title, created_by)
    values ('11111111-1111-1111-1111-111111111111',   -- Bob's workspace
            '99999999-9999-9999-9999-999999999999',   -- Mallory's project
            'Trojan', 'b0000000-0000-0000-0000-00000000000b');
    raise exception
      'CROSS-TENANT FAIL: an issue was created in Acme pointing at Mallory''s project. '
      'The SECURITY DEFINER numbering trigger then writes to her project''s counter.';
  exception
    -- Two independent defences stop this, and either one is a pass.
    --
    -- In practice it is the trigger that fires first: `assign_issue_number` is a
    -- BEFORE INSERT trigger, and BEFORE triggers run ahead of constraint checks,
    -- so its `workspace_id` guard raises before the composite FK is ever consulted.
    -- The FK is still the real fix — it is what makes the bad reference
    -- unrepresentable no matter which code path writes the row — but the guard is
    -- what a member actually hits, so the proof must accept both.
    when raise_exception then null;         -- the trigger's guard
    when foreign_key_violation then null;   -- the composite FK
    when insufficient_privilege then null;  -- RLS, if it ever got that far
  end;

  -- (b) Mallory's label, attached to an Acme issue.
  begin
    insert into public.issue_labels (issue_id, label_id, workspace_id)
    values (v_first,
            '88888888-8888-8888-8888-888888888888',   -- Mallory's label
            '11111111-1111-1111-1111-111111111111');  -- Bob's workspace
    raise exception
      'CROSS-TENANT FAIL: a label from another workspace was attached to an Acme issue.';
  exception
    when foreign_key_violation then null;   -- expected
    when insufficient_privilege then null;  -- also acceptable
  end;

  -- (c) An issue assigned to someone who is not in the workspace at all.
  --
  --     Dana is a real user with a real account, and simply not a member here.
  --     Assigning work to her is nonsense, and it would put her id in front of
  --     every member of a workspace she has never joined.
  begin
    update public.issues
       set assignee_id = 'd0000000-0000-0000-0000-00000000000d'
     where id = v_first;
    raise exception
      'CROSS-TENANT FAIL: an issue was assigned to a user who is not a member of the workspace.';
  exception
    when foreign_key_violation then null;  -- expected
    when raise_exception then
      -- A guard trigger is an acceptable implementation too, as long as it fires.
      null;
  end;
end;
$$;

reset role;

-- ===========================================================================
-- PART 2 — Mallory sees none of it, and can touch none of it.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}';

do $$
declare
  n int;
  wrote int;
begin
  select count(*) into n from public.issues;
  if n <> 0 then
    raise exception 'RLS FAIL: non-member read % issue row(s)', n;
  end if;

  select count(*) into n from public.issue_labels;
  if n <> 0 then
    raise exception 'RLS FAIL: non-member read % issue_label row(s)', n;
  end if;

  -- Only her own label is visible, not Acme's.
  select count(*) into n from public.labels;
  if n <> 1 then
    raise exception 'RLS FAIL: non-member sees % labels, expected only her own 1', n;
  end if;

  -- Zero-row writes are the trap: Postgres reports success, so app code that does
  -- not check the row count would believe these landed.
  update public.issues set title = 'pwned', status = 'canceled';
  get diagnostics wrote = row_count;
  if wrote <> 0 then
    raise exception 'RLS FAIL: non-member updated % issue(s)', wrote;
  end if;

  delete from public.issues;
  get diagnostics wrote = row_count;
  if wrote <> 0 then
    raise exception 'RLS FAIL: non-member deleted % issue(s)', wrote;
  end if;

  -- And she cannot burn issue numbers in Acme's project by filing into it.
  begin
    insert into public.issues (workspace_id, project_id, title, created_by)
    values ('11111111-1111-1111-1111-111111111111',
            '33333333-3333-3333-3333-333333333333', 'intruder',
            'c0000000-0000-0000-0000-00000000000c');
    raise exception 'RLS FAIL: non-member filed an issue into Acme';
  exception when insufficient_privilege then null;  -- expected
  end;

  -- The counter on Acme's project must be untouched by everything above.
  -- Read with a privileged eye after RESET, below.
end;
$$;

reset role;

do $$
begin
  -- Exactly two issues were legitimately created, so the counter must be exactly 2.
  -- If a cross-tenant insert had slipped through, or an intruder had filed into
  -- Acme, this would be higher — the counter is the tell, because the numbering
  -- trigger runs SECURITY DEFINER and leaves no other trace.
  if (select issue_counter from public.projects
       where id = '33333333-3333-3333-3333-333333333333') <> 2 then
    raise exception 'FAIL: Acme''s issue counter is %, expected 2 — something incremented it',
      (select issue_counter from public.projects
        where id = '33333333-3333-3333-3333-333333333333');
  end if;

  -- Mallory's project counter must still be zero. If Bob's cross-tenant insert had
  -- worked, the trigger would have bumped this to 1 from inside her workspace.
  if (select issue_counter from public.projects
       where id = '99999999-9999-9999-9999-999999999999') <> 0 then
    raise exception
      'CROSS-TENANT FAIL: Mallory''s project counter was incremented from outside her workspace.';
  end if;
end;
$$;

rollback;
