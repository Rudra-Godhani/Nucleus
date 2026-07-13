-- Profiles
--
-- `auth.users` is owned by Supabase and is not directly readable by clients.
-- `public.profiles` is the application-facing mirror: one row per user, holding
-- the display data other members need to see (name, avatar).
--
-- Scope note: at this step a user may only read their OWN profile. Reading a
-- teammate's profile requires a shared workspace, and workspaces do not exist
-- yet — that policy is added in the workspaces migration. Keeping it locked
-- down until then means there is never a window where profiles are readable by
-- every signed-in user.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Application-facing user record. One row per auth.users row, created by trigger.';

-- Row Level Security ---------------------------------------------------------

alter table public.profiles enable row level security;

-- Since 2026-04-28, new tables in `public` are NOT automatically exposed to the
-- Data API. Without these grants every query fails with 42501, regardless of
-- RLS. Grants decide *whether* a role may touch the table at all; RLS decides
-- *which rows* it sees. Both are required.
grant select, insert, update on table public.profiles to authenticated;
-- `anon` is deliberately granted nothing: profiles are never public.

-- A user may read their own profile.
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- A user may update their own profile, and may not reassign it to someone else.
-- USING controls which rows may be targeted; WITH CHECK controls what the row is
-- allowed to look like afterwards. Without WITH CHECK a user could rewrite `id`
-- and hand their row to another account.
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Profiles are normally created by the trigger below, which runs as the function
-- owner. This INSERT policy is only a backstop, so a signed-in user can re-create
-- a missing profile row — and only their own.
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- No DELETE policy: profiles are removed by `on delete cascade` from auth.users.
-- A user must not be able to delete their profile while their account lives on,
-- which would leave the app with a user that has no display name.

-- Keep `updated_at` honest ---------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- Create a profile whenever a user signs up ----------------------------------

-- SECURITY DEFINER is required here rather than being a shortcut: this trigger
-- fires during signup as `supabase_auth_admin`, which holds no rights on public
-- tables. It accepts no caller-supplied arguments — every value is read from the
-- auth.users row Postgres itself just wrote — so there is no injection surface.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    -- Fall back to the local-part of the email when no name was supplied.
    -- raw_user_meta_data is user-controlled, so it is fine as a *display* value
    -- but must never be used for authorization.
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Close the RPC endpoint these functions would otherwise expose.
--
-- Postgres grants EXECUTE to PUBLIC on every new function, and `public` is an
-- API-exposed schema — so without this, `handle_new_user` is reachable by an
-- anonymous caller at /rest/v1/rpc/handle_new_user. It is SECURITY DEFINER, so
-- that would be a public endpoint running with owner privileges.
--
-- Revoking is safe: Postgres checks EXECUTE when a trigger is *created*, not
-- each time it fires, so the triggers keep working. (Verified by the RLS proofs,
-- which depend on these triggers running.)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
