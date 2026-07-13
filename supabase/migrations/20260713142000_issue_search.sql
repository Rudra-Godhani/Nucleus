-- Full-text search over issues, in Postgres.
--
-- Not `ilike '%term%'`, and not filtering an array in the browser. Both look fine on
-- twenty issues and fall over on twenty thousand: `ilike` cannot use an index for a
-- leading wildcard, so it reads every row in the workspace, and client-side filtering
-- means shipping every row in the workspace to the browser in the first place —
-- which is a performance problem wearing a privacy problem's clothes.

-- ---------------------------------------------------------------------------
-- The vector
-- ---------------------------------------------------------------------------
-- A stored generated column, so it can never disagree with the row it describes.
-- The alternative — a trigger that maintains a plain tsvector column — has one more
-- moving part and exactly one failure mode: somebody writes to `title` in a path that
-- forgets to run it, and search quietly goes stale on precisely the rows that changed.
--
-- `to_tsvector('english', ...)` with the config named EXPLICITLY. The single-argument
-- form reads `default_text_search_config`, which is a per-session setting, which makes
-- it STABLE rather than IMMUTABLE — and Postgres flatly refuses to build a generated
-- column out of a non-immutable expression. The error ("generation expression is not
-- immutable") does not mention text search at all, so this is worth knowing before you
-- meet it.
--
-- `coalesce`, because description is nullable and `to_tsvector(null)` is null, which
-- would null the whole concatenated vector and silently make the issue unsearchable
-- by its title.
--
-- setweight A/B is what turns matching into ranking. A word in the title means the
-- issue is ABOUT that word; the same word in the description might be an aside. Give
-- them equal weight and the results come back in an arbitrary order, which is a filter
-- pretending to be a search.
alter table public.issues
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;

-- GIN, not GiST: GIN is slower to update and far faster to search, and issues are
-- searched much more often than they are written.
create index issues_search_idx on public.issues using gin (search_vector);

-- ---------------------------------------------------------------------------
-- The query
-- ---------------------------------------------------------------------------
-- An RPC rather than a PostgREST filter, for one reason: ORDER BY ts_rank. PostgREST
-- can express `search_vector @@ websearch_to_tsquery(...)` perfectly well, but it
-- cannot order by a rank it has to compute — and unranked full-text search is not
-- worth having.
--
-- SECURITY INVOKER. This is the whole security model of this function and it is a
-- single word: it runs as the CALLER, so the RLS policy on `issues` applies exactly as
-- it does everywhere else, and a non-member searching another workspace gets zero rows
-- without this function containing a single line of authorization logic.
--
-- Do not "fix" a permission error here by making it SECURITY DEFINER. It would run as
-- its owner, RLS would not apply, and this would return every issue in every workspace
-- to any signed-in caller. supabase/tests/009 asserts `prosecdef = false` directly
-- against the catalog for exactly that reason.
--
-- `websearch_to_tsquery`, not `to_tsquery` or `plainto_tsquery`:
--   * `to_tsquery` RAISES a syntax error on input like `&` or `((` — so a stray
--     keystroke in a search box becomes a 500.
--   * `plainto_tsquery` never throws but ANDs every word, so it cannot express a
--     phrase or a negation.
--   * `websearch_to_tsquery` never throws, and understands what people already type
--     into search boxes: "quoted phrases", OR, and -excluded.
create or replace function public.search_issues(workspace uuid, q text)
returns setof public.issues
language sql
stable
-- Explicit, though it is the default. This is the one line in the file that must
-- never change, so it should be visible rather than implied.
security invoker
set search_path = ''
as $$
  select i.*
    from public.issues i
   where i.workspace_id = workspace
     and i.search_vector @@ websearch_to_tsquery('english', q)
   order by ts_rank_cd(i.search_vector, websearch_to_tsquery('english', q)) desc,
            i.created_at desc
   limit 50;
$$;

-- Callable by signed-in users. `anon` is not granted: there is nothing for a signed-out
-- visitor to search, and RLS would give them nothing anyway — but a door that opens
-- onto a wall is still a door, and this one stays shut.
revoke execute on function public.search_issues(uuid, text) from public, anon;
grant execute on function public.search_issues(uuid, text) to authenticated;
