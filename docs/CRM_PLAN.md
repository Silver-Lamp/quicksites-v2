# CRM Plan

> Status: **planning** (2026-07-07). Grounded in an audit of the current customer/contact/comms code.
> Companion to [`docs/MONETIZATION.md`](MONETIZATION.md), [`docs/RESELLER_GTM.md`](RESELLER_GTM.md), and the commerce money-path in [`CLAUDE.md`](../CLAUDE.md) §5.

## TL;DR

QuickSites today has **no buyer/customer entity**. Orders don't store who bought them — buyer email/name exist only as un-indexed JSON inside `payments.raw`. Every "customer" in the code means the *merchant's* Stripe object, and every attribution/analytics signal is keyed to `merchant_id`, never a buyer. **The entire CRM hinges on one foundational move: build a customer identity spine (keyed by email) and populate it from Stripe.** Everything else — order history, segments, campaigns — depends on that spine existing first. The good news: sending rails (email/SMS + logs), a prospect pipeline (`leads`), and consent/unsubscribe primitives already exist to build on.

## 1. What exists today

- **Orders capture no buyer identity** — `orders` has a bare, never-populated `customer_id uuid` (no FK, no `customers` table), plus `customer_note` (free-text instructions, not identity). No `customer_email/name/phone`. Shipping address is collected **only** for print-on-demand (`print_orders.shipping_address`). Buyer email lives only in `payments.raw` (`lib/commerce/orders.ts#markOrderPaid`).
- **Three unlinked capture paths, none a buyer CRM:**
  - `form_submissions` — per-site "contact us" block (`name, email, phone, service, site_slug`).
  - `contact_messages` — the QuickSites marketing contact form.
  - `leads` — **B2B cold prospects** for outreach (`business_name, contact_name, phone, email, outreach_status, status, notes, industry, campaign linkage`). The closest thing to CRM records, but for prospective *merchants*, not buyers. Admin at `/admin/leads`, `/admin/campaigns`, `/admin/outreach` (the outreach funnel actually runs on `templates.claim_source`).
- **Comms rails (reusable):** `sendEmail` ([`lib/email.ts`](../lib/email.ts), org-branded), `sendSms` ([`lib/sms/sendSms.ts`](../lib/sms/sendSms.ts), currently only the claim OTP). Per-message logs in `email_logs` / `call_logs`. A 1:1 restock pipe via `email_outbox` + `email-drain` cron. Consent/opt-out primitives: `waitlist_subscriptions`, `supporters`, `/admin/unsubscribe/[token]`.
- **Attribution (merchant-level only):** `referral_codes`/`attributions`/`commission_ledger` answer "which rep referred this *merchant*," never "which campaign brought this *buyer*." Analytics events all keyed to `merchant_id`; **zero buyer-level events**.
- **No customer-facing management UI** anywhere. The merchant order list (`app/merchant/orders/page.tsx`) shows status/total but **no buyer name/email** — because that data doesn't exist.

## 2. Guiding principle

**Identity spine first.** Until a buyer has a stable, queryable identity, nothing else in a CRM is possible. The highest-leverage first move is to extract buyer email/name/shipping from the Stripe checkout session at `markOrderPaid` into real columns + a `customers` table keyed by normalized email. Do this before any UI or campaign work.

## 3. Phased plan

### Phase 0 — Identity spine (prerequisite for everything)
1. **`customers` table** — `(id, merchant_id, email_normalized, email, name, phone, marketing_consent bool, stripe_customer_id?, first_order_at, last_order_at, orders_count int, lifetime_cents bigint, tags jsonb, created_at, updated_at)`, `unique(merchant_id, email_normalized)`. Deny-default RLS; merchant-owner read; service-role writes. (Email is PII — treat like the crown-jewel tables already locked in the RLS sweep.)
2. **Populate from Stripe** — in `markOrderPaid`, pull `customer_details.{email,name,phone}` + `shipping` from the session; upsert the `customers` row (increment `orders_count`, add to `lifetime_cents`, set `last_order_at`); set `orders.customer_id` and **denormalize `orders.customer_email`** for querying. Collect shipping on all orders (Stripe already gathers it when `shipping_address_collection` is on).
3. **Optional email at checkout** — QuickSites' own checkout collects no buyer fields today; consider a lightweight email capture pre-Stripe so abandoned/test orders still have identity (decision below).
4. **Backfill** — a one-off script parsing existing `payments.raw` → `customers` + `orders.customer_email`, deduped by email.

