-- SECURITY (Phase 3a): RLS deny-default on sensitive tables that were RLS-disabled
-- and had anon/authenticated write grants (writable via the anon key over
-- PostgREST). Each is accessed ONLY server-side via the service-role client (or a
-- SECURITY DEFINER RPC), verified: no browser-client writer, no user-scoped
-- read/write. Enabling RLS with no policies denies anon/authenticated while the
-- service role (bypasses RLS) keeps working — no app change.
--
--   refunds, refund_events     — admin refunds route (service-role db)
--   coupon_redemptions         — no code access (RPC/definer or unused)
--   referral_payouts           — no code access
--   published_versions         — publish RPC (security definer)
--   template_edits             — no code access
--
-- Excluded (need scoped policies, handled in Phase 3b): coupons (public read
-- routes), template_versions / published_sites / template_images / snapshots /
-- site_events (browser-client writers).
alter table public.refunds            enable row level security;
alter table public.refund_events      enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.referral_payouts   enable row level security;
alter table public.published_versions enable row level security;
alter table public.template_edits     enable row level security;
