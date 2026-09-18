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
