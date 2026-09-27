# Pay-per-call leads (PPL) — the eighth vertical

> Status 2026-09-18: **built, flag-gated OFF** (`PPL_ENABLED`). Zero accounts, zero deposits,
> zero billed calls. Re-derive every number from the ledger; nothing in this file is a source of truth.

## 1. What it is

The geo-domain rental sells a **domain** for a flat monthly rent. This sells the **calls** the
same domain produces. A business prepays a balance; every call to the campaign's tracking number
that is **answered and lasts ≥ 90 s** deducts one lead price (default **$85**); under a threshold
(**$300**) the card on file tops it up (**$1,200**); at zero the line stops connecting and says so.
The business can contest any charge for **72 h**; an approved dispute credits the balance against
that call, with the recording as the evidence.

Same asset, same tracking number, same Twilio path as the rental — a different price shape for a
shop that will not sign a subscription for a domain it does not understand but will pay for a
ringing phone it just answered. Rent sells scarcity; this sells outcomes.

Origin: a third-party (Gemini) design (`~/Downloads/ppl_telephony_billing_suite/`, 2026-09-18).
Its shape was sound and its draft was not: it never wired the billing step into the flow, its
Stripe webhook accepted unsigned events, its reload could credit the balance twice, and its IVR
lied to callers. Each of those is now a DB constraint, a test, or a forbidden phrase here.

## 2. Where it lives

| Piece | Path |
|---|---|
| Ledger + accounts + disputes (DB is the truth) | `supabase/migrations/20260843_ppl_billing.sql` |
| Rules — billability, routing, reload, dispute window (pure) | `lib/ppl/rules.ts` |
| IVR TwiML + the forbidden-phrase list | `lib/ppl/ivr.ts` |
| Data access (service role) | `lib/ppl/accounts.ts` |
| Money path — bill, reload, deposit, portal | `lib/ppl/billing.ts` |
| Statements (Resend + Twilio SMS) | `lib/ppl/notify.ts` |
| Balance gate before the bridge | `app/api/twilio/geo/[campaignId]/route.ts` (the `pricing_model === 'ppl'` branch) |
| **The one place a charge is posted** — signed `<Dial action>` callback | `app/api/twilio/ppl/complete/route.ts` |
| Deposits (Checkout, card saved off-session) | `app/api/stripe/geo-webhook` → `applyPplCheckoutCompleted` |
| Operator: open account / deposit link / ledger / credit | `app/api/admin/ppl/accounts`, `…/accounts/[id]` |
| Post-checkout landing (content-free by design) | `app/ppl/funded` |
| Gate + vertical | `lib/config/health.ts` (`ppl`), `lib/business/verticals.ts` (`ppl`) |

## 3. The money path, in order

1. Caller dials the tracking number → `/api/twilio/geo/<campaignId>`. If the campaign is `ppl`:
   look up the account; if none / not `active` / balance < one lead → **"This line is not
   connecting calls right now"** + voicemail. Else: recording notice → `<Dial action=…/ppl/complete>`.
2. Business hangs up → Twilio POSTs `DialCallStatus` / `DialCallDuration` to `/api/twilio/ppl/complete`.
   **Signature verified over the full URL incl. query string.** Not `completed` or < min seconds →
   nothing. Else `postLedger(lead_charge, −cpl, call_sid)`.
3. The DB function `ppl_post_ledger` row-locks the account, inserts, moves the cached balance —
   or returns NULL on the unique index (`call_sid` among lead charges). NULL = `already_billed`;
   Twilio retries are free.
4. Balance under threshold and `auto_reload` → PaymentIntent off-session, idempotency key
   `ppl_reload_<account>_<chargeLedgerId>` (deterministic per triggering charge — **never a time
   bucket**). Success → `postLedger(deposit, +amount, stripe_payment_intent_id)`; the unique
   index on the PI id makes a duplicate credit impossible. `requires_action` (3DS) is a failure.
5. Still can't afford the next lead → `status='paused'` + the paused notice. A later deposit
   (Checkout or reload) un-pauses.
6. Statements last, best-effort: lead SMS to the business, top-up email, declined email+SMS.

Deposits: the operator mints a Checkout link (`mode=payment`, `setup_future_usage=off_session`);
`checkout.session.completed` with `metadata.ppl_account_id` saves customer + payment method,
credits the deposit (idempotent on the PI), activates.

## 4. Honesty rules (tested)

- The caller is a member of the public phoning a local business. When the balance is out they
  are told the line **is not connecting calls right now** — never "at capacity", never a
  seasonal excuse. `FORBIDDEN_IVR_PHRASES` in `lib/ppl/ivr.ts` is grepped against every output.
- The IVR makes **no claim about the business**: not licensed, insured, specialist, 24/7. Name,
  recording notice, bridge.
