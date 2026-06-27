-- Webhook idempotency ledger. Stripe (and other providers) retry webhooks on
-- timeout/network error; without dedup a retry re-runs markOrderPaid/refunded and
-- re-fires analytics. We "claim" each event by id before processing; a duplicate
-- claim short-circuits. The row is removed if processing fails so the provider's
-- retry can reprocess. Service-role only (RLS on, no policies).
create table if not exists webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_id text not null,
  event_type text,
  processed_at timestamptz not null default now(),
  unique (provider, event_id)
);

create index if not exists webhook_events_processed_idx on webhook_events (processed_at desc);

alter table webhook_events enable row level security;
