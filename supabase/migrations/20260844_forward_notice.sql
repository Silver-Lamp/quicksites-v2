-- 20260844_forward_notice.sql
--
-- The forwarded business is told once, and can say STOP (docs/PPL_VERTICAL.md §9).
--
-- A geo campaign's tracking number forwards free to a real local provider who never asked for
-- anything. One provider at a time is goodwill; a fleet of them without a word is a list nobody
-- consented to be on. So: on first attach we text the forward-to number once, and a reply of
-- STOP clears the forward everywhere that phone is used and keeps it from ever being picked
-- again. The opt-out lives in its own table keyed by phone, not on the campaign, because the
-- same business can be the forward-to of several campaigns and must be forgotten by all.

alter table public.geo_industry_campaigns
  add column if not exists forward_notice_sent_at timestamptz,
  add column if not exists forward_opted_out_at   timestamptz;

create table if not exists public.forward_opt_outs (
  phone        text primary key,                 -- E.164
  opted_out_at timestamptz not null default now(),
  source       text not null default 'sms_stop', -- 'sms_stop' | 'operator'
  note         text
);

alter table public.forward_opt_outs enable row level security;
-- Deny-default: written by the signed Twilio inbound-SMS webhook and admin routes only.

comment on table public.forward_opt_outs is 'Phones that replied STOP to a forward notice (or were opted out by an operator). Never a forward_to again.';
