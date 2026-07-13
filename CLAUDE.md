# Nucleus

An open-source issue tracker for teams (Linear/Jira-style). Next.js 16 App Router + Supabase.

## Read before writing code

- **Next.js 16 is not the Next.js in your training data.** Read the version-matched docs in
  `node_modules/next/dist/docs/` before using a framework API. See also @AGENTS.md.
- **Supabase changes frequently.** Look up current docs before writing Supabase code — do not
  rely on memory. The `supabase` skill in `.claude/skills/` explains how.

## Architecture

| Where | What |
|---|---|
| `src/app/` | Routes. Server Components by default. |
| `src/components/` | UI. `ui/` is shadcn primitives; the rest is feature UI. Dumb — no data access. |
| `src/lib/data/` | **The only place Supabase is queried.** Named functions, one file per entity. |
| `src/lib/supabase/` | Client factories (`server.ts`, `client.ts`). Used only by `lib/data/`. |
| `src/lib/validations/` | Zod schemas, one file per entity. Every input boundary parses here. |
| `src/lib/types/database.types.ts` | Generated from the schema. Never hand-edit. |
| `src/proxy.ts` | Session refresh only (Next 16 renamed Middleware → Proxy). |
| `supabase/migrations/` | All schema + RLS. The database is defined here, not in the dashboard. |
| `supabase/tests/` | SQL proofs that RLS actually isolates tenants. |

## Non-negotiable rules

1. **Tenancy is enforced by RLS in the database, never by the UI.** A user must not be able to
   read or write another workspace's data even if the UI is bypassed entirely. Every
   multi-tenant table gets an RLS proof in `supabase/tests/` showing a non-member gets zero rows.
   Write the proof first, then make it pass.
2. **No Supabase calls in components or routes.** All access goes through `src/lib/data/*`.
   ESLint enforces this (`nucleus/data-layer-boundary`) — it is not just a convention.
3. **Server Components by default.** Add `'use client'` only for interactivity, and leave a
   comment saying *why*.
4. **Every input is validated with Zod.** No `any` (ESLint enforces). TypeScript strict stays on.
5. **Authorization never reads `user_metadata`** — it is user-editable. Use `app_metadata` or a
   membership table.
6. **The service-role key is never used.** It bypasses RLS. If a query seems to need it, the RLS
   policy is wrong. `src/lib/env.ts` does not even define it.
7. **The proxy is not a security boundary.** Next's own docs say it must not be used for session
   management or authorization — it only refreshes the auth token. Real checks live in the
   database (RLS) and in `lib/data/*`.

## Supabase gotchas that will silently bite you

- **New tables in `public` are no longer auto-exposed to the Data API** (changed 2026-04-28).
  Every table needs explicit `GRANT`s to `anon`/`authenticated` *in the migration*, alongside
  RLS. Without the grant, queries fail with `42501`; without RLS, the table is wide open.
- **`UPDATE` needs a matching `SELECT` policy**, or the update silently affects zero rows.
- **`UPDATE` policies: write `WITH CHECK` explicitly.** Not for the reason usually given —
  Postgres reuses `USING` as the `WITH CHECK` when you omit it (verified against this database),
  so omitting it is *not* an instant hole. It matters when the two need to **differ**: `USING`
  says which rows you may target, `WITH CHECK` says what they may become. We always spell both
  out so that distinction stays visible to the next reader.
- **A `SECURITY DEFINER` helper called from a policy must be `EXECUTE`-able by `authenticated`.**
  Policy expressions run as the *calling* role. Revoking EXECUTE (as some guides suggest) makes
  every query fail with "permission denied for function". Safety comes from the function living
  in the unexposed `private` schema and deriving the user from `auth.uid()` internally — not
  from the revoke.
- **Views bypass RLS** unless created `WITH (security_invoker = true)`.
- **Use `getClaims()`** to protect pages — not `getSession()`, which is not guaranteed to
  revalidate the token.

## Commands

```bash
npm run dev          # dev server
npx tsc --noEmit     # must pass with zero errors
npx eslint .         # must pass clean
npm run db:types     # regenerate database.types.ts after ANY schema change
```

## Definition of done

`tsc` clean + linter clean + feature works in the running app + any multi-tenant access covered
by a passing RLS proof.
