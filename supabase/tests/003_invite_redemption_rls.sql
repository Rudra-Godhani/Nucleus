-- RLS PROOF: invite redemption.
--
-- redeem_invite() is the one function in Nucleus that bypasses RLS, so it is the
-- one place a privilege-escalation bug could hide. This proof attacks it.
--
-- It must be possible to join with a valid code — and impossible to:
--   * join with a wrong/garbage code
--   * join with an expired code
--   * redeem someone else's email-addressed invite
--   * reuse a single-use invite
--   * escalate your role beyond what the invite grants
--   * demote an existing member by replaying an old code
--   * see a workspace you have not joined
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

-- Alice owns Acme (the on_workspace_created trigger makes her owner).
insert into public.workspaces (id, name, slug, created_by)
values ('11111111-1111-1111-1111-111111111111', 'Acme', 'acme',
        'a0000000-0000-0000-0000-00000000000a');

insert into public.workspace_invites (workspace_id, code, email, role, created_by, expires_at)
values
  -- A shareable join code: no email, reusable.
  ('11111111-1111-1111-1111-111111111111', 'SHAREABLE-CODE', null, 'member',
   'a0000000-0000-0000-0000-00000000000a', now() + interval '7 days'),
  -- Addressed to Bob only.
  ('11111111-1111-1111-1111-111111111111', 'BOB-ONLY-CODE', 'bob@rls-proof.test', 'member',
   'a0000000-0000-0000-0000-00000000000a', now() + interval '7 days'),
  -- Already expired.
  ('11111111-1111-1111-1111-111111111111', 'EXPIRED-CODE', null, 'member',
   'a0000000-0000-0000-0000-00000000000a', now() - interval '1 day'),
  -- An admin-level invite, used below to prove the role comes from the invite.
  ('11111111-1111-1111-1111-111111111111', 'ADMIN-CODE', null, 'admin',
   'a0000000-0000-0000-0000-00000000000a', now() + interval '7 days');

-- ===========================================================================
-- PART 1 — Mallory, a signed-in stranger, tries to break in.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}';

do $$
declare
  n int;
begin
  -- She cannot see the workspace, nor any invite to it. (Belt and braces: this
  -- is also covered by 002, but if it regressed, everything below is theatre.)
  select count(*) into n from public.workspaces;
  if n <> 0 then raise exception 'RLS FAIL: stranger sees % workspace(s)', n; end if;
  select count(*) into n from public.workspace_invites;
  if n <> 0 then raise exception 'RLS FAIL: stranger sees % invite(s)', n; end if;

  -- Garbage code -> rejected.
  begin
    perform public.redeem_invite('NOT-A-REAL-CODE');
    raise exception 'FAIL: a garbage invite code was accepted';
  exception when others then
    if sqlerrm not like '%invalid or has expired%' then raise; end if;
  end;

  -- Expired code -> rejected.
  begin
    perform public.redeem_invite('EXPIRED-CODE');
    raise exception 'FAIL: an expired invite code was accepted';
  exception when others then
    if sqlerrm not like '%invalid or has expired%' then raise; end if;
  end;

  -- Bob's email-addressed invite is not hers to use, even though she has the code.
  begin
    perform public.redeem_invite('BOB-ONLY-CODE');
    raise exception 'FAIL: Mallory redeemed an invite addressed to Bob';
  exception when others then
    if sqlerrm not like '%invalid or has expired%' then raise; end if;
  end;

  -- None of those may have quietly let her in.
  select count(*) into n from public.workspace_members
   where user_id = 'c0000000-0000-0000-0000-00000000000c';
  if n <> 0 then
    raise exception 'RLS FAIL: Mallory is a member of % workspace(s) after failed redemptions', n;
  end if;

  -- get_my_pending_invites() must not show her invites addressed to other people.
  select count(*) into n from public.get_my_pending_invites();
  if n <> 0 then
    raise exception 'RLS FAIL: get_my_pending_invites() leaked % invite(s) to a stranger', n;
  end if;
end;
$$;

reset role;

-- ===========================================================================
-- PART 2 — Bob redeems the invite that IS addressed to him. The happy path must
-- work, or the proof above passes for the wrong reason.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}';

do $$
declare
  v_slug text;
  v_role public.member_role;
  n int;
