# Nucleus

An open-source issue tracker for teams — projects, a keyboard-driven kanban board, threaded
comments, and live updates. Built on Next.js 16 and Supabase, and designed to run entirely on
Supabase's free tier.

> **Status: in progress.** Auth, the database schema, and multi-tenant RLS are done and proven.
> Workspaces, projects, issues, the board, comments, search, and the command palette are still
> being built. See "Build order" below.

## Stack

Next.js 16 (App Router, TypeScript strict) · Supabase (Postgres, Auth, RLS, Realtime) ·
Tailwind CSS + shadcn/ui · Zod · dnd-kit

## Getting started

**1. Install dependencies**

```bash
npm install
```

**2. Create a Supabase project** (the free tier is enough) at
[supabase.com/dashboard](https://supabase.com/dashboard).

**3. Configure the environment**

```bash
cp .env.example .env.local
```

Fill in the project URL and the **publishable** key from Project Settings → API Keys.
Nucleus never uses the secret/service-role key — see "Security" below.

**4. Apply the database schema**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run db:push       # applies supabase/migrations/
npm run db:types      # regenerates src/lib/types/database.types.ts
```

**5. Two dashboard settings**

- **Authentication → Sign In / Providers → Email**: disable *Confirm email* for local development
  so signup is instant. **Re-enable it before deploying.**
- **Authentication → Passwords**: enable *Leaked password protection*. Recommended.

**6. Run it**

```bash
npm run dev
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run check` | Typecheck + lint. Must be clean. |
| `npm run db:push` | Apply migrations to the linked project |
| `npm run db:types` | Regenerate TypeScript types from the schema |
| `npm run db:verify` | **Run the RLS proofs** (see below) |

## Security

Multi-tenancy is enforced by **Row Level Security in the database**, never by the UI. A user
cannot read or write another workspace's data even if the frontend is bypassed entirely.

That claim is tested, not asserted. `supabase/tests/` holds SQL proofs that create real users,
drop to the `authenticated` role, and assert that a **non-member receives zero rows** from every
tenant-scoped table — and that they cannot insert, update, delete, or add themselves to a
workspace they don't belong to. Run them against your database at any time:

```bash
npm run db:verify
```

They run inside a transaction that always rolls back, so they are safe against a live database.
They have been mutation-tested: deliberately weakening a policy makes them fail.

Other invariants:

- The **service-role key is never used**, and is not even defined in `src/lib/env.ts`. It bypasses
  RLS; if a query appears to need it, the policy is wrong.
- **No Supabase calls in components or routes.** All access goes through `src/lib/data/*`, and
  ESLint enforces it rather than trusting code review.
- Authorization never reads `user_metadata`, which is user-editable.

## Where things live

See [CLAUDE.md](./CLAUDE.md) for the architecture map and the non-obvious Postgres/Supabase
gotchas this codebase has already run into.

## Build order

- [x] Scaffold
- [x] Auth + profiles
- [x] Schema + RLS core
- [ ] Workspaces (create, invite by code/email, members)
- [ ] Projects
- [ ] Issues
- [ ] Kanban board + Realtime
- [ ] Comments + activity feed
- [ ] Full-text search
- [ ] Keyboard shortcuts + saved views
- [ ] Polish

## License

MIT