- It is a **prepaid balance**, never "escrow" — the funds are not held in escrow.
- No message promises a feature that does not exist. There is no web-lead buffer; the paused
  notice does not say there is.
- Leads-remaining is computed from the account's own `cpl_cents`, never a constant.

## 5. Operating it (flag on)

```
POST /api/admin/ppl/accounts      { geo_campaign_id, business_name, contact_email, contact_phone, deposit_cents? }
  → creates the account (status pending), sets the campaign to pricing_model='ppl', returns checkout_url
  → send checkout_url to the business; the webhook activates the account on payment
GET  /api/admin/ppl/accounts/<id>  → account + ledger + Stripe portal URL (card updates)
PATCH …/<id>                        { cpl_cents | reload_* | auto_reload | status | credit: { call_sid, memo } }
POST  …/<id>                        { action: 'deposit_link', deposit_cents }
```
A dispute today is a phone call/email to the operator and a `credit` PATCH against the
`call_sid`; the `ppl_disputes` table exists for the owner-facing form (Phase 2).

Revenue = `sum(amount_cents) where kind='lead_charge'` + `sum where kind='dispute_credit'`,
by account, from `ppl_ledger`. The DB computes it; nobody remembers it.

## 6. Not built (deliberately, for now)

- **Owner-facing statement + dispute form** (`ppl_disputes` schema is ready; the 72 h window is
  in `rules.ts`). Until then the operator credits by hand.
- **ZIP / intent IVR menus** from the draft. They add friction before the bridge and cost
  conversions; territory and intent problems are what the dispute window is for. Revisit if GEO
  disputes dominate.
- **Deciding rental vs PPL per campaign.** They compete for the same domain; a first pitch will
  decide it.
- Voicemail from a paused line lands in `call_logs` via `/api/twilio-callback` like any other;
  nobody is told about it yet.

## 7. Decisive test

Open one account on the campaign with the most measured calls, send the deposit link, count
billed calls and disputes for 30 days. Cost: one conversation and the flag.

## 8. Roadmap — what is outstanding, in the order it unblocks

Written 2026-09-18 after PR #972. Each phase names who can do it: **owner** = only Sandon
(env, money, a conversation), **session** = a coding session without him. Owner items are
also filed on `/admin/tasks` (`source='session:2026-09-18'`) so they outlive this file.

### Phase 1 — prove the rail takes money (owner, ~1 hour + 30 days of waiting)

0. ⚠️ **Three facts checked 2026-09-18 that set the order.** (a) `0 of 103` geo campaigns has a
   tracking number and 0 of 32 `call_logs` rows is tagged to one — the call-tracking code has
   never run in production. (b) **Production has no `TWILIO_*` env at all** (`/status` → `sms:
   incomplete`); the forwarding that exists lives in Sandon's Twilio console, not in this app.
   (c) **graftontowing.com** is live on a custom domain (a legacy `sites` row, not a campaign)
   showing **262-228-2491** — per Sandon, a Twilio number forwarding to an existing Grafton
   towing business. That is the only ranked-site phone that already rings through Twilio.
   ⚠️ **Consent boundary.** Several pitch sites (towing, `pnw-exteriorcleaning.com`) carry a
   **real local provider's own number**, placed so a visitor who calls is not let down. Those
   providers never asked for anything. PPL bridges to, records for, and bills **only the account
   holder's `contact_phone`** — the route never falls back to a campaign's `forward_to` (source
   guard in `rules.test.ts`). The goodwill numbers stay exactly as they are.
1. **Phase 1 campaign = graftontowing.com**, not the page-one geo row. It already has a Twilio
   number in front of a real business that has been receiving its calls — the pitch writes
   itself ("you have been getting these calls free; here is the meter"), and the business's
   agreement IS the consent event. Fallback if they decline: `ashland-city-towing.com`
   (page one, position 1, unrented) with a freshly provisioned number.
