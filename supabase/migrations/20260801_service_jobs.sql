-- SecondSet service jobs (docs/SECONDSET_GLASSES_PLAN.md) — the field-service spine that
-- extends QuickSites from e-commerce orders into service jobs: a job ↔ a CRM customer,
-- proposed line items, glasses-captured proof (photo + spoken note), and a
-- customer-approval gate. Deny-default RLS; the ingest/portal routes use the service role
-- and validate opaque per-job tokens themselves (glasses never hold QS creds).
--
-- Inert until SECONDSET_ENABLED (lib/flags/secondset.ts). Pending apply.

-- ── Jobs ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.service_jobs (
  id                       uuid primary key default gen_random_uuid(),
  owner_id                 uuid not null,                 -- the shop's QS account
  customer_id              uuid,                          -- CRM customers.id (best-effort link)
  customer_email           text,
  customer_name            text,
  title                    text not null default '',      -- e.g. "2018 Civic — brake inspection"
  vehicle_ref              text,                          -- freeform (make/model/plate) for auto
  status                   text not null default 'draft'
    check (status in ('draft','awaiting_approval','approved','declined','in_progress','done','cancelled')),
  public_token             text not null unique,          -- unguessable customer-portal link
  capture_token            text unique,                   -- per-job glasses ingest token (scoped)
  capture_token_expires_at timestamptz,
  consent_captured_at      timestamptz,                   -- privacy gate: customer consented to capture
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists service_jobs_owner_idx        on public.service_jobs (owner_id);
create index if not exists service_jobs_customer_idx     on public.service_jobs (customer_id);
create index if not exists service_jobs_public_token_idx on public.service_jobs (public_token);
create index if not exists service_jobs_capture_tok_idx  on public.service_jobs (capture_token);

-- ── Line items (the proposed work the customer approves) ─────────────────────────────
create table if not exists public.service_job_line_items (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.service_jobs(id) on delete cascade,
  description text not null default '',
  price_cents integer not null default 0,
  status      text not null default 'proposed'
    check (status in ('proposed','approved','declined')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists service_job_line_items_job_idx on public.service_job_line_items (job_id);

-- ── Captures (glasses proof: photo + spoken note) ────────────────────────────────────
create table if not exists public.service_job_captures (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references public.service_jobs(id) on delete cascade,
  kind           text not null default 'photo' check (kind in ('photo','note')),
  photo_url      text,
  media_asset_id uuid,
  transcript     text,                                    -- STT of the spoken note
  audio_url      text,                                    -- the raw spoken-note audio
  narration_url  text,                                    -- optional About That narration
  captured_by    text,                                    -- opaque tech/device ref
  created_at     timestamptz not null default now()
);
create index if not exists service_job_captures_job_idx on public.service_job_captures (job_id);

-- ── RLS: deny-default; owner (shop) can read/write their own jobs. The service role
--    (ingest + customer-portal routes) bypasses RLS and validates tokens itself. ──────
alter table public.service_jobs           enable row level security;
alter table public.service_job_line_items enable row level security;
alter table public.service_job_captures   enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='service_jobs' and policyname='service_jobs_owner_all') then
    create policy service_jobs_owner_all on public.service_jobs
      for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='service_job_line_items' and policyname='service_job_line_items_owner_all') then
    create policy service_job_line_items_owner_all on public.service_job_line_items
      for all to authenticated
      using (exists (select 1 from public.service_jobs j where j.id = job_id and j.owner_id = auth.uid()))
      with check (exists (select 1 from public.service_jobs j where j.id = job_id and j.owner_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='service_job_captures' and policyname='service_job_captures_owner_all') then
    create policy service_job_captures_owner_all on public.service_job_captures
      for all to authenticated
      using (exists (select 1 from public.service_jobs j where j.id = job_id and j.owner_id = auth.uid()))
      with check (exists (select 1 from public.service_jobs j where j.id = job_id and j.owner_id = auth.uid()));
  end if;
end $$;
