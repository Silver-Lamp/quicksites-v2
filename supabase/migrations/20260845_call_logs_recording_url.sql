-- 20260845_call_logs_recording_url.sql
-- The bridged leg is recorded (record-from-answer-dual) and Twilio posts the RecordingUrl to the
-- same callback. Keep it on the call row: it is the evidence for a pay-per-call dispute
-- (docs/PPL_VERTICAL.md §8 Phase 2). call_logs is a pre-existing live table — guard with if not exists.
alter table public.call_logs add column if not exists recording_url text;
