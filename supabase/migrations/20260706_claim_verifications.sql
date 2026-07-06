-- Claim verification for CedarSites / delivered.menu operator-draft claims.
-- Proof that whoever claims an auto-built restaurant site controls the real business
-- (an OTP received at the phone on its public listing, or an operator manual override).
-- The `verified_at` row is the grant: `claim_operator_draft` only runs once one exists.
-- See docs/CLAIM_VERIFICATION_PLAN.md. Deny-default RLS — service-role (server) only.
create table if not exists public.claim_verifications (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.templates(id) on delete cascade,
  user_id       uuid,                        -- the claimer, stamped on consume
  channel       text not null default 'sms', -- 'sms' | 'voice' | 'email' | 'manual'
  destination   text,                        -- E.164 phone / email actually contacted ('manual' for overrides)
  code_hash     text,                        -- HMAC(code); never plaintext. null for manual.
  attempts      int  not null default 0,     -- confirm attempts against this row
  sent_count    int  not null default 0,
  expires_at    timestamptz,                 -- code TTL
  verified_at   timestamptz,                 -- set on success — this is the grant
  verified_by   uuid,                        -- admin user id for channel='manual'
  consumed_at   timestamptz,                 -- set when a claim actually transfers off this row
  created_ip    text,
  created_at    timestamptz not null default now()
);

create index if not exists claim_verifications_template_idx
  on public.claim_verifications (template_id);
create index if not exists claim_verifications_active_idx
  on public.claim_verifications (template_id)
  where verified_at is null and consumed_at is null;
create index if not exists claim_verifications_verified_idx
  on public.claim_verifications (template_id)
  where verified_at is not null and consumed_at is null;

alter table public.claim_verifications enable row level security;
-- Deny-default: no policies → only the service role (server routes) can read/write.
revoke all on public.claim_verifications from anon, authenticated;
