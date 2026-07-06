-- Relabel a claimed operator draft as 'listing_claimed' (was 'claimed') so the
-- outreach dashboard can distinguish a CONVERTED listing-import site from a claimed
-- guest draft. Same guard + bypass as before; only transfers a still-'listing_import'
-- row, still idempotent, still service-role-only.
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
         claim_source = 'listing_claimed'
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
