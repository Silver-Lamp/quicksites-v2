-- Internal task tracker: follow-ups / TODOs surfaced from the codebase + ops work.
-- Admin-facing only; the app gates reads/writes at the route level and uses the
-- service-role key, so RLS is on with no policies (service role bypasses RLS).
create table if not exists admin_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'blocked', 'done', 'cancelled')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  category text,
  source text,            -- where it came from (PR #, file, "cron-dashboard", ...)
  created_by uuid,        -- auth.users id of the admin who added it (nullable for seeds)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists admin_tasks_status_idx on admin_tasks (status, priority);
create index if not exists admin_tasks_created_idx on admin_tasks (created_at desc);

alter table admin_tasks enable row level security;
