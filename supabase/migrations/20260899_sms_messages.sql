-- One table for every text in either direction (owner, 2026-10-18: "can I get emailed when sms
-- replies come in? and when they go out"). inbound_sms (20260898, minutes old) becomes
-- sms_messages with a direction; outbound rows are written by the one sender every text goes
-- through (lib/sms/sendSms.ts), so no feature can text a business without a record and an email.
alter table if exists public.inbound_sms rename to sms_messages;
alter table public.sms_messages add column if not exists direction text not null default 'in' check (direction in ('in', 'out'));
alter table public.sms_messages add column if not exists reason text;      -- why we sent it: pitch_text1, connected_call, outcome_survey, …
alter table public.sms_messages add column if not exists ok boolean;        -- outbound: Twilio accepted it
alter table public.sms_messages add column if not exists error text;
alter table public.sms_messages alter column kind drop not null;            -- outbound rows carry a reason instead of a kind
create index if not exists sms_messages_campaign_idx on public.sms_messages (geo_campaign_id, received_at desc);
create index if not exists sms_messages_direction_idx on public.sms_messages (direction, received_at desc);
