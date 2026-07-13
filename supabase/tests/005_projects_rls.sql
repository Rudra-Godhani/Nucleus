-- RLS PROOF: projects.
--
-- Projects are the first thing built on top of the workspace boundary, so this
-- proof is mostly about confirming that boundary still holds one level down: a
-- non-member sees zero projects, cannot create one, and cannot reach into a
-- workspace they do not belong to.
--
-- It also pins the thing that broke workspace creation: INSERT ... RETURNING.
--
-- Workspaces fail on RETURNING because the row only becomes visible via an AFTER
-- INSERT trigger that has not fired yet. Projects should NOT have that problem —
-- their SELECT policy is plain workspace membership, which is already true before
-- the insert. But "should" is how the last bug got in, so it is asserted rather
-- than assumed: if this ever starts failing, `lib/data/projects.ts` needs the same
-- insert-then-reread treatment `workspaces.ts` has.
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

-- Alice owns Acme; Bob is a plain member. Mallory owns her own unrelated workspace.
insert into public.workspaces (id, name, slug, created_by) values
  ('11111111-1111-1111-1111-111111111111', 'Acme', 'acme',
   'a0000000-0000-0000-0000-00000000000a'),
  ('22222222-2222-2222-2222-222222222222', 'Mallory Co', 'mallory-co',
   'c0000000-0000-0000-0000-00000000000c');

insert into public.workspace_members (workspace_id, user_id, role)
values ('11111111-1111-1111-1111-111111111111',
        'b0000000-0000-0000-0000-00000000000b', 'member');

-- ===========================================================================
-- PART 1 — A member can actually use the feature.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}';

do $$
declare
  v_id uuid;
  n int;
begin
  -- THE REGRESSION GUARD. This is exactly the statement PostgREST emits when the
  -- client chains .select() onto an insert, and it is what silently broke
  -- workspace creation. Projects must survive it: their SELECT policy is
  -- membership, which is already satisfied, so no AFTER INSERT trigger stands
  -- between the row and its own creator.
  insert into public.projects (workspace_id, name, key)
  values ('11111111-1111-1111-1111-111111111111', 'Platform', 'PLAT')
  returning id into v_id;

  if v_id is null then
    raise exception 'FAIL: INSERT ... RETURNING gave no row back to its creator';
  end if;

  -- A plain member (not just an admin) can create projects. Projects are working
  -- material, not administration.
  select count(*) into n from public.projects;
  if n <> 1 then
    raise exception 'FAIL: member sees % projects in their own workspace, expected 1', n;
  end if;

  -- The issue counter starts at zero and is not something the client sets.
  if (select issue_counter from public.projects where id = v_id) <> 0 then
    raise exception 'FAIL: new project did not start with issue_counter = 0';
  end if;

  -- Keys are unique per workspace: two projects called PLAT would make issue
  -- identifiers like PLAT-14 ambiguous, which is the whole point of having them.
  begin
    insert into public.projects (workspace_id, name, key)
    values ('11111111-1111-1111-1111-111111111111', 'Platform Two', 'PLAT');
    raise exception 'FAIL: duplicate project key accepted within one workspace';
  exception when unique_violation then null;  -- expected
  end;

  -- The same key in a *different* workspace is fine — keys are scoped, not global.
  -- (Asserted from Mallory's side below; here we only confirm Bob cannot do it.)

  -- A member cannot create a project inside a workspace they do not belong to.
  begin
    insert into public.projects (workspace_id, name, key)
    values ('22222222-2222-2222-2222-222222222222', 'Trojan', 'TROJ');
    raise exception 'RLS FAIL: member created a project in a foreign workspace';
  exception when insufficient_privilege then null;  -- expected
  end;

  -- Nor move an existing one into somebody else's workspace.
  begin
    update public.projects
       set workspace_id = '22222222-2222-2222-2222-222222222222'
     where id = v_id;
    if found then
      raise exception 'RLS FAIL: member moved a project into a foreign workspace';
    end if;
  exception when insufficient_privilege then null;  -- expected
  end;

  -- A plain member may NOT delete a project — that is an admin power, because
  -- deleting one takes every issue in it along.
  delete from public.projects where id = v_id;
  if found then
    raise exception 'RLS FAIL: a plain member deleted a project';
  end if;
end;
$$;

reset role;

-- ===========================================================================
-- PART 2 — Mallory is signed in and owns a workspace, but is not in Acme.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}';

do $$
declare
  n int;
  wrote int;
begin
  -- ZERO rows. Not "no projects of hers" — none of Acme's, at all.
  select count(*) into n from public.projects;
  if n <> 0 then
    raise exception 'RLS FAIL: non-member read % project row(s) from another workspace', n;
  end if;

  -- Reusing a key that exists in Acme must be fine — keys are scoped per
  -- workspace, and a collision across tenants would leak the fact that Acme has a
  -- project called PLAT.
  insert into public.projects (workspace_id, name, key)
  values ('22222222-2222-2222-2222-222222222222', 'Platform', 'PLAT');

  select count(*) into n from public.projects;
  if n <> 1 then
    raise exception 'FAIL: Mallory should see only her own 1 project, saw %', n;
  end if;

  -- She cannot rename or delete Acme's project, and Postgres reports zero rows
  -- rather than an error — which is why this is asserted rather than trusted.
  update public.projects set name = 'pwned'
   where workspace_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics wrote = row_count;
  if wrote <> 0 then
    raise exception 'RLS FAIL: non-member updated % of Acme''s project(s)', wrote;
  end if;

  delete from public.projects
   where workspace_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics wrote = row_count;
  if wrote <> 0 then
    raise exception 'RLS FAIL: non-member deleted % of Acme''s project(s)', wrote;
  end if;
end;
$$;

reset role;

-- ===========================================================================
-- PART 3 — An owner/admin can delete, so the policy is not simply "nobody".
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

do $$
declare
  v_id uuid;
begin
  select id into v_id from public.projects
   where workspace_id = '11111111-1111-1111-1111-111111111111';

  delete from public.projects where id = v_id;
  if not found then
    raise exception 'FAIL: the workspace owner could not delete a project';
  end if;
end;
$$;

reset role;

rollback;
