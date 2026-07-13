-- RLS PROOF: a signed-in user can actually create a workspace.
--
-- This exists because of a bug that all three earlier proofs missed, and which
-- only showed up when the real app tried to create a workspace through PostgREST.
--
-- The earlier proofs seeded workspaces as a privileged role, so the interesting
-- path — an ordinary `authenticated` user inserting one — was never exercised.
-- Worse, a plain INSERT works fine. The failure only appears with RETURNING:
--
--   * The SELECT policy on `workspaces` requires membership.
--   * Membership is created by `on_workspace_created`, an AFTER INSERT trigger.
--   * RETURNING is evaluated BEFORE that trigger fires.
--   * So for that instant the creator cannot see their own row, and Postgres
--     rejects the statement with "new row violates row-level security policy" —
--     which reads like a WITH CHECK failure and sends you hunting in the wrong
--     place entirely.
--
-- PostgREST issues INSERT ... RETURNING whenever the client asks for the row
-- back, so this is the *normal* path from the app, not an exotic one.
--
-- The data layer therefore inserts without returning and re-reads the row. This
-- proof pins both halves: the plain insert must work, and the creator must end up
-- owner and able to see the workspace.

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('d0000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'dana@rls-proof.test', 'x', now(), now(), now(),
        '{}'::jsonb, '{"display_name":"Dana"}'::jsonb);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}';

do $$
declare
  v_id uuid;
  v_role public.member_role;
  n int;
begin
  -- 1. An ordinary user can create a workspace (no RETURNING — this is what the
  --    data layer does).
  insert into public.workspaces (name, slug, created_by)
  values ('Dana Co', 'dana-co', 'd0000000-0000-0000-0000-00000000000d');

  -- 2. The trigger made them the OWNER. If this regressed, a user could create a
  --    workspace they cannot then access — it would exist and be unreachable.
  select w.id into v_id from public.workspaces w where w.slug = 'dana-co';
  if v_id is null then
    raise exception 'FAIL: creator cannot see the workspace they just created';
  end if;

  select m.role into v_role from public.workspace_members m
   where m.workspace_id = v_id and m.user_id = 'd0000000-0000-0000-0000-00000000000d';
  if v_role is distinct from 'owner'::public.member_role then
    raise exception 'FAIL: creator ended up with role %, expected owner', v_role;
  end if;

  -- 3. They may not create one in somebody else's name — WITH CHECK pins
  --    created_by, and the ownership trigger would otherwise hand the workspace
  --    to whoever was named.
  begin
    insert into public.workspaces (name, slug, created_by)
    values ('Forged', 'forged-co', 'a0000000-0000-0000-0000-00000000000a');
    raise exception 'FAIL: a user created a workspace owned by someone else';
  exception when insufficient_privilege then null;  -- expected
  end;

  -- 4. THE REGRESSION GUARD. INSERT ... RETURNING is what PostgREST emits when
  --    the client asks for the row back. It must fail, because the SELECT policy
  --    cannot see the row until the AFTER INSERT trigger has granted membership.
  --    If this ever starts succeeding, the SELECT policy has been loosened —
  --    which is worth knowing about, because the obvious way to "fix" the bug
  --    above is to add `or created_by = auth.uid()` to it, and that would let an
  --    owner who left the workspace keep seeing it.
  begin
    insert into public.workspaces (name, slug, created_by)
    values ('Returning', 'returning-co', 'd0000000-0000-0000-0000-00000000000d')
    returning id into v_id;
    raise exception
      'UNEXPECTED: INSERT ... RETURNING now succeeds. The workspaces SELECT policy '
      'has changed. Re-check that a non-member (and an ex-member) still cannot see '
      'the workspace, then update lib/data/workspaces.ts and this proof.';
  exception when insufficient_privilege then null;  -- expected, for now
  end;

  -- 5. And the creator sees exactly their own workspace, not everyone's.
  select count(*) into n from public.workspaces;
  if n <> 1 then
    raise exception 'FAIL: creator sees % workspaces, expected exactly 1', n;
  end if;
end;
$$;

reset role;

rollback;
