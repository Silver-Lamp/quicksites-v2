-- CRM Phase 3: customer email campaigns.
--
-- Deliberately named crm_campaigns / crm_campaign_sends to stay DISTINCT from the
-- existing geographic *lead* campaigns table (public.campaigns). These target real
-- buyers (public.customers), gated on marketing_consent, sent via the Resend rails.

create table if not exists public.crm_campaigns (
  id              uuid primary key default gen_random_uuid(),
  merchant_id     uuid not null references public.merchants(id) on delete cascade,
  channel         text not null default 'email',      -- email (sms later)
  subject         text not null,
  body            text not null,
  segment         jsonb not null default '{}'::jsonb,  -- { seg, tag } snapshot of the audience filter
  status          text not null default 'draft',       -- draft | sending | sent | failed
  recipient_count int not null default 0,
  sent_count      int not null default 0,
  failed_count    int not null default 0,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);

create index if not exists crm_campaigns_merchant_idx on public.crm_campaigns(merchant_id, created_at desc);

create table if not exists public.crm_campaign_sends (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.crm_campaigns(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  email       text not null,
  status      text not null,        -- sent | failed
  error       text,
  created_at  timestamptz not null default now(),
  unique (campaign_id, customer_id)
);

create index if not exists crm_campaign_sends_campaign_idx on public.crm_campaign_sends(campaign_id);

-- Deny-default RLS: merchant-owner may READ their own; all writes are service-role.
alter table public.crm_campaigns enable row level security;
alter table public.crm_campaign_sends enable row level security;

drop policy if exists crm_campaigns_owner_read on public.crm_campaigns;
create policy crm_campaigns_owner_read on public.crm_campaigns
  for select using (
    exists (select 1 from public.merchants m where m.id = crm_campaigns.merchant_id and m.owner_id = auth.uid())
  );

drop policy if exists crm_campaign_sends_owner_read on public.crm_campaign_sends;
create policy crm_campaign_sends_owner_read on public.crm_campaign_sends
  for select using (
    exists (
      select 1 from public.crm_campaigns c
      join public.merchants m on m.id = c.merchant_id
      where c.id = crm_campaign_sends.campaign_id and m.owner_id = auth.uid()
    )
  );
