-- Transfer an OPERATOR-assembled outreach draft to the prospect who claims it.
--
-- The CedarSites flow auto-assembles a restaurant site from its public listing
-- (owner_id = the operator, claim_source = 'listing_import') and sends the business a
-- link. When they sign up via that link, the draft transfers to them.
--
-- Mirrors claim_guest_template's safety exactly, with a different entitlement guard:
-- the UPDATE only fires while the row is STILL an unclaimed 'listing_import' draft, so
-- it's idempotent (a second claimant matches 0 rows after the first) and can never
-- touch a guest_build, a real user's ai_rebuild, or an already-'claimed' row.
-- Entitlement to claim THIS specific draft is enforced upstream by the signed,
-- expiring site-claim token. Service-role only (owner_id is otherwise immutable).

create or replace function public.claim_operator_draft(
  p_template_id uuid,
  p_to_owner    uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if p_template_id is null or p_to_owner is null then
    return false;
  end if;

  perform set_config('app.bypass_template_guard', 'on', true); -- txn-local
  perform set_config('app.allow_owner_change', 'on', true);    -- txn-local

  update public.templates
     set owner_id = p_to_owner,
         claim_source = 'claimed'
   where id = p_template_id
     and claim_source = 'listing_import';

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.claim_operator_draft(uuid, uuid) from public;
revoke all on function public.claim_operator_draft(uuid, uuid) from anon;
revoke all on function public.claim_operator_draft(uuid, uuid) from authenticated;
grant execute on function public.claim_operator_draft(uuid, uuid) to service_role;
