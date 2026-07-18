-- Partner audio provisioning — the QuickSites consumer side of HiveJournal's
-- owner-granted, scoped, revocable token model (crosstalk/contracts/partner-provisioning.md).
-- Lets QS generate owner-voice audio (welcome / testimonial / listing) for a site owner
-- WITHOUT the owner hand-pasting URLs, by calling HJ's owner-scoped endpoints with a
-- grant the owner minted from their HJ dashboard.
--
-- Two tables:
--   partner_audio_grants — the grant token store (the join between a QS user/site and an
--     HJ embed). The raw grant token is a per-owner bearer SECRET → stored ENCRYPTED
--     (AES-256-GCM, key in env), never in a site build, never client-readable.
--   partner_audio_usage — the rollup ledger, populated nightly from HJ's partner usage
--     feed (GET /api/partner/usage). Per-embed/period render counts + est cost, used for
--     per-agent attribution + tier billing reconciliation.
--
-- Deny-default RLS on BOTH — service-role (server) only. Grant tokens must never be
-- reachable by anon/authenticated clients. The feed shape is PROPOSED (pending HJ
-- ratification of the billing-rollup half — see the contract §"billing rollup"); the
-- columns here mirror the proposal and are cheap to alter before this migration is applied.
--
-- STATUS: pending — run `npm run db:migrate:up`. Inert until then AND until the flag
-- PARTNER_AUDIO_PROVISIONING_ENABLED + PARTNER_QUICKSITES_SECRET + PARTNER_GRANT_ENC_KEY
-- are set and HJ's provisioning endpoint (#1332) is live.

create table if not exists public.partner_audio_grants (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,  -- the QS owner who connected
  template_id     uuid references public.templates(id) on delete set null,    -- the QS site using the embed (optional)
  hj_embed_id     text not null,                                              -- the HiveJournal embed id (uuid)
  hj_owner_id     text,                                                       -- learned from the usage feed / provision responses
  grant_token_enc text not null,                                             -- AES-256-GCM: iv:tag:ciphertext (base64)
  scope           text not null default 'about_that:provision',
  billing_mode    text not null default 'owner',                             -- 'owner' | 'partner' (PROPOSED — pending HJ)
  status          text not null default 'active',                            -- 'active' | 'revoked'
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz,
  revoked_at      timestamptz
);

-- One active grant per (owner, embed). A revoked row can coexist with a new active one.
create unique index if not exists partner_audio_grants_active_uidx
  on public.partner_audio_grants (user_id, hj_embed_id)
  where status = 'active';
create index if not exists partner_audio_grants_template_idx
  on public.partner_audio_grants (template_id);
create index if not exists partner_audio_grants_embed_idx
  on public.partner_audio_grants (hj_embed_id);

alter table public.partner_audio_grants enable row level security;
-- Deny-default: no policies → service role only. Grant tokens are secrets.
revoke all on public.partner_audio_grants from anon, authenticated;

create table if not exists public.partner_audio_usage (
  id            uuid primary key default gen_random_uuid(),
  hj_owner_id   text,
  hj_embed_id   text not null,
  template_id   uuid references public.templates(id) on delete set null,  -- resolved via grants
  period_start  date not null,
  period_end    date not null,
  renders       integer not null default 0,
  render_chars  bigint not null default 0,
  est_cost_usd  numeric(10,4) not null default 0,
  billing_mode  text not null default 'owner',
  last_render_at timestamptz,
  synced_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- Idempotent upsert target: one row per embed per period.
create unique index if not exists partner_audio_usage_period_uidx
  on public.partner_audio_usage (hj_embed_id, period_start, period_end);
create index if not exists partner_audio_usage_owner_idx
  on public.partner_audio_usage (hj_owner_id, period_start desc);

alter table public.partner_audio_usage enable row level security;
revoke all on public.partner_audio_usage from anon, authenticated;
