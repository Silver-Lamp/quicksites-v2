-- 20260821_claim_operator_draft_sources.sql
--
-- Let an operator-built pitch site actually be claimed.
--
-- ⚠️ THE FUNCTION SILENTLY DID NOTHING FOR A WHOLE CLASS OF SITE. `claim_operator_draft` filtered
-- `claim_source = 'listing_import'`, which is right for the delivered.menu pipeline it was written
-- for and wrong for every site an operator builds by hand — from a flyer, a photo, a phone call.
-- Those carry `claim_source = 'operator_draft'` (docs/CUSTOM_SITES.md §6b says to tag them that
-- way), so the UPDATE matched zero rows, `v_updated` was 0, and the function returned FALSE.
--
-- That is the worst failure shape available here: the caller gets a well-formed boolean, the
-- claimant is told the link did not work, and the site quietly stays ours. Found while checking
-- whether we could honestly tell a real business "it's yours" — we could not.
--
-- ⚠️ THE FILTER IS DELIBERATELY STILL A FILTER. It is defence in depth behind a signed,
-- template-bound claim token, and it must never widen to "any template". A guest's own build
-- ('guest_build'), an already-claimed site ('claimed'), and a null source are all somebody else's
-- and stay unclaimable through this path.

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
     -- Both kinds of site WE built for a business that has not signed up yet.
     and claim_source in ('listing_import', 'operator_draft');

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.claim_operator_draft(uuid, uuid) from public;
