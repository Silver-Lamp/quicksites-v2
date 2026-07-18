-- Vanity referral codes + signup attribution.
--
-- Two changes that let an operator mint a shareable code ("daniel") BEFORE the person has an
-- account, share it, let signups + commissions accrue against it, and finalize the owner (+
-- Stripe Connect) later — at which point held commissions transfer. The money flow already
-- exists (qs_ref cookie → attributions → commission_ledger → runPayouts, which holds as a
-- 'manual' record until the owner connects Stripe, then transfers). This just removes the
-- "owner must exist first" requirement and adds signup-level visibility. See the referral-codes
-- feature. Idempotent.

-- 1) referral_codes: allow an UNCLAIMED code (no owner yet) + human metadata + claim tracking.
alter table public.referral_codes alter column owner_id drop not null;
alter table public.referral_codes alter column owner_type drop not null;
alter table public.referral_codes
  add column if not exists label       text,               -- friendly name, e.g. "Daniel (DeckSketch)"
  add column if not exists owner_email  text,               -- who it's FOR, before they have an account
  add column if not exists status       text not null default 'active',  -- 'active' | 'disabled'
  add column if not exists claimed_at   timestamptz,        -- set when a real owner is linked (finalize)
  add column if not exists created_by   uuid,               -- operator who minted it
  add column if not exists created_at   timestamptz not null default now();

-- 2) referral_signups: user-level attribution — WHO signed up under a code (precedes the
--    merchant/attributions row, which only appears once they create a store). First-touch:
--    user_id is the PK, so the earliest code a user arrived with wins and never gets clobbered.
create table if not exists public.referral_signups (
  user_id        uuid primary key,
  referral_code  text not null references public.referral_codes(code),
  email          text,
  source         text,                 -- 'signup_field' | 'ref_cookie' | 'admin'
  created_at     timestamptz not null default now()
);
create index if not exists referral_signups_code_idx on public.referral_signups (referral_code, created_at desc);

alter table public.referral_signups enable row level security;
-- Deny-default: service-role (server routes) only, matching the rest of the referral tables.
revoke all on public.referral_signups from anon, authenticated;
