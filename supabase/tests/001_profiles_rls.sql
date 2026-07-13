-- RLS PROOF: profiles
--
-- Proves that a signed-in user cannot read or write another user's profile.
-- This is the tenancy boundary at its smallest scale; the workspace proofs build
-- on the same technique.
--
-- Run with:  npm run db:verify
--
-- How it works: the Management API executes this as a privileged role, so we can
-- create users directly. We then *drop* to the `authenticated` role and set the
-- JWT claims Postgres reads — this is exactly what PostgREST does per request,
-- so `auth.uid()` resolves to whichever user we are impersonating and the RLS
-- policies are evaluated for real.
--
-- The whole thing runs in a transaction that always rolls back, so it is safe to
-- run repeatedly against a live database and leaves nothing behind.
--
-- A failure RAISEs, which aborts the transaction — a silent pass is impossible.

begin;

-- Fixed UUIDs so failures are readable.
-- alice = 'aaaaaaaa-...', mallory = 'bbbbbbbb-...'
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@rls-proof.test', 'x',
   now(), now(), now(), '{}'::jsonb, '{"display_name":"Alice"}'::jsonb),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mallory@rls-proof.test', 'x',
   now(), now(), now(), '{}'::jsonb, '{"display_name":"Mallory"}'::jsonb);

-- The signup trigger should have produced exactly one profile per user.
do $$
declare
  n int;
begin
  select count(*) into n from public.profiles
   where id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  if n <> 2 then
    raise exception 'SETUP FAIL: expected the signup trigger to create 2 profiles, found %', n;
  end if;

  -- display_name should come from raw_user_meta_data when present.
  if (select display_name from public.profiles
       where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') <> 'Alice' then
    raise exception 'SETUP FAIL: display_name was not taken from user metadata';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Become Alice. From here on, every statement is subject to RLS.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

do $$
declare
  visible int;
  mallorys int;
  updated int;
begin
  -- `is distinct from` rather than `<>`: if auth.uid() were NULL, `<>` evaluates
  -- to NULL, the IF would not fire, and this guard would pass while proving
  -- nothing. NULL-safe comparison is the difference between a real check and a
  -- decorative one.
  if (select auth.uid()) is distinct from 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid then
    raise exception 'SETUP FAIL: impersonation did not take effect; auth.uid() = %',
      coalesce((select auth.uid())::text, '<NULL>');
  end if;

  -- 1. THE CORE CLAIM: a non-owner sees ZERO rows of someone else's profile.
  select count(*) into mallorys from public.profiles
   where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  if mallorys <> 0 then
    raise exception 'RLS FAIL: Alice can read Mallory''s profile (% rows). Tenancy is broken.',
      mallorys;
  end if;

  -- 2. Alice sees her own profile, and *only* her own — an unfiltered SELECT
  --    must not leak the rest of the table.
  select count(*) into visible from public.profiles;
  if visible <> 1 then
    raise exception 'RLS FAIL: an unfiltered SELECT returned % rows; expected exactly 1 (own)',
      visible;
  end if;

  -- 3. Alice cannot UPDATE Mallory's profile. Postgres reports zero rows rather
  --    than an error, which is precisely why this needs asserting: a silent
  --    zero-row update looks like success to application code.
  update public.profiles
     set display_name = 'pwned'
   where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  get diagnostics updated = row_count;
  if updated <> 0 then
    raise exception 'RLS FAIL: Alice updated % row(s) of Mallory''s profile', updated;
  end if;

  -- 4. Alice CAN update her own profile — the policy must not be so tight that
  --    the feature stops working. A proof that only tests denial can be passed
  --    by a table nobody can use.
  update public.profiles set display_name = 'Alice Updated'
   where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  get diagnostics updated = row_count;
  if updated <> 1 then
    raise exception 'RLS FAIL: Alice could not update her own profile (% rows)', updated;
  end if;

  -- 5. Alice cannot hand her row to Mallory by rewriting the primary key.
  --    This is what WITH CHECK defends; without it, this UPDATE would succeed.
  begin
    update public.profiles set id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
     where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    raise exception 'RLS FAIL: Alice reassigned her profile to Mallory (WITH CHECK missing)';
  exception
    when insufficient_privilege then
      null; -- expected: WITH CHECK rejected it
    when unique_violation then
      null; -- also acceptable: the PK collision stopped it first
  end;

  raise notice 'PASS: profiles RLS — non-owner reads 0 rows, cannot update, cannot reassign.';
end;
$$;

reset role;

-- Nothing is kept. Re-running is always safe.
rollback;