1b. **Owner: put the Twilio account that owns 262-228-2491 into Vercel production**
   (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`) and redeploy — nothing in
   this vertical (or claim verification, or demand-capture SMS) works without it. Also note
   the number's current voice configuration in the console (a plain forward? a TwiML bin?
   does it record?) — a session needs that to repoint it without dropping calls.
1c. **Session: make Grafton a campaign.** Insert a `geo_industry_campaigns` row (`kind
   geo_services`, `domain graftontowing.com`, `template_id` = the published `graftontowing`
   template) with `tracking_number = +12622282491`, then repoint the number's voice URL at
   `/api/twilio/geo/<campaignId>` via the Twilio API. Calls keep forwarding exactly as before
   (plus the recording notice) and start landing in `call_logs`. **A week of those is the
   pitch's proof number.**
2. **Have the conversation** — with the Grafton business, after a week of `call_logs`. The
   pitch is one sentence: *"Your line has been getting N calls a week from graftontowing.com;
   pay $85 only for the ones that reach you and last 90 seconds, contest any within 72 hours."*
   Ask for the number calls should bridge to (E.164 — this becomes `contact_phone`, the ONLY
   number PPL will ever dial) and the email statements go to. If they say no, the number keeps
   forwarding for free as it does today, and the fallback campaign gets a fresh number.
3. **Open the account** (admin session): `POST /api/admin/ppl/accounts` with
   `{ geo_campaign_id, business_name, contact_email, contact_phone, deposit_cents: 50000 }`.
   A smaller first deposit ($500) than the reload default is deliberate — proof before volume.
4. **Send the returned `checkout_url`.** The webhook activates the account on payment; check
   `select status, balance_cents, stripe_payment_method_id from ppl_accounts` — a null payment
   method means Checkout did not save a reusable card and reloads will fail honestly.
5. **Flip `PPL_ENABLED=1`** in Vercel (production), redeploy, confirm `/status` shows `ppl: ready`.
6. **Place one test call yourself** to the tracking number, stay on ≥ 90 s after the business
   answers, hang up. Within a minute: one `lead_charge` row, one SMS to the business. That call
   is the proof of the two Twilio claims in PR #972 (`DialCallDuration` on the action POST; the
   signature covers the query string). If no row appears, the callback 403'd — Sentry has it.
   Credit the test call back: `PATCH …/accounts/<id>` `{ credit: { call_sid, memo: 'test call' } }`.
7. **Wait 30 days.** Revenue = the ledger. Disputes = phone calls to you for now (Phase 2 makes
   them self-serve).

### Phase 2 — the business can see what it paid for — ✅ BUILT 2026-09-19 (PR: statement + disputes)

Shipped: `/leads/<signed token>` (`lib/ppl/statementToken.ts`, one-year HMAC token, closing the
account revokes it) shows balance, every charge with caller/duration/recording, credits, and a
"Contest this charge" form inside the 72 h window → `POST /api/leads/dispute` (rate-limited,
token + ownership + window checked in `lib/ppl/disputes.ts`) → `ppl_disputes`. Recordings stream
through `GET /api/leads/recording/<callSid>?t=` (Twilio creds stay server-side; only a call
charged to that account). `/admin/ppl` lists open disputes with **Approve + credit / Deny**
(`PATCH /api/admin/ppl/disputes/<id>`) — approval posts a `dispute_credit` against the same
call_sid; both outcomes email the business. Statement links ride the top-up and paused emails
and the account-creation response. Original brief below.

### (original) Phase 2 brief

- **Owner-facing statement page** at `/leads/<token>`: balance, every charge with caller
  number, duration, recording link (Twilio `RecordingUrl` lands in `call_logs` via the existing
  callback — confirm it is stored), and a **dispute button** per charge inside the 72 h window
  (`ppl_disputes` + `rules.disputeWindowOpen`). Access by a signed, revocable link in every
  statement email — not a login; these owners will not create an account.
- **Dispute decision surface** on `/admin/ppl`: open disputes, listen, approve (posts
  `dispute_credit` against the `call_sid`) or deny with a note; both send the matching email
  (templates already drafted in `~/Downloads/ppl_telephony_billing_suite/templates/`).
- **`/admin/ppl` operator page**: accounts, balances, last charge, paused flags, deposit-link
  button — the API exists, the page does not.
- **Voicemail from a paused line** is recorded but nobody is told. Email the business the
  recording with "this caller could not reach you because your balance was at zero".

### Phase 3 — make it sellable without a conversation (session, ~1 day; owner: pricing sign-off)

- **`/pricing` path D** ("Lead-gen / no online store") should describe PPL with the real
  mechanics (≥ 90 s, 72 h, prepaid) and no printed price — price is a per-account column.
- **A per-campaign pitch page** `/leads/pitch/<campaignId>` for the postcard/SMS: the
  domain's rank, calls last 30 days from `call_logs`, and the deposit link. Rides the existing
  claim-link tracking (`/go/<prospectId>`).
- **Rental vs PPL decision per campaign**: a rule in `lib/prospects/rankedOpportunities.ts` —
  ranked + ≥ N calls/month → pitch PPL first; ranked + few calls → rental. Needs 30 days of
  Phase 1 data to set N.

### Phase 4 — run it without a person (session; owner: policy decisions)

- **Monthly statement cron** (`/api/cron/ppl-statements`): balance, charges, credits, per
  account; `cron_runs` logged.
- **Stale balance policy** (owner decides): a prepaid balance untouched for 90 days is a
  refund waiting to happen. Refund automatically, or hold? Write the answer into the T&C.
- **Contract text**: Gemini's Master T&C + Schedule A were never saved (they were in an unsaved
  editor buffer). Whatever is signed must match the code: 90 s, 72 h, "prepaid balance", the
  categories in `ppl_disputes.category`. The agreements rail (`crosstalk/contracts/
  agreements-record.md`) is the place to sign it.
- **Reconciliation**: nightly compare `sum(ppl_ledger.amount_cents)` to `balance_cents` per
  account and to Stripe's PaymentIntents by `stripe_payment_intent_id`; file an `admin_task`
  on drift. Same shape as `app/api/admin/commerce/reconcile`.

## 9. Mass deploy — the strategy at fleet scale (owner direction, 2026-09-18)

Sandon: *"I can buy numbers as needed for area codes … so that we can mass-deploy this strategy."*
The strategy is the goodwill pattern he already runs by hand, as a pipeline:

```
ranked geo site ──► tracking number (auto-provisioned, local area code)
                ──► forwards FREE to a real local provider (picked from the sweep data)
                ──► every call logged to the campaign
                ──► after N calls: "you've been getting these free — here is the meter"
                ──► PPL account (consent) ──► ledger
```

Free calls first, metered calls second; the receiving business's *yes* is the only thing that
ever turns a forward into a charge. What has to be true for this to be honest at scale, and
what each piece needs:

| Step | Exists? | Needs |
|---|---|---|
| Twilio creds in prod (`TWILIO_*`) + `CALL_TRACKING_ENABLED=1` | ✗ | **owner** |
| Auto-provision a local number per campaign (`provision-number`, area code from `forward_to`) | ✓ code, never run | creds; ~$1.15/number/mo + minutes — **owner approves the spend** (103 campaigns ≈ $120/mo before minutes) |
| Attach a hand-bought number (`attach-number`) | ✗ | session (filed) |
| **Pick the forward-to business** for a campaign from the sweep's Places data (open, rated, has a phone, in that city × industry) — the choice Sandon makes by hand today | ✗ | session. Rule must be a pure function with a test; the fallback is "no forward, take a message", never a guess |
| Push the tracking number into the pitch site's phone + republish (all three content copies) | ✗ | session (filed) |
| Recording notice before every bridge | ✓ (#972) | — |
| **Tell the receiving business once**, by SMS to the forwarded number: "calls from <domain> are being forwarded to you free; reply STOP to stop" + honour STOP by clearing `forward_to` | ✗ | session. **Not optional at scale** — one provider at a time is goodwill; a hundred without a word is a list nobody consented to be on |
| Per-campaign proof number: calls ≥ 90 s last 30 days, from `call_logs` | ✗ (counts exist, not the ≥ 90 s cut) | session — the same figure the pitch and the ops tile use |
| The pitch at N calls: email/SMS/postcard "N calls in 30 days, here is the meter" → deposit link | ✗ | session, rides `lib/outreach/*`; **no printed price on a postcard** (the claim-postcard rule) |
| PPL account on yes; nothing changes on no | ✓ (#972) | — |
| Fleet view on `/admin/growth`: number / forward-to / calls-30d / pitched / account per campaign | ✗ | session |

Order for the sessions once creds land: attach-number → pick-forward-to → push-number-into-site
→ notice + STOP → proof number → pitch. Grafton is the first row through every step by hand
before any of it runs unattended.

## 10. Next steps, in order — the sequence the board cannot show

Every item below is an `admin_tasks` row (`source='session:2026-09-18'`, 25 rows); the board
sorts by status and priority, so this is the dependency order. **O** = owner, **S** = session.
A step is not started until the one above it is done, except where marked ∥ (parallel).

| # | Step | Who | Unblocks |
|---|---|---|---|
| 0 | `TWILIO_*` creds for the account that owns 262-228-2491 into Vercel prod; how that number is configured today; the list of goodwill-number sites | **O** | everything |
| 0∥ | Decide the first cohort + spend (recommend: meter every ranked domain free for 30 d); `CALL_TRACKING_ENABLED=1` | **O** | 4, 6 |
| 0∥ | Reload/deposit defaults ($500 / $300 / $150 recommended until disputes are self-serve) | **O** | 8 |
| 1 | `attach-number` admin action; make graftontowing.com a campaign; repoint 262-228-2491 | S | 2, 3, 5 |
| 2 | Push tracking number into the pitch site + the "calls answered by / connected to a local provider" label; republish | S | 3 |
| 3 | One-time SMS notice to the forwarded business + STOP handling | S | 4 (nothing forwards at scale before this) |
| 4 | `pick-forward-to` rule over sweep data (pure, tested; fallback = voicemail) → cohort gets numbers | S | 5 |
| 5 | Proof number (calls ≥ 90 s / 30 d) per campaign; fleet view on `/admin/growth` | S | 6, 7 |
| 6 | **30 days of free forwarding on the cohort.** Read the distribution. Nothing is sold yet. | — | 7, 8 |
| 7 | The Grafton conversation → account → deposit → `PPL_ENABLED=1` → one test call → 30 d | **O** | 8, 9 |
| 8 | Pitch at N calls (email/SMS/postcard, no printed price) with the deposit link | S | scale |
| 9 | Phase 2: statement page, self-serve dispute, `/admin/ppl`, voicemail-while-paused notice | S | 10 |
| 10 | Partner residual on lead charges (`commission_ledger`) — the channel sells it | S | reps |
| 11 | Phase 3: `/pricing` path D copy, pitch page, rental-vs-PPL rule (needs step 6 data) | S | — |
| 12 | Phase 4: statement cron, ledger↔Stripe reconciliation; stale-balance policy (**O** decides) | S/O | — |
| 13 | Overflow marketplace (second account per city); auto-shop cohort; demand map → planner | S | later |

Also on the board from this session, unrelated to PPL: Lob webhook secret (**O**, high),
Agency plan not billable (**O**), Vercel Analytics toggle (**O**), HJ rehearsal run (**O**),
43 unmailable trade drafts (**O** decides), delete the dead $500 checkout route (S), save
Gemini's prose (**O**, low).

### Dome builders — the first mass-deploy cohort, LIVE 2026-09-19

Sandon: *"work with DomeSketch (new to the grid) to corner the market on 'dome builders near me'."*
Measured first (a Places sweep per state, in-state, dome-named — supply, not demand), then bought
**13 state + 8 national** exact-match `.com`s ($236.25, Vercel registrar, auto-renew), then built
and published a **directory** site per state (`lib/domeBuilders/buildDirectorySite.ts`, block
`builders_directory`, industry `dome_builder`, script `scripts/dome-builders-launch.mts`): hero →
sourced builders (Google Maps listing or DomeSketch's `orgs.json` `sources[]`) → dome FAQ → "are
you a builder here? get listed". ⚠️ **A directory page must never speak as a business** — no
services, no phone, no "free quote"; the scaffold's first-person copy is exactly the invented-
business failure, so the builder replaces the blocks and a test pins hero→directory→faq→contact.
Live: `texasdomebuilders.com` (9 entries), `floridadomebuilders.com` (7), … 41 entries across 13
states. The DomeSketch calculator is the CTA (UTM `utm_source=<domain>`). Proposal to DomeSketch
in crosstalk (2026-09-19 21:41); their feed URL + region data will replace the repo read. Next:
a tracking number per state page → free forward to the best listed builder → notice → PPL at a
dome lead price. National domains (`domebuildersnearme.com`, …) are registered but unpointed.

### Explicitly not planned

- ZIP/intent IVR menus before the bridge (friction; disputes cover it).
- Twilio Functions / Studio (no raw body → no Stripe signature; the draft's whole class of bug).
- Any per-lead price in copy or env. It is a column.

---

## 11. Who the calls go to — the forward-to recommender (2026-09-27)

`lib/ppl/forwardCandidates.ts` (pure) ranks the businesses a campaign could forward to, from
`outreach_prospects`; `lib/ppl/forwardSuggestions.ts` loads the data and `/admin/ppl` renders it
under **Suggested forward-to**.

**Hard requirements** filter (usable phone, matching trade, matching city *and* region, not opted
out). Everything else scores: no website (+40, the whole pitch), a shrunk rating, a small bonus
for a business already in our funnel, and a heavy penalty plus a flag when the number already
takes calls for another domain.

⚠️ **The pool verdict matters more than the ranking, and the module says so before it names a
winner.** The three markets it was built for — South Hill, Cullman, Covington — each hold exactly
two towing candidates from a shallow **2026-07-12** sweep with **no ratings at all**, while every
sweep since returns 14–19 per city with ratings on nearly all. Ranked, those pairs come out
**61–61, an exact tie**: there is genuinely nothing to choose between them, and a recommender that
named a winner anyway would be laundering a coin flip into a decision about where a stranger's 2am
towing call lands. `assessPool` returns `stale`/`thin`/`empty` and says *re-sweep this city*.

⚠️ **`autoApplyEligible` is separate from the score on purpose.** It needs a `usable` pool, ≥3
candidates, no flag on the winner, and a ≥15-point margin. Arab, AL — 21 candidates, 19 rated —
still reads `false`, because its top two are 75 and 71. Being first of two is not evidence.

⚠️ Scoping is by **GSC impressions**, not by holding a number (`provision-number` takes
`forwardTo`, so the forward-to is an *input* to buying the number) and not by `rank_status`, which
reads `unranked` for all three markets because the rank sync never wrote a rank — filtering on
`page1` would have excluded exactly the campaigns in question while looking principled.

⚠️ Candidates are **deduped on the normalised phone**: repeat sweeps insert a second row for the
same business (live: "Space Age Wrecker and Recovery" twice on one number, once unrated from July,
once rated from September). Undeduped it shows the operator one business twice *and* inflates
`pool.qualified`, which gates auto-apply.

Every recommendation carries `requiresNotice: true` — `forwardNotice.ts` is part of attaching, not
a later courtesy.

## 12. One tracking number, one campaign (2026-09-27)

⚠️ **`attach-number` guarded only one direction.** It refused to give a campaign a *second*
number, but nothing stopped one *number* backing several campaigns — the direction that destroys
the measurement, since a shared number means no call can be credited to the site that earned it.

Found live: **+1 425 270 2226 renders on both `maplevalley-towing.com` and `millcreektowing.com`**,
with **13 calls logged and `geo_campaign_id`, `template_slug` and `custom_domain` NULL on every
one**. Not one of those calls is attributable. (`millcreektowing.com` has no campaign row at all.)

Fixed by `geo_campaigns_tracking_number_uniq` (migration `20260856`, a partial unique index —
route checks are advisory because bulk automation, scripts and hand-written SQL write the column
too) plus a `number_in_use` 409 naming the campaign that holds it. Verified: attaching Grafton's
live number to a second campaign raises the constraint.

⚠️ **The index does not cover the content copy.** The number is shared in the published snapshots,
and `millcreektowing.com` has no campaign row, so removing it from one of the two sites is a
separate content edit and an owner call about which site keeps it.

### 11a. The re-sweep, and the bug it exposed (2026-09-27)

Swept the three markets (`runSweep`, towing, 5 km): South Hill 16 found, Cullman 19, Covington 14
— normal depth. **But `rated` stayed 0**, which the "shallow July sweep" diagnosis did not predict.

⚠️ **`PLACES_FIELD_MASK` has always requested `places.rating` + `places.userRatingCount` — at a
pricier SKU, deliberately — and `runSweep` threw both away.** `ProspectInput` had no field for
them, so the columns the field mask exists to fill sat null unless `backfillPlaceSignals` ran: a
**second, separately-billed Place Details call per business**, flag-gated off. We paid the premium
tier for two numbers, discarded them at the door, then paid again to fetch them back.

Fixed: `ProspectInput.rating`/`reviewCount` → `toRow` → the sweep maps them off the search result.
Plus `fillMissingPlaceSignals`, because `upsertProspects` sets `ignoreDuplicates: true` (correct —
a re-sweep must not clobber a worked lead) which means a row created before ratings were stored
could never acquire one however often the city is swept. The fill is **gap-only** (`.is('rating',
null)`), never a refresh. Free — the values are already in the response.

**What it changed.** Before, South Hill's top pick was PNW Towing & Recovery on an unrated 61–61
tie with a 206 area code in a 253 town. After: **Too Cool Towing LLC, 4.8★ from 201 reviews, no
website, local 253** — a different business. The tie would have picked wrong half the time.

| campaign | pool | top pick |
|---|---|---|
| `covingtontow.com` | usable (11, 10 rated) | AL Ram Towing · (253) 234-7959 · 5★/71 · no site |
| `southhilltowing.com` | usable (10, 9 rated) | Too Cool Towing LLC · (253) 442-5373 · 4.8★/201 · no site |
| `cullmantow.com` | usable (5, 2 rated) | no clear winner — top three tie at 61 |

`autoApplyEligible` is `false` for all three (margins of 4, 5 and 0 against a ≥15 threshold), which
is the intended answer: pick one, then send the notice.

### 11b. Ties always resolve to a pick (owner direction, 2026-09-27)

> *"if there are ties now and in the future just have [it] pick one"*

The recommender never reports an unresolved tie. Leaving one open means the number stays
unattached and the calls go nowhere at all, which is worse for the caller than a well-reasoned
arbitrary choice.

⚠️ **But a tiebreak is not evidence, and the cascade is ordered so the arbitrary step is last.**
`Candidate.decidedBy` records what actually separated it from the next candidate, and
`decidedByLabel()` renders that on `/admin/ppl` beside the pick:

| `decidedBy` | meaning |
|---|---|
| `score` | the signals separated them — a real pick |
| `local_area_code` | tied; the local area code broke it |
| `more_reviews` | tied; more public evidence the business is real |
| `freshest` | tied; most recently confirmed to exist |
| `stable_name` | tied on everything — a stable rule, **not** a claim it is better |

**Why the area code is first.** It is deliberately kept *out* of the score (a tow operator's cell
is weak evidence, too weak to move a ranking) but it is decisive when nothing else separates two
businesses. Pre-ratings, South Hill tied 61–61 and fell to **PNW Towing (206)** over **Too Cool
Towing (253)** purely because "P" sorts before "T". When ratings arrived, Too Cool won on
4.8★/201. **The area code had the right answer the whole time and alphabetical order threw it
away** — which is the argument for ordering tiebreakers by evidence rather than convenience.

The last rung is the business name: deterministic, never random. A recommendation that changes on
reload cannot be reviewed or reproduced; a test asserts the same pool yields the same pick
regardless of input order.

⚠️ **A tiebreak never counts toward `autoApplyEligible`** — the ≥15-point margin rule is unchanged,
and a pick decided by rule is exactly the case an unattended write should not take. Picking one is
not the same as being sure, and the two are reported separately.

**Live picks after sweeping every market that needed it (2026-09-27).** Eleven cities swept;
every pool but one is now `usable`, and nothing rests on the arbitrary tiebreak.

| campaign | pick | pool | age | margin |
|---|---|---|---|---|
| `seatac-towing.com` | All Right Towing · (206) 414-1000 | usable 8/8 | 0d | **33 · AUTO-APPLY ELIGIBLE** |
| `renton-electrical.com` | Madrona Electric LLC · (425) 902-9422 | usable 27/27 | 0d | 17 (flagged, see below) |
| `renton-towing.com` | Gene Meyer's Towing · (425) 226-4343 | usable 15/15 | 0d | 12 |
| `arab-towing.com` | AA Wrecker Service · (256) 621-2003 | usable 20/19 | 0d | 4 |
| `covingtontow.com` | AL Ram Towing · (253) 234-7959 | usable 11/10 | 0d | 4 |
| `southhilltowing.com` | Too Cool Towing LLC · (253) 442-5373 | usable 10/9 | 0d | 5 |
| `florencetow.com` | Hicks Towing · (256) 827-5167 | usable 13/12 | 0d | 3 |
| `richland-towing.com` | RAPID WRECKER SERVICES LLC · (509) 396-1256 | usable 14/13 | 0d | 1 |
| `smyrna-towing.com` | Speed Wrecker Service Inc. · (615) 496-9742 | usable 6/5 | 0d | 4 |
| `cullmantow.com` | Simple Man Towing · (256) 917-5946 | usable 6/3 | 0d | 0 (more reviews) |
| `kent-restaurant.com` | Taqueria Del Sol · (253) 278-2905 | usable 60/60 | 45d | 2 |
| `paterson-auto-repair.com` | Fija Auto Glass & Mirror · (973) 345-1713 | usable 38/38 | 11d | 1 |
| `paterson-restaurants.com` | Deli DJ · (973) 345-5144 | usable 60/60 | 44d | 1 |
| `maplevalley-towing.com` | All Right Towing And Recovery · (206) 487-3600 | **thin 1/1** | 0d | — |

`seatac-towing.com` is the first campaign ever to clear `autoApplyEligible`: a usable pool, 8
candidates, no flag on the winner, and a 33-point margin.

### 11d. Distance, not the city label (2026-09-27)

⚠️ **`outreach_prospects.city` is the city we SEARCHED, not where the business is.** `runSweep`
stamps `input.city` onto every result, so a sweep centred on one town labels businesses tens of
km away with that town's name. Matching on it asks *"did we happen to discover you under this
label"*, which is not the question. **Maple Valley had 28 real candidates within range and
qualified ONE.**

`marketMatch()` now measures distance when both sides have coordinates, and falls back to
city+region equality when they do not — a campaign with no centre narrows to the old behaviour
rather than widening to everything.

⚠️ **The radius is per-trade, because "nearby" means two different things.** A tow truck, an
electrician or a plumber **drives to the customer**, so a shop 20 km out serves the town fine
(`lib/ppl/marketRadius.ts`, 20–30 km). A restaurant is the reverse — the **customer travels** —
and a taqueria 20 km away is simply not in the market (8 km). One global radius has to be wrong
for one of them.

⚠️ **The region guard now applies ONLY to the city-name fallback.** Distance already separates
Covington WA from Covington GA far better (3,800 km); re-applying a region test on top would
re-create the bug it was written to prevent, by excluding a business ten minutes over a state
line that genuinely serves the town.

#### The centres were NULL, and the first fix for that was wrong

`center_lat`/`center_lon` existed from the start and were **NULL on all 129 rows** — the columns
were declared and nothing ever wrote them. ⚠️ A session read the schema, saw the columns, and
reported that campaigns *"carry"* their coordinates. They carry the columns. Not the same claim.

Migration `20260858` seeded them from the **median prospect position** per city — local, free,
and **wrong**, for the same reason the city label is wrong. The check that caught it:

> AL Ram Towing's address is `25811 178th Pl SE, **Covington**, WA`. Against the median centres
> it sat **4.5 km from "Maple Valley" and 5.9 km from "Covington"** — nearer another town's
> centre than its own — so the recommender handed a Covington business to the Maple Valley
> campaign. Geocoded properly: **0.6 km from Covington**, 4.6 km from Maple Valley.

Fixed by `npm run backfill:campaign-centres` (`scripts/backfill-campaign-centres.mts`), which
geocodes the town itself: **74 of 76 towns, 127 of 129 campaigns**. Geocoding stays in a script,
never a migration — ~75 network calls at Nominatim's ~1 req/sec is not something to hold a
transaction open for. The two that failed (`Montlake Terrace` — our typo for *Mountlake*
Terrace — and `Marrowdale`) keep the city-name fallback and are reported, because degrading is
right and inventing a centre is not.

#### Overlapping markets: the shared-number bug in mirror image

⚠️ Distance matching **created a new conflict**. Under city names each town had its own pool, so
overlap was impossible. With a 25 km radius the Seattle-metro campaigns genuinely overlap, and
the single best-scoring tow company became the top pick for **four** of them — `covingtontow`,
`maplevalley-towing`, `renton-towing` and `seatac-towing` all recommended AL Ram Towing. Wiring
four domains to one phone concentrates every market's calls on one operator, and a caller who
rings two of our "different" sites reaches the same business. `forwardedElsewhere` does not
catch it: that reads campaigns already *attached*, and in a fresh run none are.

`deconflictTopPicks()` resolves it **by distance, not by score** — the business keeps the
campaign whose town it is closest to (the market it most plausibly serves), and every other
campaign moves to its next unclaimed candidate carrying a flag that says so. Resolving by score
would hand it to whichever market rates it highest, which is not a fact about who it serves. A
displaced pick is never `autoApplyEligible`, and a campaign whose every candidate went elsewhere
says so rather than re-using one.

#### The board after all of it

| campaign | pick | km | pool | margin |
|---|---|---|---|---|
| `covingtontow.com` | AL Ram Towing · (253) 234-7959 | 0.6 | usable 35 | 4 |
| `richland-towing.com` | Flatline Towing · (509) 380-0423 | 0.0 | usable 4 | 0 |
| `renton-electrical.com` | Madrona Electric LLC · (425) 902-9422 | 2.4 | usable 23 | 17 |
| `southhilltowing.com` | Too Cool Towing LLC · (253) 442-5373 | 4.8 | usable 29 | 5 |
| `cullmantow.com` | Trimble Towing & Automotive · (256) 841-7882 | 5.5 | usable 9 | 2 |
| `seatac-towing.com` | Prime Towing · (253) 326-5555 | 6.0 | usable 37 | 2 |
| `renton-towing.com` | All Right Towing · (206) 414-1000 | 9.9 | usable 34 | 0 |
| `maplevalley-towing.com` | V'Z Towing LLC · (253) 217-0639 | 11.2 | usable 28 | 1 |
| `paterson-auto-repair.com` | D&A Autoglass · (973) 985-7152 | 16.4 | usable 48 | 2 |
| `smyrna-towing.com` | White's Towing & Recovery · (615) 896-5844 | 16.7 | usable 29 | 0 |
| `florencetow.com` | B & D Towing and recovery · (256) 349-8125 | 19.5 | usable 8 | 0 |
| `arab-towing.com` | Osborne's Towing · (256) 498-0650 | 19.9 | usable 4 | 3 |
| `kent-restaurant.com` | Taqueria Del Sol · (253) 278-2905 | — | usable 34 | 2 |
| `paterson-restaurants.com` | Deli DJ · (973) 345-5144 | — | usable 39 | 1 |

**Every pool is usable, every pick is a different business, and nothing rests on the arbitrary
tiebreak.** Nothing is `autoApplyEligible`: the margins are 0–4 almost everywhere, and
`renton-electrical` (17) is held by its area-code flag.

⚠️ **One limitation deliberately left.** The "local" area code is derived from the pool, so a
sweep reaching into a bigger neighbouring metro adopts the metro's code — Renton reads **206**,
flagging Madrona Electric's genuinely local **425**. It fails safe (flags for a person rather
than acting) and a hardcoded city→area-code table would be worse.

### 11c. `last_seen_at` — freshness is the last observation (2026-09-27)

⚠️ **`created_at` was standing in for freshness and could not do the job.** `upsertProspects` sets
`ignoreDuplicates: true` (deliberate — a re-sweep must not clobber a worked lead), so a row is
stamped once at first sight and never touched again.

The failure: all 15 Renton towing rows carried `created_at = 2026-07-14`. A sweep re-observed 17
businesses there and inserted **0**, so the pool still read `stale` and advised *"re-sweep this
city"* — immediately after that city had been swept. **Advice the operator cannot satisfy by
following it** is worse than none: it looks like a finding and loops them.

`last_seen_at` (migration `20260857`, backfilled from `created_at`) is written by
`markProspectsSeen` for every place a sweep observes, inserted or not — the only thing a re-sweep
writes to a parked row, so status/owner/claim history stay untouched. `observedAt()` prefers it
everywhere freshness is judged. After the fix the same Renton sweep reports `seen=17` and the pool
reads `usable`, age 0d.
