# Auto-built Trade Sites — the automated pipeline

> The seventh vertical on `/business-plan` (`lib/business/verticals.ts`, key `trade_sites`).
> Build a working website for a local trade business from its public listing, for the ones that
> have none, and sell it for the price of a phone plan. **Self-serve by necessity**: a rep cannot be
> paid out of $19/mo, so it is a claim link and a card on file or it is nothing.
>
> This doc is the map of what runs without a person, what still needs one, and why each manual
> step is manual. Status lines carry dates; re-derive the numbers, never trust them.

## The loop

Drawn live on the public plan at `/business-plan?v=trade_sites` (`components/business-plan/trade-sites-flow.tsx`):
teal steps run on their own, amber ones need an operator, and the three counts under the nodes are
the evidence loader's, never typed in.

```
sweep city × trade  →  build drafts (no-website only)  →  deliver a claim link  →  claim
   →  site goes LIVE on its subdomain  →  owner buys a custom domain  →  domain provisioned
```

| Step | Code | Trigger | Status (2026-09-07) |
|---|---|---|---|
| 1. Sweep a city for one trade | `lib/prospects/runSweep.ts` (the button and the cron run the same function) | operator click **or nightly cron** | **automated (PR 2)** — the operator queues city × trade on `/admin/growth`; flag `TRADE_PIPELINE_ENABLED` |
| 2. Build drafts for the no-website tier | `lib/tradeSites/pipeline.ts` → `lib/outreach/buildDraftFromListing.ts` | nightly cron, `TRADE_PIPELINE_MAX_BUILDS` a night | **automated (PR 2)** — also drains the backlog of parked no-website trade prospects |
| 3. Deliver the claim link | `lib/outreach/claimPostcard.ts` + `claimPostcardSend.ts` → Lob; tracked link `/go/<prospectId>` | nightly cron (`TRADE_PIPELINE_MAIL_ENABLED`) or `/admin/growth` → Claim postcards | **automated (PR 3)** — a card to the listing's street address, after a 24h review window |
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

## PR 2 — the nightly sweep-and-build cron

`/api/cron/trade-site-pipeline` (06:00, before the GSC crons) drains `trade_sweep_queue` (migration
`20260839`) at `TRADE_PIPELINE_MAX_SWEEPS` a night, then builds a draft for every parked no-website
trade prospect without one, newest first, at `TRADE_PIPELINE_MAX_BUILDS` a night. The operator's
Discover button and the cron call the same `runSweep`; the operator's Build button and the cron call
the same `buildDraftFromListing` with the same `listingForProspect`, so a nightly draft is exactly
an operator's draft. Both pass the prospect's own `industry_key` — the guess defaults to
`restaurant` and has put menus on real tow companies twice.

