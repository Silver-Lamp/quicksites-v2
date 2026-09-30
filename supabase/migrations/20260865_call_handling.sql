-- 20260865_call_handling.sql
--
-- WHICH MODEL SERVED THIS CALL — so the voicemail-first experiment can be measured at all.
--
-- The question the flip exists to answer is a RATIO: of the callers who reach our voicemail
-- prompt, what fraction actually leave a message. Emergency callers may well hang up and tap
-- the next Google result, and if they do, the whole voicemail-first model fails at its first
-- step and nothing further is worth building.
--
-- ⚠️ THAT RATIO IS NOT COMPUTABLE FROM THE EXISTING COLUMNS. `forwarded_to IS NULL` was going
-- to be the proxy — it is already null on every voicemail-first call — but it is ALSO null on
-- every call logged before 20260861, on every PPL call with no account, and on every campaign
-- that simply never had a destination. Segmenting on it would silently mix four populations
-- into one denominator, and the number would look like a measurement. Same wrong-instance
-- failure as counting the marketing pages and concluding the tenant sites rendered fine.
--
-- So the handling mode is recorded explicitly, at the moment the decision is made.

alter table public.call_logs
  add column if not exists handling text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.call_logs'::regclass and conname = 'call_logs_handling_check'
  ) then
    alter table public.call_logs
      add constraint call_logs_handling_check
      check (handling is null or handling in ('forward', 'cascade', 'voicemail_first', 'ppl', 'no_destination'));
  end if;
end $$;

comment on column public.call_logs.handling is
  'Which model served this call, written when the route decides. NULL on rows predating 20260865 — deliberately not backfilled, because the mode of a historical call cannot be recovered from a mutable campaign row. voicemail_first is the denominator of the leave-a-message rate.';

create index if not exists call_logs_handling_idx
  on public.call_logs (handling, timestamp desc)
  where handling is not null;
