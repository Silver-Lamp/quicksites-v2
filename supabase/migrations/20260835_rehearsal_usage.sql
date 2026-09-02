-- Rehearsal engine usage ledger — the QuickSites side of the billing chain.
-- Contract: crosstalk/contracts/rehearsal-engine.md.
--
-- HiveJournal returns a usage envelope per call and deliberately persists NOTHING for it: their
-- existing partner-usage table is voice-shaped (render_chars, voice_basis), and recording a text
-- rehearsal turn in it would mean writing columns that do not describe what happened.
--
-- So the rollup lives here, and that is the right place for a reason worth writing down:
-- HJ bills QuickSites, and QuickSites bills the company. Sourcing our invoices from HJ's schema
-- would make our revenue depend on someone else's columns.
--
-- ⚠️ THE ASYMMETRY THAT PUTS THE BURDEN ON US. If this logging breaks, we under-bill our own
-- customers, silently, in our favour — the kind of failure that survives for years because
-- nothing complains. HJ's equivalent failure is loud, because they would be invoicing us for
-- turns we can see. So recording honestly is our job, and it starts at the FIRST call rather
-- than when billing is built: usage nobody recorded is the one kind that cannot be reconstructed.
--
-- ⚠️ `cost_cents` IS NULLABLE ON PURPOSE. Zero means "this turn was free"; NULL means "we do not
-- know what it cost". Defaulting an unknown to 0 is how a number that means nothing gets summed
-- into an invoice — the same $0.00-means-unknown failure this repo has already shipped once.
--
-- Deny-default RLS: service-role only. This is cross-customer billing data.

create table if not exists public.rehearsal_usage (
  id            uuid primary key default gen_random_uuid(),
  occurred_at   timestamptz not null default now(),

  -- Who practised, and who gets billed for it. Both nullable: an internal rep practising on our
  -- own lane belongs to no customer org, and that is a real row rather than a broken one.
  user_id       uuid references auth.users(id) on delete set null,
  org_id        uuid references public.organizations(id) on delete set null,

  lane          text not null,                 -- the lane key the engine echoed back
  partner       text,                          -- from the envelope; 'quicksites' today
  grant_id      text,                          -- which grant was charged — the reconciliation key

  cost_cents    integer,                       -- NULL = unknown, 0 = genuinely free. Never conflate.
  billed        boolean,                       -- HJ's flag, stored as reported, never recomputed
  latency_ms    integer,

  status        text not null default 'ok',    -- 'ok' | 'error'
  error         text,                          -- why a turn failed, when it did

  constraint rehearsal_usage_status_check check (status in ('ok', 'error')),
  -- A failed turn cannot also report a cost: if we did not get an envelope we do not know.
  constraint rehearsal_usage_error_has_no_cost check (status = 'ok' or cost_cents is null)
);

create index if not exists rehearsal_usage_occurred_idx on public.rehearsal_usage (occurred_at desc);
create index if not exists rehearsal_usage_org_idx on public.rehearsal_usage (org_id, occurred_at desc);
create index if not exists rehearsal_usage_lane_idx on public.rehearsal_usage (lane);
create index if not exists rehearsal_usage_grant_idx on public.rehearsal_usage (grant_id);

alter table public.rehearsal_usage enable row level security;
-- Deny-default: no policies → service role only.
revoke all on public.rehearsal_usage from anon, authenticated;

comment on table public.rehearsal_usage is
  'Per-turn usage for the HiveJournal rehearsal engine. QS bills its customers from this; HJ invoices QS from their own numbers. cost_cents NULL = unknown, never 0.';