*Deliverable:* every paid order is tied to a deduplicated customer. ~2–3 PRs.

### Phase 1 — Customer surfaces
1. **Merchant customer list + profile** — `/merchant/customers`: searchable list (name/email), and a profile with order history, LTV, contact, shipping. 
2. **Add buyer identity to the merchant order view** (currently blank).
3. **Dedup + merge** by normalized email; manual merge for stragglers.

*Deliverable:* merchants can see who their customers are. ~2 PRs.

### Phase 2 — Organize & engage
1. **Tags & segments** — `customers.tags jsonb` + saved segments defined by filters (has ordered, spend > X, last order > N days, product bought, city). A `customer_segments` definition table; segments resolve to a live query.
2. **Activity timeline** — unify per-customer events (orders, `email_logs`, SMS, `form_submissions`) into a `customer_activity` view/table keyed to `customer_id`. Add buyer-level analytics events (`customer_created`, `repeat_purchase`) to `lib/analytics/events.ts`.
3. **Notes** — free-text notes on a customer (reuse the `leads.notes` pattern).
4. **Consent** — wire `marketing_consent` + reuse `/admin/unsubscribe/[token]` so marketing is opt-in and one-click-out (CAN-SPAM/GDPR hygiene).

*Deliverable:* segmentable, annotated customer records with history + consent. ~3 PRs.

### Phase 3 — Marketing (email/SMS campaigns)
1. **Audience builder** over segments → **campaigns** — a `campaigns` + `campaign_sends` table (distinct from the existing geographic *lead* campaigns), sending via the existing `sendEmail`/`sendSms` + `email_outbox` drain, with scheduling and per-send logging keyed to `customer_id`.
2. **Templates** — reuse the org-branded email builder in `lib/email.ts`; add a few campaign templates (new-product, win-back, restock).
3. **Metrics** — opens/clicks (Resend webhooks) + attributed orders.

*Deliverable:* consented email/SMS marketing to real customers. ~3–4 PRs.

### Phase 4 — Unify prospects & customers (optional)
Generalize the mature `leads` pipeline (stages, notes, campaigns) into a single **contacts** abstraction spanning cold prospects → buyers, so one funnel view covers acquisition → retention. Large; only if the two-model split becomes friction.

## 4. Privacy, consent, RLS
- Customer PII (email/phone/address) is sensitive — deny-default RLS, merchant-owner scoped reads, service-role writes; never expose cross-merchant. See the RLS hardening notes in [`CLAUDE.md`](../CLAUDE.md) §6.
- Marketing requires explicit `marketing_consent` + working unsubscribe before any Phase 3 send.
- Per-merchant customer records (a buyer of two different merchants = two customer rows) — simplest + privacy-safe. A platform-wide identity graph is explicitly **out of scope**.

## 5. Open decisions
- **Collect email at QuickSites checkout, or rely solely on the Stripe session?** (Recommend: rely on Stripe for paid orders in Phase 0; add optional pre-Stripe email later for abandoned-cart.)
- **Per-merchant vs shared customer identity** across merchants. (Recommend: per-merchant.)
- **Sequencing vs Inventory** — see below.

## 6. Recommended sequencing (both plans)
- **Inventory Phase 1 is a fast, contained win** (unify the stock field, backorder + track toggles, refund restock, SKU) — the atomic core is already done, so it's mostly wiring + UI.
- **CRM Phase 0 is the single highest-leverage foundational move** (unlocks all future customer value) but is net-new.
- **Recommendation:** ship **Inventory Phase 1** first (quick correctness + parity win), then **CRM Phase 0** (the identity spine) as the strategic foundation — they're independent and can even run in parallel. Defer Inventory Phase 3 (multi-location) and CRM Phase 4 (unified contacts) until demand appears.
