# Print-on-Demand + Author sites — build plan

> Cross-pollinate hivejournal's Lulu (books) + Gelato (posters/apparel) print-on-demand
> into QuickSites' Open Commerce, and add an "Author" site type. Working doc for execution.
> Created 2026-06-29.

## STATUS — built (gated behind POD_ENABLED; needs Lulu/Gelato creds to go live)
- ✅ Phase 1: providers (`lib/commerce/pod/{lulu,gelato}.ts`), `print_orders` table, flag, env (PR #37).
- ✅ Phase 3: Author site type (industry/theme/services/demo) (#38) + `products_grid` storefront in commerce scaffolds (#39).
- ✅ Phase 2: gated fulfillment in `markOrderPaid` → Lulu/Gelato; `print-order-sync` cron; Lulu webhook (#39). Shipping captured at checkout for POD carts (#41).
- ✅ Phase 4: `/admin/print-orders` dashboard (#41) + catalog POD product authoring (book/merch) in `CreateItemDrawer` (#42).
- ✅ Flagship demo: `POST /api/admin/commerce/pod-demo` — repeatable green-path proof (author + Lulu book + Gelato poster → paid → fee-on-margin + partner residual + queued print jobs). The competitive weapon for Tier 3.10 in [`COMPETITIVE_LANDSCAPE.md`](COMPETITIVE_LANDSCAPE.md).

**Go-live checklist:** (1) create Lulu + Gelato sandbox accounts, set `LULU_*` / `GELATO_API_KEY`; (2) `POD_ENABLED=true`; (3) add a POD catalog item (Merchant Catalog → New Item → Fulfillment); (4) test order in sandbox → verify `print_orders` + `/admin/print-orders`; (5) switch `LULU_API_BASE` to prod + set `LULU_WEBHOOK_SECRET`, point Lulu's webhook at `/api/commerce/webhooks/lulu`. Remaining polish: per-merchant BYO creds UI; pricing that adds print cost + margin into the listed price; tax/returns for physical goods.

## Decisions (locked)
- **Scope (first cut):** Books **and** merch — Lulu + Gelato both.
- **Surface:** an **Author/Writer site type** AND POD as a **generic catalog capability** any merchant can enable.
- **Fulfillment accounts:** **platform default** (QuickSites holds Lulu/Gelato accounts, fulfills, keeps a margin) with **BYO optional** (advanced merchants connect their own creds).

## What already exists (reuse, don't rebuild)
**QuickSites (this repo) — the commerce spine**
- Open Commerce: `lib/commerce/orders.ts` (`createDraftOrder`, `markOrderPaid`, `markOrderRefunded`), Stripe Connect checkout (`lib/commerce/adapters/stripeAdapter.ts`, `paymentRouter.ts`), `payments`/`orders` tables, platform take-rate + partner commissions, refund fee-reversal (`lib/commerce/refunds.ts`).
- Commerce webhook: `app/api/commerce/webhooks/stripe/route.ts` (idempotent; calls markOrderPaid/Refunded).
- Catalog/products (seeder + merchant catalog), product types meal/physical/digital/service.
- Industry categories already include `print_on_demand`, `custom_apparel`, `artisan_goods`, `etsy_style`, `handmade` (`lib/industries`).
- Builder blocks (`products_grid`, etc.), industry scaffold (`lib/builder/industryScaffold.ts`), demo generator (`lib/builder/generateDemoSite.ts`).

**hivejournal (`~/Desktop/_SilverLamp/hivejournal-2026`) — the POD engine to port**
- `apps/backend/src/services/lulu.ts` — `isLuluConfigured`, `calculatePrintCost`, `createPrintJob`, `getPrintJob`, `verifyLuluWebhook`, `extractWebhookJob`, POD package SKUs, spine-width math.
- `apps/backend/src/services/gelato-client.ts` — `isGelatoConfigured`, `createGelatoOrder`, `getGelatoOrder`.
- `apps/backend/src/services/print-order-sync.ts` — `syncInFlightPrintOrders` (status polling).
- `merch.ts`, `merch-order-sync.ts`, `print-export.ts`, `print-storefront.ts` — product/merch + export helpers.
- Routes: `routes/merch.ts`, `routes/print-orders.ts`, `routes/payment.ts`.
- Storefront UI: `components/seasons/PaperbackStorefront.tsx`, `FanPosterStorefront.tsx`, `PrintOrderModal.tsx`; admin `dashboard/admin/print-orders/page.tsx`.

> Port note: hivejournal is a separate monorepo (Express backend + Next frontend). **Port the provider services into `lib/commerce/pod/`** as framework-agnostic modules and wire them into QuickSites' Next API routes + commerce layer. Adapt: Supabase client (`getServerSupabase`/service role), env access, types. Convert storefront components into QuickSites **block renderers**.

## Phase 1 — POD provider layer
- `lib/commerce/pod/lulu.ts`, `lib/commerce/pod/gelato.ts` (ported). Env: `LULU_CLIENT_KEY/SECRET`, `LULU_SANDBOX`, `LULU_WEBHOOK_SECRET`, `GELATO_API_KEY`. Add to `.env.example`.
- `lib/commerce/pod/index.ts` — provider router: `provider: 'lulu' | 'gelato'` → create/get/cost, mirroring the existing `paymentRouter` pattern.
- **DB:**
  - `print_orders` (port): `id, order_id, merchant_id, provider, provider_job_id, status, shipping_address jsonb, cost_cents, created_at, updated_at`.
  - `catalog_items` add: `fulfillment_provider` (`stripe_only|lulu|gelato`), `pod_spec jsonb` (book: interior/cover PDF URLs, page_count, trim; poster/apparel: print-file URLs, variant/size).
  - `payment_accounts` (or a new `merchant_pod_accounts`) add optional BYO creds (encrypted) + `pod_mode` (`platform|byo`).
- RLS: server/service-role only for `print_orders` (mirror commerce tables). Migrations applied via the established psql flow.

## Phase 2 — Fulfillment wired into Open Commerce
- **Checkout/pricing:** at `createDraftOrder`, for POD line items add print base cost (`calculatePrintCost`) into the price; ensure take-rate is computed on margin, not print cost. Capture **shipping address** at checkout (Stripe Checkout `shipping_address_collection`).
- **On paid:** extend `markOrderPaid` (or the commerce webhook) — for each POD line item, call `createPrintJob`/`createGelatoOrder` with the shipping address; insert a `print_orders` row. Platform vs BYO selects which account/creds.
- **Status:** `/api/cron/print-order-sync` (port `syncInFlightPrintOrders`, register in `vercel.json`) + a **Lulu webhook** route (`verifyLuluWebhook`) → update `print_orders`/`orders` status + customer email (Resend).
- **Refunds:** on refund, cancel the print job if still cancellable; reconcile in the reconciliation report.

## Phase 3 — Author site type + storefront blocks
- Add `author` (and/or `writer`) to `lib/industries` + a preset in `industryPresets`.
- `buildIndustryStarter` author scaffold: hero, **books** grid, **merch** grid, bio/about, newsletter/contact.
- Block renderers: `book_storefront` (Lulu) + `merch_storefront` (Gelato), adapted from hivejournal's `PaperbackStorefront`/`FanPosterStorefront`; register in the block registry/schema.
- Demo generator: add an "Author" spec (sample book + a couple merch items) so it appears in the showcase/templates.

## Phase 4 — Catalog/admin
- Merchant catalog UI to add POD products: book (upload interior+cover PDF → Lulu validate/cost) and merch (upload design + pick Gelato product/variant/size). Reuse hivejournal `print-export`/`merch` logic.
- Admin **Print Orders** dashboard (port `dashboard/admin/print-orders`) — surface status, retries, costs (link near `/admin/ai-costs`, `/admin/cron`).

## Env (to add to .env.example)
`LULU_CLIENT_KEY`, `LULU_CLIENT_SECRET`, `LULU_SANDBOX=true`, `LULU_WEBHOOK_SECRET`, `GELATO_API_KEY`, plus `POD_PLATFORM_MARGIN_PERCENT` (your margin on print cost).

## Caveats / open questions
- **Provider creds:** need Lulu + Gelato (sandbox first). Platform accounts to start; BYO encryption story (reuse however Connect secrets are handled).
- **Pricing:** define `POD_PLATFORM_MARGIN_PERCENT` + how the take-rate stacks with print cost (don't take a fee on Lulu's base cost).
- **Shipping:** address capture + shipping cost passthrough (Lulu/Gelato quote shipping; surface at checkout).
- **Assets:** book PDFs / print files — merchant upload (Phase 4) vs AI-assisted later.
- **Tax/returns/chargebacks** for physical goods — out of first cut; note for later.

## Suggested execution order
1. Phase 1 (providers + DB) behind a `POD_ENABLED` flag, sandbox creds, no UI.
2. Phase 2 fulfillment with a test order in Lulu/Gelato sandbox.
3. Phase 3 author type + blocks (+ a demo).
4. Phase 4 catalog/admin polish.
