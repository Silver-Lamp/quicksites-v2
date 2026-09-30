-- 20260866_voicemail_notify_outcome.sql
--
-- ⚠️ WE COULD NOT TELL WHY THE TEXT DID NOT ARRIVE, AND THAT IS THE BUG.
--
-- 2026-09-30, first real voicemail-first call: the email arrived and the SMS did not.
-- `notifyOperatorOfVoicemail` already RETURNED `{ email, sms }` — and the caller threw it away.
-- Nothing was written, nothing was logged, and the SMS branch swallows its own errors by
-- design (a notification failure must not make the Twilio webhook non-2xx and trigger a retry
-- that re-records the caller).
--
-- So diagnosis came from comparing Vercel deployment timestamps to when an env var was set. The
-- answer turned out to be mundane — the call hit a build that predated `OPERATOR_ALERT_SMS` —
-- but it was reconstructed from circumstance rather than read from data, and next time the
-- cause may not be mundane.
--
-- ⚠️ THIS IS THE SAME FAILURE THE WHOLE FEATURE EXISTS TO FIX, ONE LEVEL UP. A lead that nobody
-- is told about is the thing we are preventing; a NOTIFICATION that silently did not happen is
-- that same silence wearing a different hat. `voicemail_notified_at` records that we TRIED —
-- it is set by the claim, before either channel runs — which is precisely why it cannot answer
-- whether anyone was reached.
--
-- Stored as jsonb rather than two booleans: the channels will change (SMS, email, and whatever
-- the claim flow adds), and a shape that grows beats a migration per channel.

alter table public.call_logs
  add column if not exists voicemail_notify_result jsonb;

comment on column public.call_logs.voicemail_notify_result is
  'Which notification channels actually succeeded for this voicemail, e.g. {"email":true,"sms":false}. NULL means the handler never got that far. Distinct from voicemail_notified_at, which only records that we tried — see 20260866.';