**A person still chooses the cities** (queue rows on `/admin/growth` → "Nightly trade-site
pipeline"; one city or a metro fanned through `citiesForMetro`). The cron never invents a city.
Restaurants are refused at enqueue: they belong to the take-rate pipeline.

**Where the queue lives on the page (2026-09-08, pass 2).** The panel renders directly UNDER the
sweep form on `/admin/growth?tab=prospects`, and a single city is queued from **that form** — the
same city + trade chips as Discover, with two exits: **Discover** (sweep now, results below) and
**🌙 Queue for tonight** (the cron sweeps it). The panel itself only adds whole metros, runs the
planner, lists the queue, and mails the claim cards; its own city/state inputs are gone, and "Run
now" moved inside it, labelled as a spend. The rest of the tab: the Growth Coach's **active step
opens its section** (`STEP_SECTION` in `prospects-client.tsx`; everything else is a one-line header
with a count), competition clusters and restaurant contests are **chips inside the campaigns
section**, the map is collapsed, and every domain-spend surface moved to `/admin/domains/costs`.
Pinned by `components/admin/__tests__/growthLayout.test.ts`.

**Or let the data propose them.** "Plan the queue" (`POST /api/admin/prospects/sweep-queue/plan`,
`lib/tradeSites/queuePlanner.ts`) ranks city × trade pairs from two measured facts: **where we own
`<city>-<trade>.com`** (+50 — the pitch site and the claim card reinforce each other) and **how often
that trade has no website** (the measured rate once ten businesses have been seen, else the prior
from `docs/AUTO_SHOP_VERTICAL.md`: auto repair ~50%, towing ~45%, plumbing/HVAC ~25%, roofing 3%).
A pair swept inside the 60-day cooldown is skipped (a re-sweep dedupes on `place_id` and finds
nothing); a pair that measured under 10% is pushed down, not out. The operator sees the ranked list
with a reason per row, a **"low yield"** tag under 15% (`LOW_YIELD_RATE`), a tick-box per row, and a
button that says what it does: **"Add N after the M queued"**, with the night the last one would run.
The ticked rows go in **behind** everything already queued, in plan order (`prioritiesBehind`,
`lib/tradeSites/planQueue.ts`); already-queued pairs are skipped, never duplicated. ⚠️ The first cut
numbered a plan `N..1` — the same range as the previous plan — so a second plan **interleaved** with
the first and would have swept Arlington HVAC tonight ahead of the Braintree Towing a person had put
first. A click never reorders rows a person already queued; to run a new plan first, cancel the old
rows. Still a person's click — the planner proposes, it never enqueues on its own.

**Ownership of a nightly draft**: `TRADE_PIPELINE_OPERATOR_ID` → the queue row's requester → the
prospect's discoverer → the first `admin_users` row. Never null; an ownerless draft is invisible
to every admin list.

The cron reports `sweeps`, `noWebsiteFound`, `built`, `buildsFailed` **and a sample of slugs
built**, because a job that processes a hundred things and builds none still says `ok`.

## PR 3 — the claim postcard

Nothing delivered a claim link before this. Now every built, unmailed, no-website trade draft gets
one 6×9 card to the **listing's street address** — the same channel Google uses to prove control
of a Business Profile — carrying the site's address, a QR to the tracked link `/go/<prospectId>`
(which mints a fresh claim token on visit and counts the visit on the prospect, migration
`20260840`), the sender's name and email, and the exit: *"say the word and it's gone."*

**The card is the most conservative surface we own**, and `lib/outreach/__tests__/claimPostcard.test.ts`
greps the rendered HTML for every promise it must never make: no ranking / page-one / Google, no
availability or licensing claim, no guarantee, **no competitor and no deadline** (the competition
mechanic stays out of the message), and **no printed price** (a number on paper cannot follow the
env). What it says instead is what is true by construction: built from the public listing, free,
yours to edit, your own .com is the one thing we charge for.

**Volume (2026-09-09).** The 06:00 UTC pass mails 10; a second cron, **`/api/cron/trade-site-mail` at
20:27 UTC** (13:27 PT, when the previous afternoon's builds have cleared the 24h window), mails
whatever else is eligible in passes of 25, up to `TRADE_MAIL_AFTERNOON_MAX` a day (default 50, hard
max 100), stopping on an empty pool or anything that looks like a Lob 429. It **sweeps nothing and
builds nothing** — volume never drains the city queue. A manual `POST /api/cron/trade-site-pipeline`
also accepts clamped `{maxSweeps, maxBuilds, maxMail}` (zero allowed). ⚠️ The 24h review window is
not a knob on either path. ⚠️ **A Lob `test_` key is refused for a real send** (`lobKeyIsTest`) —
production ran one for a night and "mailed" 10 cards into Lob's test queue.

**Three gates before postage**: `TRADE_PIPELINE_MAIL_ENABLED` (the cron step), `POSTCARD_MAIL_ENABLED`
+ `LOB_*` (the same kill-switch as the operator button), and a **sender profile with name + email**
(a prospect must be able to reach a human). Plus two per-draft gates: a draft carrying an
operational claim anywhere in its tree is **blocked at send** and counted, never mailed; and the
cron never mails a draft the night it was built (`TRADE_PIPELINE_MAIL_MIN_AGE_HOURS`, default 24) —
one working day to look at last night's builds before a card goes out under a real business's
name. The operator's **Preview / Mail test card / Mail now** on `/admin/growth` run the same loop.

**Cold SMS stays off.** The claim link is a bearer credential and `docs/OUTREACH_METHOD.md` forbids
it in a cold text; that rule is about a phone that may be wrong or forwarded, not about mail to the
listed premises. `CLAIM_VERIFICATION_ENABLED` can additionally gate the transfer.

### A card needs a street, and 22 of the first 46 drafts had none (fixed 2026-09-08)

The July drafts that came from the legacy `leads` table stored **city-only** addresses ("Hartselle,
AL") and were blocked `unparseable_address` at send. ⚠️ **The failure was misdiagnosed twice, and
both wrong diagnoses were written down as the fix.** "Place Details rejects their stored `place_id`s"
— no: those rows carry a **synthetic `place_id = lead:<uuid>`** minted by `lib/outreach/migrateLeads.ts`,
so Details was never asked about a Google id; `backfillMailingAddress` (Details by id) can never
rescue one. "A fresh sweep of those cities fixes it" — no: `upsertProspects` is on-conflict-**do-nothing**
on `place_id`, so a sweep never rewrites a row; when Google returns the same shop under its real id,
the sweep inserts a **second prospect and the pipeline builds a second draft site for the same
business**. That had already happened — the 2026-09-07 Arab, AL sweep re-found five of them.

The fix is by **name**: `npm run outreach:backfill-addresses` (`lib/outreach/addressBackfill.ts`,
`scripts/backfill-prospect-addresses.ts`) runs one Places Text Search per blocked row and writes the
result back **only** when the name matches, the state matches, the address has a street number, the
town matches (or the name is near-exact **and** the result is within 60 km of the row's stored
coordinates — the first dry run matched a generic "Grant's Towing Service" to one 814 km away), and
**no other prospect already owns the returned `place_id`** (that is the duplicate detector: the real
row gets the card, the legacy row stays blocked and may be `--dismiss-duplicates`'d). Dry by default;
`--apply` writes; `--allow <id>` bypasses only the town/distance rule for a row a person has checked.
**`place_id` is never rewritten** — the migration counts `lead:%` rows to stay idempotent. Pinned by
`lib/outreach/__tests__/addressBackfill.test.ts`.

First run: 22 needed · **11 written** (all exact-name, same town or ≤5 km) · 5 duplicates of real
rows · 2 too far (Grant's 814 km; Ray's Trk & Wrecker 91 km — `--allow 8d9f6a11` if you judge it the
same shop) · 3 no result · 1 Google has no street either (Oakley's Towing). ⚠️ **The five duplicate
pairs each have TWO live draft sites** for one business; dismissing the legacy row stops the second
card but does not unpublish the second site.

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
npm run outreach:backfill-addresses                   # built drafts with no street to mail to (dry; --apply writes)
psql "$SUPABASE_DB_URL" -c "select status, count(*) from outreach_prospects where industry_key <> 'restaurant' group by 1"
psql "$SUPABASE_DB_URL" -c "select domain_status, subscription_status, payment_count from trade_site_subscriptions"
```
