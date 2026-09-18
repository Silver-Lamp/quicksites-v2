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

0. ⚠️ **No campaign has a tracking number** (checked 2026-09-18: `0 of 103`, and 0 of the 32
   `call_logs` rows are tagged to a campaign). The call-tracking code (`provision-number`,
   `/api/twilio/geo/<id>`) has never been run in production. So "the campaign whose phone
   already rings" does not exist yet; the pitch site's visible phone is the business's own.
1. **Pick the campaign by rank, not by calls.** `select domain, rank_position from
   geo_industry_campaigns where rank_status='page1' order by rank_position` — on 2026-09-18
   that is `ashland-city-towing.com` (position 1), then `franklin-towing.com` (7.8). Confirm
   it is not rented (`subscription_status` is empty for all three).
1b. **Provision the number** (admin session, ~$1.15/mo Twilio): `POST
   /api/admin/prospects/geo-campaign/provision-number` for that campaign, which buys a local
   number, points its voice URL at `/api/twilio/geo/<id>`, and writes `tracking_number` +
   `forward_to`. Then **re-publish the pitch site with the tracking number as its phone** —
   otherwise callers dial the business directly and nothing is ever measured or billed.
   Expect a few weeks of `call_logs` before the pitch has a number in it.
2. **Have the conversation.** The pitch is one sentence: *"Your line gets N calls a month; pay
   $85 only for the ones that reach you and last 90 seconds, contest any within 72 hours."*
   Ask for the number calls should bridge to (E.164) and the email statements go to.
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

### Phase 2 — the business can see what it paid for (session, ~1 day)

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

### Explicitly not planned

- ZIP/intent IVR menus before the bridge (friction; disputes cover it).
- Twilio Functions / Studio (no raw body → no Stripe signature; the draft's whole class of bug).
- Any per-lead price in copy or env. It is a column.
