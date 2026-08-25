-- Record that a geo-domain RENTAL actually billed — in OUR database, not only Stripe's.
--
-- Before this, every renewal arrived as customer.subscription.updated and was mapped to
-- subscription_status='active' — the exact value the row already held. So cycle 2 was
-- byte-identical to no cycle at all, and "is this rental still paying?" could only be
-- answered by opening the Stripe dashboard. Same shape as the commerce-side bug in #826:
-- Stripe knew, we didn't.
--
-- last_invoice_id is the idempotency key. Stripe retries webhook deliveries, so a plain
-- counter would over-count a redelivered invoice.paid and report revenue that never landed.

alter table public.geo_industry_campaigns
  add column if not exists last_payment_at    timestamptz,
  add column if not exists last_payment_cents int,
  add column if not exists last_invoice_id    text,
  add column if not exists payment_count      int not null default 0;

comment on column public.geo_industry_campaigns.payment_count is
  'Successful rental invoices recorded for this campaign. 0 = the subscription has never billed, which is NOT the same as unrented.';
comment on column public.geo_industry_campaigns.last_invoice_id is
  'Stripe invoice id of the most recent recorded payment; used to make invoice.paid idempotent across webhook retries.';
