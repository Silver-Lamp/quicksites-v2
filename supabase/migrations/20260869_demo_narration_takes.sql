-- 20260869_demo_narration_takes.sql
--
-- One owner-recorded narration take per scripted line of a demo clip.
--
-- ⚠️ Keyed by (clip_key, line_index) where clip_key is `<clip>@<recorded_on>` — a take belongs to
-- ONE RECORDING, never to a clip name. Re-recording a demo shifts every cue (the three re-records
-- on 2026-10-01 moved every duration: 28.8→32.2s, 32.1→31.6s, 21.2→19.6s), so narration recorded
-- against the old cut would play over the wrong footage. Scoping to the dated key means old takes
-- are simply not found for the new recording, rather than silently mis-timed.
--
-- Deny-default RLS, service-role only: every read and write goes through an admin-gated route.
-- Nothing here is public — these are unpublished voice recordings of a named person.

create table if not exists public.demo_narration_takes (
  id uuid primary key default gen_random_uuid(),
  clip_key text not null,
  line_index integer not null check (line_index >= 0),
  -- Path inside the private `demo-narration` bucket. Never a public URL: the route signs it.
  storage_path text not null,
  duration_ms integer not null check (duration_ms > 0),
  -- The line as scripted when the take was recorded, so a later script edit is detectable.
  said text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demo_narration_takes_one_per_line unique (clip_key, line_index)
);

create index if not exists demo_narration_takes_clip_idx
  on public.demo_narration_takes (clip_key, line_index);

alter table public.demo_narration_takes enable row level security;

-- Deny-default: no policy is created on purpose. Service-role bypasses RLS; everyone else gets
-- nothing, which is the intended behaviour for unreleased recordings of someone's voice.

comment on table public.demo_narration_takes is
  'Owner-recorded narration, one take per scripted line of a demo clip. clip_key is <clip>@<recorded_on> because cues belong to a recording, not a clip name. Service-role only.';
