-- 20260709_domain_claim_verification.sql
-- Email proof-of-control for the domain-claim path.
-- See docs/DOMAIN_CLAIM_VERIFICATION_PLAN.md.
--
-- 1) domains gains claimed_email / claimed_at (the old claim-site code wrote a
--    claimed_email column that never existed — this adds it).
-- 2) claim_verifications is generalized to accept a domain subject (nullable
--    domain_id) in addition to the existing template_id, with a check that
--    exactly one subject is set. Reuses the existing OTP/verify-grant machinery.

alter table public.domains add column if not exists claimed_email text;
alter table public.domains add column if not exists claimed_at timestamptz;

alter table public.claim_verifications
  add column if not exists domain_id uuid references public.domains(id) on delete cascade;

-- template_id was NOT NULL (SMS/template-only); relax it so a row can instead
-- reference a domain. (drop not null is a no-op if already nullable.)
alter table public.claim_verifications alter column template_id drop not null;

create index if not exists claim_verifications_domain_idx
  on public.claim_verifications (domain_id);

-- Exactly one subject per row (template XOR domain). Guarded so re-runs are safe.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'claim_verifications_one_subject'
  ) then
    alter table public.claim_verifications
      add constraint claim_verifications_one_subject
      check ((template_id is not null) <> (domain_id is not null));
  end if;
end $$;
