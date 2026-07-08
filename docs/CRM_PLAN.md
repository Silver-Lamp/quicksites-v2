# CRM Plan

> Status: **Phases 0–3 shipped** (2026-07-07). Only Phase 4 (unify prospects & customers) remains, and it's optional. Grounded in an audit of the current customer/contact/comms code.
> Companion to [`docs/MONETIZATION.md`](MONETIZATION.md), [`docs/RESELLER_GTM.md`](RESELLER_GTM.md), and the commerce money-path in [`CLAUDE.md`](../CLAUDE.md) §5.

---

## ⭐ Status & new-session kickoff (read this first)

**Phases 0–3 are SHIPPED** (2026-07-07, PRs #220, #222–#229). The CRM is a complete loop: capture → see → annotate → segment → email → attribute. What's live:

### What shipped (all merged, all migrations applied)
- **Identity spine (Phase 0)** — `customers` table (`20260707_customers_identity_spine.sql`, per-merchant, deduped by `email_normalized`, deny-default RLS + `customers_owner_read`) + `upsert_customer_from_order` RPC. `markOrderPaid` step "3b" (`lib/commerce/customers.ts#recordCustomerForPaidOrder`) upserts the buyer + links `orders.customer_id`/`customer_email`. **NB:** `orders.customer_id` was missing from the live schema (a latent Phase-0 bug) and added by `20260707_orders_customer_id.sql`. Historical backfill: `npm run backfill:customers` (`scripts/backfill-customers.ts`, dry-run default; parses `payments.raw`).
- **Customer surfaces (Phase 1)** — `/merchant/customers` (list, `components/merchant/CustomersListClient.tsx`) + `/merchant/customers/[id]` profile (LTV, activity timeline); buyer email on `/merchant/orders`; "Merchant Customers" nav item.
- **Organize & engage (Phase 2)** — segments/filters/sort/tags (`lib/crm/segments.ts`), editable notes/tags/`marketing_consent` (`CustomerAdminPanel` → owner-gated `PATCH /api/merchant/customers/[id]`, `customers.notes` col via `20260707_customers_notes.sql`), and a unified **activity timeline** (`lib/crm/activity.ts` — orders + campaign receipts, keyed to `customer_id`).
- **Marketing (Phase 3)** — email campaigns to a segment: `crm_campaigns`/`crm_campaign_sends` (`20260707_crm_campaigns.sql`, **not** the geo-lead `campaigns` table), `/merchant/campaigns` composer, `POST /api/merchant/campaigns` (preview/test/send, owner-gated, consent-**always**-enforced, 250/send cap), one-click unsubscribe (`lib/crm/unsubToken.ts` + `GET /api/crm/unsubscribe`, `List-Unsubscribe` header), and last-touch 7-day **order attribution** (`lib/crm/attribution.ts`, revenue per campaign shown in the history table).

### What's next (open)
- **Phase 4** (optional) — unify prospects (`leads`) + buyers into one contacts model. Only if the two-model split becomes friction.
- **Enrichment follow-ups** (not blocking): ~~buyer/campaign PostHog events~~ **DONE** — `customer_created`/`repeat_purchase`/`campaign_sent`/`campaign_order_attributed`/`customer_unsubscribed` emit via `captureServer` (`lib/analytics/events.ts`, distinctId = the customer). Still open: campaign **open/click** metrics (Resend webhooks); **SMS** campaigns (`sendSms` rails exist); an **outbox/drain** path for sends above the 250 cap; **dedup/merge** UI for duplicate customers.

### Still-true caveat
- **`types/supabase.ts` does NOT include** `customers`/`crm_campaigns`/`crm_campaign_sends`. Read via the service-role `createClient(...)` untyped or cast `(supabase as any)`, as the shipped routes do. Don't fight the generated types.

### Decisions already made (don't relitigate)
- **Per-merchant** customer identity (a buyer of two merchants = two rows). No platform-wide identity graph.
- Phase 0 relies on the **Stripe session** for buyer email (paid orders only). Optional pre-Stripe email capture for abandoned-cart is a later, separate call.
- Customer PII is sensitive → keep RLS deny-default + owner-scoped; never expose cross-merchant.

Full phased plan below (P1 → P4).

---

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

### Phase 0 — Identity spine (prerequisite for everything) ✅ SHIPPED (PR #220)
1. **`customers` table** — `(id, merchant_id, email_normalized, email, name, phone, marketing_consent bool, stripe_customer_id?, first_order_at, last_order_at, orders_count int, lifetime_cents bigint, tags jsonb, created_at, updated_at)`, `unique(merchant_id, email_normalized)`. Deny-default RLS; merchant-owner read; service-role writes. (Email is PII — treat like the crown-jewel tables already locked in the RLS sweep.)
2. **Populate from Stripe** — in `markOrderPaid`, pull `customer_details.{email,name,phone}` + `shipping` from the session; upsert the `customers` row (increment `orders_count`, add to `lifetime_cents`, set `last_order_at`); set `orders.customer_id` and **denormalize `orders.customer_email`** for querying. Collect shipping on all orders (Stripe already gathers it when `shipping_address_collection` is on).
3. **Optional email at checkout** — QuickSites' own checkout collects no buyer fields today; consider a lightweight email capture pre-Stripe so abandoned/test orders still have identity (decision below).
4. **Backfill** — a one-off script parsing existing `payments.raw` → `customers` + `orders.customer_email`, deduped by email.

*Deliverable:* every paid order is tied to a deduplicated customer. ~2–3 PRs.

### Phase 1 — Customer surfaces ✅ SHIPPED (PR #222)
1. **Merchant customer list + profile** — `/merchant/customers`: searchable list, and a profile with order history + LTV. ✅
2. **Add buyer identity to the merchant order view.** ✅
3. **Dedup + merge** by normalized email — *still open* (a follow-up; no duplicate data yet).

*Deliverable:* merchants can see who their customers are. Shipped.

### Phase 2 — Organize & engage ✅ SHIPPED (PRs #224, #226, #228)
1. **Tags & segments** — `customers.tags jsonb` + segment filters (opted-in, repeat, recent, lapsed, tag), shared by the list + the campaign audience resolver (`lib/crm/segments.ts`). Shipped as **live client/server predicates**, not a `customer_segments` definition table (saved segments are a later add if needed). ✅
2. **Activity timeline** — `lib/crm/activity.ts` merges orders + campaign receipts (keyed to `customer_id`). ✅ (`email_logs`/`form_submissions`/SMS sources not yet folded in; buyer-level PostHog events still TODO.)
3. **Notes** — `customers.notes` + the profile editor. ✅
4. **Consent** — `marketing_consent` editable on the profile + one-click unsubscribe (`/api/crm/unsubscribe`, purpose-built rather than reusing `/admin/unsubscribe/[token]`). ✅

*Deliverable:* segmentable, annotated customer records with history + consent. Shipped.

### Phase 3 — Marketing (email/SMS campaigns) ✅ SHIPPED, email (PRs #227, #229)
1. **Audience builder** over segments → **campaigns** — `crm_campaigns` + `crm_campaign_sends` (named `crm_*` to stay distinct from the geo *lead* `campaigns` table), sending via `sendEmail`, per-send logging keyed to `customer_id`, consent-always-enforced, 250/send cap. ✅ (Synchronous send; `email_outbox` drain for larger blasts + scheduling are TODO.)
2. **Templates** — org-branded HTML via `renderCampaignHtml` + `orgEmailBrand()`. ✅ (Preset templates — new-product/win-back/restock — TODO.)
3. **Metrics** — **attributed orders** shipped (`lib/crm/attribution.ts`, last-touch 7-day, revenue per campaign). ✅ Opens/clicks (Resend webhooks) — TODO. **SMS** channel — TODO.

*Deliverable:* consented email marketing to real customers, with revenue attribution. Shipped.

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
