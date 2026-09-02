-- Recorded practice turns run against a fixed script, so the engine's behaviour can be looked at
-- rather than remembered. Displayed at /for-sales/simulations.
--
-- Why this is a table and not a test: what the model does is not deterministic, and the useful
-- artifact is a set of REAL responses with the date on them. A jest snapshot of an LLM is a lie
-- that goes green; a dated transcript is evidence about one day.
--
-- ⚠️ `expected_rule_id` is OUR expectation, not ground truth. A mismatch is a thing to look at,
-- never a verdict on the engine — the honest reading of "expected a flag, got none" is that one
-- of the two is wrong and the transcript is how you find out which.
--
-- Deny-default RLS: service-role only. These carry engine output and cost figures.

create table if not exists public.rehearsal_simulations (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid not null,                 -- one batch of scenarios
  created_at     timestamptz not null default now(),

  scenario_key   text not null,
  scenario_label text not null,
  tests          text not null,                 -- what this scenario is trying to find out
  archetype_id   text not null,
  transcript     jsonb not null default '[]'::jsonb,
  rep_said       text not null,

  -- What we expected, recorded BEFORE the call so it cannot be written to fit the answer.
  expected_rule_id text,                        -- null = we expect NO honesty flag

  -- What actually came back.
  status         text not null default 'ok',    -- 'ok' | 'error'
  error          text,
  prospect_line  text,
  objection_id   text,
  call_state     text,
  coaching       text,
  honesty_flags  jsonb not null default '[]'::jsonb,
  flags_dropped  integer,
  isolating      boolean[],                     -- per flag: did the quote isolate a span?
  would_keep_listening text,
  cost_cents     numeric(14, 6),
  latency_ms     integer,

  constraint rehearsal_simulations_status_check check (status in ('ok', 'error'))
);

create index if not exists rehearsal_simulations_run_idx on public.rehearsal_simulations (run_id, created_at);
create index if not exists rehearsal_simulations_created_idx on public.rehearsal_simulations (created_at desc);

alter table public.rehearsal_simulations enable row level security;
revoke all on public.rehearsal_simulations from anon, authenticated;

comment on table public.rehearsal_simulations is
  'Real rehearsal-engine turns against a fixed script. expected_rule_id is our expectation, not ground truth.';
