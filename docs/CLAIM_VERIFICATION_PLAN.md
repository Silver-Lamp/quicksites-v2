# Claim Verification Plan

> Harden the CedarSites / delivered.menu **claim flow** so that taking ownership of an
> auto-built restaurant site requires proving control of the real business — not just
> possessing the claim link. Tracked as the "claim-flow verification tokens" follow-up
> from the 2026-07 anon-token hardening sweep (see [`CLAUDE.md`](../CLAUDE.md) §5b and
> the `security-remediation-followups` memory).

Last updated: 2026-07-06 · Status: **P1 built behind `CLAIM_VERIFICATION_ENABLED` (dormant)** — gated at **claim** (the chosen decision, §12.1). SMS OTP to the listing phone + operator manual override are implemented; needs the `claim_verifications` migration applied + Twilio env + the flag flipped to activate. Voice/email (P2) still open.

---

## 1. The gap

Today the **signed HMAC token is the entire grant.** Whoever holds the claim URL can take the site:

1. Outreach builds a draft `templates` row (`claim_source='listing_import'`, owner = the operator/service account) from a public Google/Yelp listing.
2. We hand out `/claim-site/<id>?token=<hmac(templateId, exp+30d)>` — now also surfaced on the public, watermarked `slug.delivered.menu` preview via the **"Claim this site" bar** (#193).
3. `GET /api/claim-draft/<id>?token=` sets the `qs_pending_site_claim` httpOnly cookie and sends the visitor to `/login`.
4. Post-login, [`lib/auth/claimPendingSiteDraft.ts`](../lib/auth/claimPendingSiteDraft.ts) verifies the token and calls the `claim_operator_draft` RPC, which transfers `owner_id` to the new account and relabels the row `listing_claimed`. Idempotent — a replayed token no-ops after the first claim.

**No step proves the claimer is associated with the restaurant.** The only defenses are that the link is "semi-private" (we email/text it to the business) and that the draft is a throwaway marketing shell. Shipping the delivered.menu claim bar weakens the first defense: the preview URL is guessable (`<restaurant-slug>.delivered.menu`) and now carries the claim CTA.

## 2. Threat model — what an unverified claim enables

| Capability after claim | Harm | Severity |
|---|---|---|
| Edit the draft | Vandalize / alter a local business's content | Low (reversible shell) |
| **First publish** | An impostor's site becomes the "official," indexable restaurant site | **Medium** (brand hijack) |
| **Connect Stripe + take orders** | Customer payments route to the impostor's account | **High** (money interception, customer fraud) |
| **Land-grab** | Impostor claims first → the *real* owner is locked out (claim is one-shot) | **Medium** (blocks the real customer) |

Severity is **low today** (tokens go only to the real business; nobody's live yet) but rises the moment (a) delivered.menu previews are public with a claim bar, and (b) we onboard real restaurants that connect Stripe. This is a **pre-scale fix**, not an emergency.

## 3. Principle

**Prove control of a channel the real business controls, at the value-transfer boundary.**

For a local restaurant the cheapest strong proof is the **phone number on its public listing** — we already import it (`listing.phone` → the draft's contact block / `templates.phone`). If the claimer can receive a one-time code at that number, they control the business line. (This is essentially how Google Business Profile verifies local merchants.)

## 4. The flow (verify-after-login)

Account creation stays **frictionless** (better funnel — the prospect is invested before the ask); **ownership only transfers on verification**, which also closes the land-grab (signing up grants nothing; an impostor who can't receive the code never gets the site, so the real owner can still claim later).

```
Claim link / delivered.menu claim bar
  → GET /api/claim-draft/<id>?token=   (sets pending cookie, unchanged)
  → /login  → sign up / log in
  → auth callback → claimPendingSiteDraft(user):
        • token valid AND a fresh verification exists for (template_id, user)?
              → claim_operator_draft (transfer)  → /admin/templates/<id>
        • else → DO NOT transfer → redirect /claim-site/<id>/verify
  → /claim-site/<id>/verify:
        • shows the masked listing phone: "We'll text (•••) •••-4567 — the number on your listing"
        • [Send code] → POST /api/claim/verify/send   (Twilio SMS; rate-limited)
        • [Enter code] → POST /api/claim/verify/confirm
              → on match: write claim_verifications(verified_at), then claim_operator_draft
              → /admin/templates/<id>
```

**Defense in depth:** publish (`app/api/templates/[id]/publish`) and Stripe Connect onboarding (`/api/connect/onboard`) additionally assert a verified claim for the template, so ownership obtained by any future path still can't go live or take money unverified.

## 5. Where the gate sits (tiered)

- **Claim / edit private draft** — gated by verification (prevents land-grab + hijack in one place). Editing is only reachable after the transfer, which now requires verification.
- **Publish** — re-assert `claim_verifications.verified_at` (belt-and-suspenders).
- **Stripe Connect + first paid order** — re-assert. This is the highest-harm boundary; never let money flow to an unverified claim.

## 6. Data model (migration sketch)

Follows repo conventions: idempotent DDL, RLS **deny-default** (service-role only), money/PII-grade table.

```sql
-- supabase/migrations/<ts>_claim_verifications.sql
create table if not exists public.claim_verifications (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.templates(id) on delete cascade,
  user_id       uuid,                       -- the authenticated claimer (null until confirm)
  channel       text not null default 'sms',-- 'sms' | 'voice' | 'email' | 'manual'
  destination   text not null,              -- E.164 phone / email actually contacted
  code_hash     text,                       -- HMAC(code); never store plaintext
  attempts      int  not null default 0,
  sent_count    int  not null default 0,
  expires_at    timestamptz,                -- code TTL (10 min)
  verified_at   timestamptz,                -- set on success (this is the grant)
  verified_by   uuid,                       -- admin user id for channel='manual'
  created_ip    text,
  created_at    timestamptz not null default now()
);
create index if not exists claim_verifications_template_idx
  on public.claim_verifications(template_id);
create index if not exists claim_verifications_verified_idx
  on public.claim_verifications(template_id) where verified_at is not null;

alter table public.claim_verifications enable row level security;
-- deny-default: no policies → only the service role (server routes) can touch it.
revoke all on public.claim_verifications from anon, authenticated;
```

Optionally stamp `templates` for cheap gate checks: `claim_verified_at timestamptz`, `claim_verified_channel text` (write via the sanctioned RPC / bypass-guard txn — direct UPDATEs to `templates` are blocked).

## 7. Routes & reuse

| Piece | Build / reuse |
|---|---|
| `lib/sms/sendSms.ts` | **New** thin Twilio wrapper (`messages.create`, `from` = `TWILIO_FROM`). No generic SMS sender exists yet. |
| `POST /api/claim/verify/send` | New. Resolves the listing phone from `templates.phone` (server-derived — **never trust a client-supplied number** for the listing channel), mints a 6-digit code, stores `code_hash` + `expires_at`, sends SMS. Rate-limited. |
| `POST /api/claim/verify/confirm` | New. Constant-time compare vs `code_hash`, checks `expires_at` + `attempts`, sets `verified_at` + `user_id`, then calls `claim_operator_draft`. |
| `/claim-site/<id>/verify` | New page (masked number, send/enter-code UI). |
| `claimPendingSiteDraft` | **Edit**: gate the RPC call on a fresh `claim_verifications.verified_at` for (template, user); otherwise redirect to verify. |
| Rate limiting | Reuse [`lib/rateLimit.ts`](../lib/rateLimit.ts) / [`rateLimitOr429`](../lib/api/rateLimitGuard.ts) on `ratelimit_events`. |
| Voice fallback | Reuse the existing signed `api/twilio-callback` (signature already verified). |

## 8. Anti-abuse

- **Per-number** send cap (e.g. 3/hour) and **per-IP** send cap — SMS costs real money and a public claim bar is a spam target.
- Code: 6 digits, **10-min TTL**, **single-use**, max **5 confirm attempts** then invalidate, HMAC-hashed at rest, constant-time compare.
- Server derives the destination from `templates.phone` for the listing channel — the client picks *which listed channel*, never the raw number.
- Log destinations masked (`•••-4567`); never full numbers in logs/Sentry.

## 9. Edge cases & fallbacks

- **No phone on the listing** → offer email-to-listing-domain if present, else **manual review** (operator calls, marks verified). Don't let the claimer type an arbitrary number and self-verify — that defeats the point.
- **Landline (no SMS)** → **voice OTP**: Twilio call reads the code.
- **Owner's cell ≠ listing number** → they won't receive it → "Not your number? Request a call from us" → manual queue.
- **Number disconnected / call center** → manual.
- **Franchise / multi-location** → out of scope v1 → manual.
- **Real owner arrives after an impostor signed up (but couldn't verify)** → unaffected: no transfer happened, so they claim normally.

## 10. Operator override

Add a **"Verify manually"** action to the outreach dashboard ([`app/admin/outreach/page.tsx`](../app/admin/outreach/page.tsx)): after an operator confirms by phone, POST an admin-gated route that writes `claim_verifications(channel='manual', verified_by=<admin>, verified_at=now())`. Covers every fallback above and lets outreach close deals the automated path can't.

## 11. Phased rollout

- **P0 — publish/pay gate only (cheapest risk reduction).** Assert a verified claim at `publish` + `connect/onboard`. Requires the table + a manual/admin verify path. Ships the high-severity protection (money/brand) without building SMS. Claiming-to-edit stays open.
- **P1 — SMS self-serve.** `sendSms` + send/confirm routes + `/verify` page + `claimPendingSiteDraft` gate. The mainline verified path.
- **P2 — voice + email fallbacks + manual queue polish.**

Gate the whole thing behind `CLAIM_VERIFICATION_ENABLED` so it can merge dark and flip on with the delivered.menu launch.

## 12. Open decisions

1. **Gate at claim vs. at publish/pay?** Recommendation: **claim** (kills the land-grab too), with publish/pay as defense-in-depth. If conversion friction proves too high in testing, fall back to P0-only (gate publish/pay, leave claim open).
2. **Who eats the Twilio cost?** Platform, capped by the anti-abuse limits. Negligible at outreach volume; the caps are the real guard.
3. **Code TTL / length** — 6 digits / 10 min proposed; tune with support feedback.
4. **Re-verification on owner change** — if a claimed site is later transferred (e.g. sold), require re-verification. Out of scope v1.

## 13. Effort

- P0: ~0.5 day (table + migration + 2 gate checks + admin manual-verify route/button).
- P1: ~1.5 days (SMS helper, 2 routes, verify page, `claimPendingSiteDraft` gate, rate-limit wiring, tests).
- P2: ~1 day.

All numbers are pre-scale insurance — build P0 before the first real restaurant connects Stripe; P1 before delivered.menu previews are promoted publicly at volume.
