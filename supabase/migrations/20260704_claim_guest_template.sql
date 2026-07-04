-- Transfer a guest-built draft from its anonymous owner to a real account.
--
-- When a guest whose email already has an account logs in, we want the draft they
-- were building (owner_id = their anonymous uid, claim_source = 'guest_build') to
-- follow them into that account.
--
-- Two guards normally block this: app.guard_templates_update (all UPDATEs) and
-- prevent_owner_change (owner_id is immutable). We keep BOTH armed by default and
-- only let this one sanctioned, SECURITY DEFINER, service-role-only path through,
-- via txn-local GUCs — mirroring how publish_template_demo bypasses the update guard.

-- 1) Teach the owner-immutability trigger to honor a txn-local bypass GUC. Default
--    behavior is unchanged (owner_id stays immutable) unless app.allow_owner_change
--    is explicitly set 'on' within the current transaction, which only the claim RPC
--    below does.
create or replace function public.prevent_owner_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.owner_id is distinct from old.owner_id
     and coalesce(current_setting('app.allow_owner_change', true), '') <> 'on' then
    raise exception 'owner_id is immutable and cannot be changed'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- 2) The claim transfer. The UPDATE only fires when the row is STILL an unclaimed
--    guest draft owned by the exact anonymous uid the caller proved (p_from_owner),
--    so it's idempotent (a replay after transfer matches nothing) and can't hijack a
--    row that isn't a pending guest draft. Entitlement to claim this specific draft
--    is enforced upstream by the signed, short-lived claim token.
create or replace function public.claim_guest_template(
  p_template_id uuid,
  p_from_owner  uuid,
  p_to_owner    uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if p_template_id is null or p_from_owner is null or p_to_owner is null then
    return false;
  end if;
  if p_from_owner = p_to_owner then
    return false;
  end if;

  perform set_config('app.bypass_template_guard', 'on', true); -- txn-local
  perform set_config('app.allow_owner_change', 'on', true);    -- txn-local

  update public.templates
     set owner_id = p_to_owner,
         claim_source = 'claimed'
   where id = p_template_id
     and owner_id = p_from_owner
     and claim_source = 'guest_build';

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.claim_guest_template(uuid, uuid, uuid) from public;
revoke all on function public.claim_guest_template(uuid, uuid, uuid) from anon;
revoke all on function public.claim_guest_template(uuid, uuid, uuid) from authenticated;
grant execute on function public.claim_guest_template(uuid, uuid, uuid) to service_role;
