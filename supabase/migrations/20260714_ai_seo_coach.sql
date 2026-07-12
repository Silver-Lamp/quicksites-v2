-- 20260714_ai_seo_coach.sql
--
-- AI SEO Coaching (premium): per-site coaching snapshots (history for weekly
-- score-trend + a send guard), an account-level email-preferences / opt-out row,
-- and a headers/from passthrough on email_outbox so coaching mail can carry a
-- List-Unsubscribe header + branded sender. All idempotent. See docs/AI_SEO_COACHING.md.

-- ---------------------------------------------------------------------------
-- 1) Per-site coaching snapshots. Service-role (cron) writes; owner/admin read.
-- ---------------------------------------------------------------------------
create table if not exists public.seo_coach_snapshots (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null,             -- templates.id
  owner_id       uuid not null,             -- templates.owner_id (auth uid)
  domain         text,
  kind           text not null default 'weekly',   -- 'daily' | 'weekly'
  seo_score      int,
  gsc_connected  boolean not null default false,
  signals        jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  summary        jsonb,                     -- RecSummary (weekly) or single step (daily)
  captured_at    timestamptz not null default now()
);

create index if not exists seo_coach_snapshots_site_idx
  on public.seo_coach_snapshots (site_id, captured_at desc);
create index if not exists seo_coach_snapshots_owner_idx
  on public.seo_coach_snapshots (owner_id, captured_at desc);

alter table public.seo_coach_snapshots enable row level security;

-- Owner (or platform admin) may read their own snapshots; writes are service-role only.
drop policy if exists seo_coach_snapshots_owner_read on public.seo_coach_snapshots;
create policy seo_coach_snapshots_owner_read on public.seo_coach_snapshots
  for select
  using (auth.uid() = owner_id or public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 2) Account-level email preferences (opt-out is per-user; row absent = enrolled).
--    last_*_sent_on give cron idempotency (one daily/UTC-day, one weekly/ISO-week).
-- ---------------------------------------------------------------------------
create table if not exists public.email_preferences (
  user_id            uuid primary key,
  seo_coach_daily    boolean not null default true,
  seo_coach_weekly   boolean not null default true,
  unsubscribed_all   boolean not null default false,
  last_daily_sent_on date,
  last_weekly_sent_on date,                 -- stores the ISO week-start (Monday) date
  updated_at         timestamptz not null default now()
);

alter table public.email_preferences enable row level security;

drop policy if exists email_preferences_owner_read on public.email_preferences;
create policy email_preferences_owner_read on public.email_preferences
  for select
  using (auth.uid() = user_id or public.is_platform_admin());

drop policy if exists email_preferences_owner_insert on public.email_preferences;
create policy email_preferences_owner_insert on public.email_preferences
  for insert
  with check (auth.uid() = user_id or public.is_platform_admin());

drop policy if exists email_preferences_owner_update on public.email_preferences;
create policy email_preferences_owner_update on public.email_preferences
  for update
  using (auth.uid() = user_id or public.is_platform_admin())
  with check (auth.uid() = user_id or public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 3) email_outbox passthrough: optional per-message sender + headers (e.g.
--    List-Unsubscribe). Nullable → existing rows/behavior unchanged; the
--    email-drain cron forwards them to sendEmail when present.
-- ---------------------------------------------------------------------------
alter table public.email_outbox add column if not exists "from" text;
alter table public.email_outbox add column if not exists headers jsonb;
