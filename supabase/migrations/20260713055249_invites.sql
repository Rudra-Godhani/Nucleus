-- Invite redemption.
--
-- The awkward part of invites: the person redeeming one is, by definition, not
-- yet a member of the workspace — so RLS correctly hides the invite row from
-- them. They cannot SELECT it, and they cannot INSERT their own membership row
-- (that policy does not exist, deliberately: it would let anyone join any
-- workspace by guessing an id).
--
-- So redemption goes through a SECURITY DEFINER function, which is the one place
-- in Nucleus that steps around RLS. That makes it the most security-sensitive
-- code in the schema, and it is written accordingly:
--
--   * The user is taken from auth.uid(), never from an argument — a caller
--     cannot redeem an invite on someone else's behalf.
--   * The role granted comes from the *invite*, never from the caller — a caller
--     cannot ask to join as an owner.
--   * The workspace comes from the invite, never from the caller — knowing a
--     workspace id gets you nothing.
--   * The only thing the caller supplies is the code itself.
--   * EXECUTE is revoked from `anon`. You must be signed in to redeem.
--
-- Two kinds of invite:
--   email IS NULL     — a shareable join code, reusable until it expires.
--   email IS NOT NULL — addressed to one person: single-use, and only that
--                       person's account can redeem it.

-- Invite codes must be unguessable — the code is the only thing between a
-- stranger and your workspace. gen_random_bytes is a CSPRNG; a sequence or a
-- timestamp would be enumerable.
--
-- This lives in `private`, not `public`, for a specific reason. It is the DEFAULT
-- for workspace_invites.code, and Postgres evaluates a column default as the
-- *inserting* role — so `authenticated` must hold EXECUTE on it or every invite
-- insert fails with "permission denied for function generate_invite_code".
--
-- That rules out the usual hardening move of revoking EXECUTE. Putting it in the
-- unexposed `private` schema instead gets both properties: the inserting role can
-- call it, but it is not published as an RPC endpoint the way a function in
-- `public` would be.
create function private.generate_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(
    encode(extensions.gen_random_bytes(16), 'base64'),
    '+/=', ''   -- drop padding and URL-unsafe characters
  );
$$;

-- Order matters. Postgres grants EXECUTE to PUBLIC on every new function, and
-- every role inherits from PUBLIC — so revoking from `authenticated` alone would
-- change nothing. Strip PUBLIC first, then hand it back to exactly the one role
-- that needs it. `anon` never inserts invites and does not get it.
revoke execute on function private.generate_invite_code() from public, anon;
grant execute on function private.generate_invite_code() to authenticated;

alter table public.workspace_invites
  alter column code set default private.generate_invite_code();

-- A user needs to see invites addressed to them *before* they are a member,
-- which RLS cannot express: a non-member can see nothing in that workspace,
-- including its name. This returns only invites addressed to the caller's own
-- verified email.
create function public.get_my_pending_invites()
returns table (
  invite_id uuid,
  code text,
  workspace_id uuid,
  workspace_name text,
  role public.member_role,
  expires_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select i.id, i.code, i.workspace_id, w.name, i.role, i.expires_at
    from public.workspace_invites i
    join public.workspaces w on w.id = i.workspace_id
   where i.accepted_at is null
     and i.expires_at > now()
     -- Matched against the caller's own email as recorded in auth.users, not
     -- against anything they passed in.
     and lower(i.email) = (
       select lower(u.email) from auth.users u where u.id = (select auth.uid())
     )
     -- Already a member? Then it is not pending.
     and not exists (
       select 1 from public.workspace_members m
        where m.workspace_id = i.workspace_id
          and m.user_id = (select auth.uid())
     );
$$;

revoke execute on function public.get_my_pending_invites() from public, anon;
grant execute on function public.get_my_pending_invites() to authenticated;

-- Redeem an invite code and join the workspace.
-- Returns the workspace slug, so the caller knows where to navigate.
create function public.redeem_invite(invite_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_user_email text;
  v_invite public.workspace_invites;
  v_slug text;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to redeem an invite'
      using errcode = 'insufficient_privilege';
  end if;

  select email into v_user_email from auth.users where id = v_user_id;

  -- `for update` locks the row, so two people racing to redeem the same
  -- single-use invite cannot both pass the accepted_at check.
  select * into v_invite
    from public.workspace_invites
   where code = invite_code
   for update;

  -- One deliberately vague message for every failure mode. Distinguishing
  -- "no such code" from "expired" from "not addressed to you" would let someone
  -- probe for valid codes.
  if v_invite.id is null
     or v_invite.expires_at <= now()
     or (v_invite.email is not null and v_invite.accepted_at is not null)
  then
    raise exception 'This invite is invalid or has expired';
  end if;

  -- An email-addressed invite belongs to exactly one account.
  if v_invite.email is not null
     and lower(v_invite.email) is distinct from lower(v_user_email)
  then
    raise exception 'This invite is invalid or has expired';
  end if;

  select slug into v_slug from public.workspaces where id = v_invite.workspace_id;

  -- The role comes from the invite. The caller has no say in it.
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_invite.workspace_id, v_user_id, v_invite.role)
  -- Redeeming twice is a no-op rather than an error — and must never *change* an
  -- existing role, or an owner who re-used an old 'member' code would silently
  -- demote themselves.
  on conflict (workspace_id, user_id) do nothing;

  -- Only single-use (email-addressed) invites are consumed. A shareable code
  -- stays usable until it expires or an admin deletes it.
  if v_invite.email is not null then
    update public.workspace_invites
       set accepted_at = now(), accepted_by = v_user_id
     where id = v_invite.id;
  end if;

  return v_slug;
end;
$$;

revoke execute on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;
