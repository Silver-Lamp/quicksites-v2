# Auto-built Trade Sites — the automated pipeline

> The seventh vertical on `/business-plan` (`lib/business/verticals.ts`, key `trade_sites`).
> Build a working website for a local trade business from its public listing, for the ones that
> have none, and sell it for the price of a phone plan. **Self-serve by necessity**: a rep cannot be
> paid out of $19/mo, so it is a claim link and a card on file or it is nothing.
>
> This doc is the map of what runs without a person, what still needs one, and why each manual
> step is manual. Status lines carry dates; re-derive the numbers, never trust them.

## The loop

```
sweep city × trade  →  build drafts (no-website only)  →  deliver a claim link  →  claim
   →  site goes LIVE on its subdomain  →  owner buys a custom domain  →  domain provisioned
```

| Step | Code | Trigger | Status (2026-09-07) |
|---|---|---|---|
| 1. Sweep a city for one trade | `app/api/admin/prospects/discover` | operator click | manual — a cron is PR 2 |
| 2. Build drafts for the no-website tier | `app/api/admin/prospects/build` → `lib/outreach/buildDraftFromListing.ts` | operator click | manual — PR 2 |
| 3. Deliver the claim link | *(nothing)* | — | **no code path delivers it** — PR 3 (postcard) |
| 4. Claim | `/claim-site/<id>?token` → `app/api/claim-draft` → `lib/auth/claimPendingSiteDraft.ts` | the business | automated |
| 5. **Site goes live** | `lib/tradeSites/activate.ts` (publish on claim, prospect → `claimed`) | on claim | **automated (PR 1)** |
| 6. **Custom-domain checkout** | `/welcome/<id>` → `POST /api/trade-sites/checkout` | the owner | **automated (PR 1)**, flag `TRADE_SITE_BILLING_ENABLED` |
| 7. **Payment recorded** | `app/api/stripe/geo-webhook` → `lib/tradeSites/subscriptions.ts` | Stripe | **automated (PR 1)** — same endpoint + secret as geo rentals |
| 8. **Domain provisioned** | `provisionDomain` → `lib/domains/registrar.ts#purchaseDomain` → bind | on payment | **automated (PR 1)** when `VERCEL_DOMAIN_REGISTER_ENABLED=1`; otherwise an `admin_tasks` row |

## PR 1 — claim → live → pay (this PR)

**What was broken before it, and is not now.**

- **Claiming made the site disappear.** The public route renders only *unowned* drafts
  (`isPublicPreClaimDraft`), so setting `owner_id` on claim 404'd the preview URL for everyone but
  the owner, while `/welcome` said "Your site is live". Claim now publishes through
  `public.publish_template` (the working RPC — `publish_site` is broken, CLAUDE.md §8).
- **The claim was never counted.** `ProspectStatus` declared `'claimed'` and no code wrote it. It is
  written now (+ `claimed_at`, migration `20260838`), so the claim rate — the decisive number — exists.
- **There was no checkout.** There is one: owner-gated, flag-gated, and the domain is checked
  (taken / premium / over `TRADE_SITE_MAX_DOMAIN_PRICE_USD`) *before* Stripe, because a
  subscription for a domain we then cannot buy is the failure this rail must never produce.
- **Provisioning needed a person.** On `checkout.session.completed` the webhook buys the domain
  via the Vercel registrar, attaches apex + www, then binds it in **three writes** — the sanctioned
  `set_template_custom_domain` RPC, a re-publish so `published_sites.domain` follows, and the legacy
  `sites` row with a freshly minted `snapshots` row — because a custom host is resolved *only*
  through `sites.domain` and served from `sites.published_snapshot_id`, which no publish path writes
  (`docs/GEO_RENTAL_RUNBOOK.md`). Every failure leaves `domain_status` + `domain_detail` on the row
  and an `admin_tasks` entry. `provisionDomain(templateId)` is idempotent: re-run it after a fix.

**Flags and env** (all declared in `.env.example`, gate `trade_site_billing` in `lib/config/health.ts`):

| Key | Default | Effect |
|---|---|---|
| `TRADE_SITE_BILLING_ENABLED` | off | welcome page shows no price; checkout 403s |
| `TRADE_SITE_DOMAIN_PRICE_CENTS` | 1900 | the proposal. **Never write the number into copy** — read it from `lib/tradeSites/config.ts` |
| `TRADE_SITE_MAX_DOMAIN_PRICE_USD` | 25 | refuse a domain whose yearly registration costs more |
| `VERCEL_DOMAIN_REGISTER_ENABLED` + `VERCEL_TOKEN` + registrant contact | off | without them a paid domain becomes an admin task, not a purchase |
| `STRIPE_GEO_WEBHOOK_SECRET` | — | trade-site events arrive on the geo endpoint; **one endpoint, one secret** |

**Proof rule, inherited from the rental rail:** `subscription_status='active'` says a subscription
exists. Only `payment_count > 0` says money moved (`invoice.paid`), and only the count tells a
renewal from a first payment. `/business-plan` reads `tradePaid` from that count, never from a status.

## Honesty constraints that shape the automation

- **Claim is free; only the domain costs.** The plan's decisive test is two numbers — claims, then
  paid domains — and they must stay separable. Do not gate the claim on a card.
- **The claim link is a bearer credential.** `docs/OUTREACH_METHOD.md` forbids it in a *cold SMS*.
  A postcard to the listing's street address is a different channel: it is the same proof of
  control Google uses for a Business Profile PIN. PR 3 mails it there and nowhere else; SMS stays
  off until 10DLC. `CLAIM_VERIFICATION_ENABLED` (OTP to the listing phone) can additionally gate the
  transfer and is recommended once a link is going out cold.
- **Nothing on the site may assert what only the owner knows** — `lib/rebuild/scrubInventedClaims.ts`
  runs on every generated draft, `scripts/audit-live-claims.mjs` measures the live fleet.
- **The welcome page states the exit** ("say the word and it's gone"), same as the outreach method.

## What is still manual, and why

1. **Choosing cities and trades** — spends Places API money; PR 2 makes it a queue the operator
   fills and a cron drains, so the decision is still a person's and the work is not.
2. **Delivering the claim link** — spends postage; PR 3 builds a per-draft postcard behind the
   existing `POSTCARD_MAIL_ENABLED` gate with a daily cap.
3. **Flipping the money flags** — `TRADE_SITE_BILLING_ENABLED`, `VERCEL_DOMAIN_REGISTER_ENABLED`.
   Owner actions by the standing carve-out (real money).

## Re-derive, never remember

```bash
npx tsx scripts/audit-live-claims.mjs                 # live claims on published sites (3 buckets)
psql "$SUPABASE_DB_URL" -c "select status, count(*) from outreach_prospects where industry_key <> 'restaurant' group by 1"
psql "$SUPABASE_DB_URL" -c "select domain_status, subscription_status, payment_count from trade_site_subscriptions"
```
