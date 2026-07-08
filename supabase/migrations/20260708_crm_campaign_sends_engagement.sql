-- CRM Phase 3 metrics: per-send email engagement from Resend webhooks.
--
-- crm_campaign_sends records one row per recipient at send time. Resend fires
-- webhook events (delivered/opened/clicked/bounced/complained) keyed by its email
-- id; we store that id at send time (provider_message_id) and stamp first-touch
-- engagement timestamps as the events arrive.

alter table public.crm_campaign_sends
  add column if not exists provider_message_id text,
  add column if not exists opened_at     timestamptz,
  add column if not exists clicked_at    timestamptz,
  add column if not exists bounced_at    timestamptz,
  add column if not exists complained_at timestamptz;

create index if not exists crm_campaign_sends_provider_msg_idx
  on public.crm_campaign_sends(provider_message_id);
