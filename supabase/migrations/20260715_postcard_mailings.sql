-- Postcard mailing tracking for the geo-competition outreach channel.
--
-- Each row = one physical postcard handed to Lob (lib/outreach/mail/lob.ts). The Lob
-- postcard id is the correlation key that inbound Lob webhooks
-- (app/api/outreach/webhooks/lob) use to advance delivery status through the USPS
-- tracking lifecycle (created → in_transit → … → delivered / returned_to_sender).
-- Previously the Lob id was returned by the send route but never persisted, so there
-- was nothing for a delivery webhook to update — this table closes that loop.
--
-- Service-role/server only: RLS on + no policies denies anon/authenticated by default
-- (same pattern as public.outreach_prospects / public.site_settings). All access goes
-- through admin-gated routes + the signed webhook, both using the service-role key.

create table if not exists public.postcard_mailings (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  provider               text not null default 'lob',
  lob_id                 text not null,                         -- Lob postcard id (psc_…) — webhook correlation key
  prospect_id            uuid,                                  -- outreach_prospects.id (recipient business)
  campaign_id            uuid,                                  -- geo_industry_campaigns.id
  sent_by                uuid,                                  -- operator uid who mailed it
  to_name                text,
  to_address             text,                                  -- one-line snapshot of the mailed-to address
  status                 text not null default 'created',       -- see POSTCARD_STATUS_RANK in lib/outreach/mail/lobWebhook.ts
  expected_delivery_date date,
  carrier                text,
  tracking_number        text,
  thumbnail_url          text,                                  -- Lob-rendered proof thumbnail (from the send response)
  pdf_url                text,                                  -- Lob-rendered PDF proof url
  events                 jsonb not null default '[]'::jsonb,     -- append-only tracking event log
  delivered_at           timestamptz,
  returned_at            timestamptz,
  -- Per-prospect QR attribution: each mailed card carries /r/<campaign>?p=<prospect>, so a
  -- scan bumps THIS piece — telling you which business engaged, not just the campaign.
  scans                  int not null default 0,
  first_scanned_at       timestamptz,
  last_scanned_at        timestamptz
);

-- One row per Lob piece; the webhook upserts/advances by this id.
create unique index if not exists postcard_mailings_lob_id_key
  on public.postcard_mailings (lob_id);

-- Campaign status roll-up (poster view + prospects row badges), newest first.
create index if not exists postcard_mailings_campaign_idx
  on public.postcard_mailings (campaign_id, created_at desc);

-- Per-prospect latest mailing lookup.
create index if not exists postcard_mailings_prospect_idx
  on public.postcard_mailings (prospect_id, created_at desc);

alter table public.postcard_mailings enable row level security;

-- No policies on purpose: reads/writes go through admin-gated routes + the signed Lob
-- webhook using the service-role key (which bypasses RLS). RLS-on + no policies denies
-- anon/auth by default.

comment on table public.postcard_mailings is
  'Physical postcard mailings (Lob) with USPS delivery tracking. Service-role/server only; RLS denies anon/auth. Correlated to Lob webhooks by lob_id.';
