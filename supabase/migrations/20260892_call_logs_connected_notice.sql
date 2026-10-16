-- After every bridged call, the business is texted the caller's number (owner, 2026-10-16:
-- "text them the number as well"). The whisper is easy to miss and the phone log only ever shows
-- our tracking number — V'Z Towing rang their own line back four times looking for a customer.
-- Dedupe lives on the row, like missed_call_notified_at.
alter table public.call_logs add column if not exists connected_notified_at timestamptz;
alter table public.call_logs add column if not exists connected_notify_result jsonb;
