-- 20260814_bill_estimates.sql
--
-- Cloud-bill estimates: what someone uploaded (REDACTED), what we estimated, and whether they
-- asked to be contacted.
--
-- ⚠️ THE REDACTED TEXT IS THE ONLY TEXT THAT EXISTS HERE, AND THAT IS ENFORCED, NOT PROMISED.
-- The uploader's browser extracts and redacts before anything is sent (lib/billing/redactBill.ts),
-- and the route re-runs the same detector server-side and strikes anything still identifying
-- before it reaches this table. So "we only keep the redacted version" is a property of the
-- pipeline rather than a policy someone has to trust — which matters because this row is read by
-- a HUMAN THIRD PARTY: the site owner reads the enquiry to follow it up.
--
-- Owner decision (2026-08-02): keep the redacted text indefinitely for analytics. That is a
-- deliberate divergence from the 90-day delete originally proposed, and it is defensible only
-- BECAUSE the stored text is post-redaction — the aggregate question ("what do cloud bills
-- actually look like, and where does the money go?") is answerable from line items and totals,
-- which is exactly what survives redaction.
--
-- ⚠️ NO RAW UPLOAD IS STORED ANYWHERE, and there is deliberately no column for one. A future
-- "let us strip it for you" convenience feature would need a schema change, which is the point:
-- the absent column is the guardrail.
--
-- Deny-default RLS, service-role only — same posture as menu_search_events and demand_events.

create table if not exists public.bill_estimates (
  id              uuid primary key default gen_random_uuid(),

  -- Whose site the enquiry came through, so an owner sees only their own.
  template_id     uuid references public.templates(id) on delete set null,

  -- POST-REDACTION text only. See the note above; there is no raw counterpart by design.
  redacted_text   text not null,

  -- What our detector struck server-side, as counts by kind — never the values themselves.
  -- Lets us answer "is the redactor working?" without keeping what it removed.
  redaction_counts jsonb not null default '{}'::jsonb,

  -- The estimate as shown: a RANGE plus the assumptions it rests on. Stored as given so a
  -- later dispute can be answered with what the person actually saw.
  estimate        jsonb,

  -- Optional and asked for AFTER the estimate — never a gate on seeing it.
  contact_email   text,

  -- Cost/telemetry for the metered model call.
  model           text,
  cost_usd        numeric(10, 5),

  created_at      timestamptz not null default now()
);

create index if not exists bill_estimates_template_idx
  on public.bill_estimates (template_id, created_at desc);

create index if not exists bill_estimates_created_idx
  on public.bill_estimates (created_at desc);

alter table public.bill_estimates enable row level security;

-- Deny-default: no anon or authenticated access at all. Every read goes through a route that
-- checks ownership, because this table holds a third party's cost data.
drop policy if exists bill_estimates_deny_all on public.bill_estimates;
create policy bill_estimates_deny_all
  on public.bill_estimates
  for all
  using (false)
  with check (false);

comment on table public.bill_estimates is
  'Cloud-bill estimates. Stores ONLY post-redaction text (client-side redacted, server-side re-redacted). No raw upload column exists by design.';
comment on column public.bill_estimates.redacted_text is
  'Post-redaction only. If you are adding a raw-text column, stop and read the migration header.';
