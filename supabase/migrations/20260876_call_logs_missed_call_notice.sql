-- 20260876_call_logs_missed_call_notice.sql
--
-- The business is told about a forwarded call that rang out even when the caller left no
-- message.
--
-- ⚠️ WHY. 2026-10-07 12:42 PT: a caller rang renton-electrical.com for the second time in two
-- days, sat through the announcement and the full ring, got no answer from Madrona Electric,
-- reached our voicemail prompt and hung up without recording. Nothing reached the business —
-- the only text we sent a destination fired from the voicemail webhook, which Twilio requests
-- only when a recording exists. A rang-out call with no message was invisible to the one party
-- who could still return it.
--
-- `missed_call_notified_at`: the CLAIM, stamped before the send (idempotency — Twilio retries a
-- status callback it does not get a clean answer from, and this one texts a real business).
-- `missed_call_notify_result`: what actually happened, written after. Same split as
-- `voicemail_notified_at` / `voicemail_notify_result` (20260866) and for the same reason: a
-- timestamp only says we tried.

alter table public.call_logs
  add column if not exists missed_call_notified_at timestamptz,
  add column if not exists missed_call_notify_result jsonb;

comment on column public.call_logs.missed_call_notified_at is
  'Claimed when the parent-call status callback decided to text the destination about a forward that rang out with no message left (lib/ppl/missedCallNotice.ts). NULL = never attempted.';
comment on column public.call_logs.missed_call_notify_result is
  'Outcome of that text, e.g. {"business_sms":true} or {"skipped":"opted_out"}. NULL means the handler never got that far.';
