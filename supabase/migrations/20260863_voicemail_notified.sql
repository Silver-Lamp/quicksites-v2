-- 20260863_voicemail_notified.sql
--
-- Idempotency for the missed-call text (docs/CALL_CASCADE_PLAN.md phase 0).
--
-- ⚠️ THE GUARD IS A CLAIMED COLUMN, NOT AN ASSUMPTION THAT WEBHOOKS ARRIVE ONCE. Twilio retries
-- any webhook it does not get a clean answer from, and the voicemail handler sends an SMS to a
-- real business about a real stranger's call. Without a claim, one slow response means that
-- business is texted twice about the same call — and the first thing they learn about this
-- feature is that it spams them.
--
-- The handler updates `... where voicemail_notified_at is null` and acts only on the row it
-- actually claimed, so a concurrent retry loses the race instead of duplicating the send. Same
-- shape as `ppl_post_ledger` returning NULL for "already posted", which callers read as done
-- rather than as an error.

alter table public.call_logs
  add column if not exists voicemail_notified_at timestamptz;

comment on column public.call_logs.voicemail_notified_at is
  'Set when the missed-call SMS was claimed for this call. The claim IS the idempotency guard — see 20260863; never send without winning it.';
