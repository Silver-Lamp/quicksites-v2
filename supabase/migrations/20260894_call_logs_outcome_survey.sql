-- Did the call become a job? Asked of the BUSINESS, by text, on the trade's own clock, with no
-- money riding on the answer (owner, 2026-10-18: measure conversion without billing on it — a
-- self-report that sets the bill invites "no"; a self-report that changes nothing is the only
-- honest way to learn what a 90-second call is worth per trade). Never asked of the caller.
alter table public.call_logs add column if not exists outcome_survey_sent_at timestamptz;
alter table public.call_logs add column if not exists outcome_survey_result jsonb;
alter table public.call_logs add column if not exists outcome_reported text
  check (outcome_reported in ('job', 'no_job', 'not_yet'));
alter table public.call_logs add column if not exists outcome_reported_at timestamptz;
alter table public.call_logs add column if not exists outcome_reported_raw text;
create index if not exists call_logs_outcome_survey_open
  on public.call_logs (forwarded_to, outcome_survey_sent_at desc)
  where outcome_survey_sent_at is not null and outcome_reported is null;
