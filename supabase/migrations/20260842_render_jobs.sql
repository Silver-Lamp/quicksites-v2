-- Render jobs: offload headless-browser work (catalog reads, verify renders) from Vercel
-- serverless functions to owner-run worker machines (two Mac minis, 2026-09-16).
--
-- Shape: Vercel INSERTs a job; a worker CLAIMS it with SKIP LOCKED via claim_render_job();
-- the worker writes result/error; Vercel polls. If no worker heartbeats or nobody claims the
-- job within a few seconds, Vercel runs the render itself exactly as before — the queue is an
-- optimisation with a hard fallback, never a dependency.
--
-- Security: workers run FIXED scripts selected by `kind` — the row carries a URL and options,
-- never JavaScript. Both tables are service-role only (deny-default RLS, no policies).

create table if not exists public.render_jobs (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('catalog', 'verify')),
  url           text not null,
  options       jsonb not null default '{}'::jsonb,
  status        text not null default 'queued'
                check (status in ('queued', 'claimed', 'done', 'failed', 'expired')),
  claimed_by    text,
  claimed_at    timestamptz,
  finished_at   timestamptz,
  result        jsonb,
  error         text,
  attempts      int not null default 0,
  requested_by  text,                      -- route / job that enqueued it, for the admin view
  expires_at    timestamptz not null,      -- past this, nobody should start it
  created_at    timestamptz not null default now()
);

create index if not exists render_jobs_queued_idx
  on public.render_jobs (created_at)
  where status = 'queued';
create index if not exists render_jobs_created_idx
  on public.render_jobs (created_at desc);

alter table public.render_jobs enable row level security;
-- No policies on purpose: service-role only.

create table if not exists public.render_workers (
  worker_id     text primary key,
  hostname      text,
  capabilities  text[] not null default '{}',
  version       text,
  busy          int not null default 0,
  last_seen_at  timestamptz not null default now(),
  started_at    timestamptz not null default now()
);

alter table public.render_workers enable row level security;
-- No policies on purpose: service-role only.

-- Claim the oldest queued, unexpired job this worker can run. SKIP LOCKED makes two workers
-- polling at once safe; the returned row is the caller's to execute.
create or replace function public.claim_render_job(p_worker_id text, p_kinds text[])
returns public.render_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.render_jobs;
begin
  update public.render_jobs
     set status = 'claimed',
         claimed_by = p_worker_id,
         claimed_at = now(),
         attempts = attempts + 1
   where id = (
     select id from public.render_jobs
      where status = 'queued'
        and expires_at > now()
        and kind = any (p_kinds)
      order by created_at
      limit 1
      for update skip locked
   )
  returning * into j;
  return j;
end;
$$;

revoke all on function public.claim_render_job(text, text[]) from public;
grant execute on function public.claim_render_job(text, text[]) to service_role;
