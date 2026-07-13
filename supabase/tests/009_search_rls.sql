-- RLS PROOF: full-text search.
--
-- Search is the easiest place in an app to leak a whole database, because it is the
-- one feature whose entire job is to reach across everything and pull back matches.
-- `search_issues` is an RPC, and an RPC is a door: it is called by name, with
-- arguments the caller chooses, including the workspace to search.
--
-- Two things have to hold, and only one of them is obvious:
--
--   1. Mallory searching Acme's workspace id gets nothing. She can simply pass it —
--      it is in the URL of anyone who has ever used the app.
--
--   2. The function is SECURITY INVOKER. It is a one-word change to make it
--      SECURITY DEFINER — and people make it constantly, because DEFINER is what you
--      reach for when a function "does not have permission". It would run as its
--      owner, RLS would not apply, and this function would happily return every issue
--      in every workspace to anybody who asked. Part 3 is that check, and it fails if
--      anyone ever "fixes" it that way.
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

insert into public.workspaces (id, name, slug, created_by) values
  ('11111111-1111-1111-1111-111111111111', 'Acme', 'acme',
   'a0000000-0000-0000-0000-00000000000a'),
  ('22222222-2222-2222-2222-222222222222', 'Mallory Co', 'mallory-co',
   'c0000000-0000-0000-0000-00000000000c');

insert into public.projects (id, workspace_id, name, key) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111', 'Platform', 'PLAT'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '22222222-2222-2222-2222-222222222222', 'Mallory Platform', 'MPLAT');

-- Acme's secrets. Every one of them mentions "acquisition".
insert into public.issues (workspace_id, project_id, title, description, created_by) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Acquisition due diligence', 'Confidential. Numbers for the board.',
   'a0000000-0000-0000-0000-00000000000a'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Refactor the billing module', 'Mentions the acquisition only in passing.',
   'a0000000-0000-0000-0000-00000000000a');

insert into public.issues (workspace_id, project_id, title, description, created_by) values
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'Mallory''s own acquisition notes', 'Hers.',
   'c0000000-0000-0000-0000-00000000000c');

-- ===========================================================================
-- PART 1 — MALLORY SEARCHES ACME. THE POINT OF THIS FILE.
--
-- She passes Acme's workspace id, which she is perfectly able to do.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}';

do $$
declare
  n int;
begin
  select count(*) into n
    from public.search_issues('11111111-1111-1111-1111-111111111111', 'acquisition');

  if n <> 0 then
    raise exception
      'RLS FAIL: a non-member searched another workspace and got % issue(s) back. '
      'Check that search_issues is SECURITY INVOKER — as DEFINER it bypasses RLS and '
      'returns every issue in the database to anyone who asks.', n;
  end if;

  -- And searching with no workspace filter at all must not reach across tenants
  -- either: her own workspace, her own issue, nothing of Acme's.
  select count(*) into n
    from public.search_issues('22222222-2222-2222-2222-222222222222', 'acquisition');

  if n <> 1 then
    raise exception 'FAIL: Mallory should find exactly her own 1 issue, found %', n;
  end if;
end;
$$;

reset role;

-- ===========================================================================
-- PART 2 — Alice searches her own workspace, and search actually works.
--
-- Without this half, a function that returns nothing to anybody would pass Part 1.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

do $$
declare
  n int;
  top text;
begin
  select count(*) into n
    from public.search_issues('11111111-1111-1111-1111-111111111111', 'acquisition');

  if n <> 2 then
    raise exception 'FAIL: a member searching their own workspace found % of 2 issues', n;
  end if;

  -- Ranking, not just matching. The word is in one issue's TITLE and the other's
  -- description, and the title match must come first — that is what the 'A'/'B'
  -- weights in the generated column are for. Without them both rank identically and
  -- "search" is just "filter in an arbitrary order".
  select title into top
    from public.search_issues('11111111-1111-1111-1111-111111111111', 'acquisition')
   limit 1;

  if top <> 'Acquisition due diligence' then
    raise exception
      'FAIL: the title match did not rank first (got "%"). Check the setweight() '
      'calls on issues.search_vector.', top;
  end if;

  -- English stemming: "diligence" must be found by searching "diligent", or the
  -- feature is `ILIKE` wearing a tsvector costume.
  select count(*) into n
    from public.search_issues('11111111-1111-1111-1111-111111111111', 'refactoring billing');
  if n <> 1 then
    raise exception 'FAIL: stemmed search for "refactoring billing" found % issues, expected 1', n;
  end if;

  -- A query full of punctuation must return nothing, NOT raise. `to_tsquery` throws a
  -- syntax error on input like this, which would turn a stray keystroke in the search
  -- box into a 500. `websearch_to_tsquery` is the one that never throws.
  perform public.search_issues('11111111-1111-1111-1111-111111111111', 'the & | ! <-> ((');
  perform public.search_issues('11111111-1111-1111-1111-111111111111', '');
end;
$$;

reset role;

-- ===========================================================================
-- PART 3 — The function must be SECURITY INVOKER.
--
-- Asserted directly against the catalog, not inferred from behaviour. Part 1 would
-- also catch a DEFINER function today, but only because Mallory happens to exist in
-- this proof; this is the check that says WHY, in a way that cannot be accidentally
-- weakened.
-- ===========================================================================
do $$
declare
  is_definer boolean;
begin
  select p.prosecdef into is_definer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'search_issues';

  if is_definer is null then
    raise exception 'FAIL: public.search_issues does not exist';
  end if;

  if is_definer then
    raise exception
      'SECURITY FAIL: search_issues is SECURITY DEFINER. It runs as its owner, so RLS '
      'does not apply and it returns every issue in every workspace to any caller. '
      'It must be SECURITY INVOKER.';
  end if;
end;
$$;

rollback;
