# Domain-Claim Email Verification Plan

> Email proof-of-control for the **domain-claim** path (`app/api/claim-site`, the `domains` table).
> Distinct from [`CLAIM_VERIFICATION_PLAN.md`](CLAIM_VERIFICATION_PLAN.md), which covers the **SMS**
> operator-draft / `delivered.menu` claim (keyed on `templates`).

## Why
`POST /api/claim-site` used to flip `domains.is_claimed`, write an arbitrary `claimed_email`, queue a
screenshot, and grant `steward_rewards` — all from an unverified request body (griefing / owner-lockout,
arbitrary-email, points-farming). PR #271 neutered those writes (the endpoint now returns `{pending:true}`).
This plan restores a *completable* claim, gated on the claimer proving control of an email.

## Design (mirrors the SMS flow, channel = email)
Reuses the existing OTP + verify-grant machinery unchanged — `lib/auth/claimVerify.ts` functions take a
generic string subject (an HMAC salt); we pass the **domain id** instead of a template id.

### Status — P0–P2 shipped (flag-gated OFF)
- **P0 — migration** `supabase/migrations/20260709_domain_claim_verification.sql`:
  - `domains.claimed_email text`, `domains.claimed_at timestamptz` (the `claimed_email` column the old code
    wrote never existed).
  - `claim_verifications.domain_id uuid` (nullable, FK→domains), `template_id` relaxed to nullable, CHECK
    that exactly one subject is set. RLS unchanged (deny-default / service-role).
  - **Inert until `npm run db:migrate:up`.**
- **P1 — routes**:
  - `app/api/claim/verify/email/send/route.ts` — `{slug,email}` → validates domain exists + unclaimed +
    email format, rate-limits (`cv:email:send:dom:*` 3/hr, `cv:email:send:ip:*` 6/hr), stores a hashed OTP
    (`channel:'email'`, `domain_id`, `destination:email`), emails the code via `sendEmail`. Returns
    `{ok,masked}`.
  - `app/api/claim/verify/email/confirm/route.ts` — `{slug,email,code}` → attempt-capped constant-time
    check; on success sets `verified_at` and a domain-bound grant cookie (`qs_domain_claim_grant`).
- **P2 — completion gate** in `app/api/claim-site/route.ts`: behind `DOMAIN_CLAIM_VERIFICATION_ENABLED`
  (`lib/flags/domainClaimVerification.ts`). Flag OFF → pending stub (today's safe behavior). Flag ON →
  requires a valid grant cookie for the domain **and** a matching verified/unconsumed `claim_verifications`
  row before writing `is_claimed/claimed_email/claimed_at` (race-guarded) and consuming the row.

### Remaining
- **P3 — UI**: an email→code form on the public `/claim` page (reuse the `components/claim/claim-verify-form.tsx`
  pattern). Until this lands the flow is server-only (drivable via curl with the flag on).
- **P4 — tests**: route-level attempt-cap / expiry tests + a green-path e2e (dev `sendEmail` returns
  `{ok:true,id:'dev'}`, so it runs without a live Resend key). A unit test for the domain-subject grant
  reuse ships with P0–P2.

## Decisions taken
- **6-digit code** (mirrors SMS 1:1), not a magic link.
- **No `steward_rewards`** write on verified claim — the table is currently write-only / surfaced nowhere;
  don't resurrect a dead write until it's shown to users.
- **Anonymous claims allowed** — email control is the proof; `domains.claimed_by` stays null when the
  claimer isn't logged in.

## Enabling in prod
Set `DOMAIN_CLAIM_VERIFICATION_ENABLED=1`, run `npm run db:migrate:up`, and ensure `RESEND_API_KEY` +
a verified sender domain (`EMAIL_FROM`) are configured. Flag off = current pending behavior.