begin
  -- He can see it pending, with the workspace name — even though he is not yet a
  -- member and cannot select the workspace directly.
  select count(*) into n from public.get_my_pending_invites();
  if n <> 1 then
    raise exception 'FAIL: Bob should see exactly 1 pending invite, saw %', n;
  end if;

  v_slug := public.redeem_invite('BOB-ONLY-CODE');
  if v_slug <> 'acme' then
    raise exception 'FAIL: redeem_invite returned slug %, expected acme', v_slug;
  end if;

  -- He is now a member, with the role the invite specified.
  select role into v_role from public.workspace_members
   where workspace_id = '11111111-1111-1111-1111-111111111111'
     and user_id = 'b0000000-0000-0000-0000-00000000000b';
  if v_role is distinct from 'member'::public.member_role then
    raise exception 'FAIL: Bob joined with role %, expected member', v_role;
  end if;

  -- And can now see the workspace.
  if (select count(*) from public.workspaces) <> 1 then
    raise exception 'FAIL: Bob cannot see Acme after joining';
  end if;

  -- Single-use: replaying his own code must not work a second time.
  begin
    perform public.redeem_invite('BOB-ONLY-CODE');
    raise exception 'FAIL: a single-use invite was redeemed twice';
  exception when others then
    if sqlerrm not like '%invalid or has expired%' then raise; end if;
  end;

  -- THE ESCALATION TEST: Bob is a plain member. He has the ADMIN-CODE (say it
  -- leaked). Redeeming it must not upgrade him — an existing membership is never
  -- overwritten, or any leaked code becomes a promotion.
  perform public.redeem_invite('ADMIN-CODE');
  select role into v_role from public.workspace_members
   where workspace_id = '11111111-1111-1111-1111-111111111111'
     and user_id = 'b0000000-0000-0000-0000-00000000000b';
  if v_role is distinct from 'member'::public.member_role then
    raise exception 'ESCALATION: Bob upgraded himself to % by replaying an admin invite', v_role;
  end if;

  -- A plain member may not mint invites: that is an admin power.
  begin
    insert into public.workspace_invites (workspace_id, code, created_by)
    values ('11111111-1111-1111-1111-111111111111', 'BOBS-OWN-CODE',
            'b0000000-0000-0000-0000-00000000000b');
    raise exception 'FAIL: a non-admin member created an invite';
  exception when insufficient_privilege then null;  -- expected
  end;
end;
$$;

reset role;

-- ===========================================================================
-- PART 3 — The owner must not be demotable by replaying a lesser code, the
-- shareable code must still work for a second person, and an admin must actually
-- be able to MINT an invite.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

do $$
declare
  v_role public.member_role;
  v_code text;
begin
  -- An admin can create an invite WITHOUT supplying a code, i.e. letting the
  -- column default generate one.
  --
  -- Every invite above was seeded with an explicit code, so the default was never
  -- exercised — and that is exactly how a real bug got through: the default calls
  -- private.generate_invite_code(), a column default runs as the *inserting* role,
  -- and EXECUTE had been revoked from `authenticated`. Every invite insert failed
  -- with "permission denied for function" while all the proofs stayed green.
  insert into public.workspace_invites (workspace_id, created_by)
  values ('11111111-1111-1111-1111-111111111111',
          'a0000000-0000-0000-0000-00000000000a')
  returning code into v_code;

  if v_code is null or length(v_code) < 16 then
    raise exception 'FAIL: generated invite code is missing or too short: %',
      coalesce(v_code, '<NULL>');
  end if;

  -- Alice is the owner. Redeeming a 'member' code must not demote her.
  perform public.redeem_invite('SHAREABLE-CODE');
  select role into v_role from public.workspace_members
   where workspace_id = '11111111-1111-1111-1111-111111111111'
     and user_id = 'a0000000-0000-0000-0000-00000000000a';
  if v_role is distinct from 'owner'::public.member_role then
    raise exception 'FAIL: the owner was demoted to % by replaying a member invite', v_role;
  end if;
end;
$$;

reset role;

-- Mallory now uses the *shareable* code, which is legitimately open to anyone
-- holding it. This confirms reusable codes are actually reusable — the earlier
-- rejections were about validity, not a function that simply never works.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}';

do $$
declare
  v_role public.member_role;
begin
  perform public.redeem_invite('SHAREABLE-CODE');
  select role into v_role from public.workspace_members
   where workspace_id = '11111111-1111-1111-1111-111111111111'
     and user_id = 'c0000000-0000-0000-0000-00000000000c';
  if v_role is distinct from 'member'::public.member_role then
    raise exception 'FAIL: shareable code did not admit Mallory as a member (got %)', v_role;
  end if;
end;
$$;

reset role;

rollback;
