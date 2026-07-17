-- Community moderation for site_comments: visitors can REPORT an approved comment as
-- abusive. Reports accumulate; at a threshold the comment auto-hides back to 'pending'
-- for owner re-review (threshold, not single-report, so one actor can't censor). Owner
-- is notified. Deny-default RLS unchanged (server-only writes via the report route).
alter table public.site_comments
  add column if not exists report_count integer not null default 0,
  add column if not exists reported_at   timestamptz;
