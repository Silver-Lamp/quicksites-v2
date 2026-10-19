-- Every text a business sends to our number is kept and handed to the owner (2026-10-18: the
-- first pitch text went out and a reply would have vanished — the inbound route answered only
-- STOP / START / survey letters and dropped everything else on the floor). Service-role only.
create table if not exists public.inbound_sms (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  from_number text not null,
  to_number text,
  body text not null,
  kind text not null check (kind in ('stop', 'start', 'outcome', 'reply')),
  geo_campaign_id uuid,
  business_name text,
  twilio_sid text,
  emailed_at timestamptz
);
create index if not exists inbound_sms_campaign_idx on public.inbound_sms (geo_campaign_id, received_at desc);
create index if not exists inbound_sms_from_idx on public.inbound_sms (from_number, received_at desc);
alter table public.inbound_sms enable row level security;
