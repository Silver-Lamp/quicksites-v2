-- 20260870_call_logs_alerted_at.sql
--
-- When the admin was emailed about this call. NULL = not yet alerted.
--
-- ⚠️ The dedupe lives in the DATA, not in the sender. An alerter that remembers "the last call I
-- emailed about" in memory or a timestamp key re-sends the world after a deploy, and misses
-- everything that arrived while it was down. One column per call, set after a successful send,
-- means at-most-once per call and nothing silently skipped.
--
-- ⚠️ Deliberately NOT backfilled. Every existing row stays NULL... which would email the whole
-- history on first run, so the cron additionally ignores calls older than its lookback window.
-- Backfilling to now() would be a lie about when they were alerted; the window is the honest
-- guard. See lib/ppl/callAlert.ts.

alter table public.call_logs
  add column if not exists alerted_at timestamptz;

create index if not exists call_logs_alerted_at_idx
  on public.call_logs (alerted_at, created_at desc);

comment on column public.call_logs.alerted_at is
  'When an admin email went out for this call. NULL = not yet alerted. Set only after a successful send, so a failed send retries on the next cron pass.';
