# QuickSites — Central Brain

> The single orientation doc for humans and AI agents working in this repo.
> If you read one file before touching code, read this one.
> Companion docs: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) (run it locally) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/COMMERCE_RUNBOOK.md`](docs/COMMERCE_RUNBOOK.md) · [`docs/MONETIZATION.md`](docs/MONETIZATION.md) · [`docs/PRICING_REDESIGN.md`](docs/PRICING_REDESIGN.md) · [`docs/LLM_METERING.md`](docs/LLM_METERING.md) · [`docs/POD_AUTHOR_PLAN.md`](docs/POD_AUTHOR_PLAN.md) · [`docs/SECRET_ROTATION_RUNBOOK.md`](docs/SECRET_ROTATION_RUNBOOK.md) · [`docs/REVIVAL_PLAN.md`](docs/REVIVAL_PLAN.md) · [`docs/MODEL_A_PLAN.md`](docs/MODEL_A_PLAN.md) · [`docs/COMPETITIVE_LANDSCAPE.md`](docs/COMPETITIVE_LANDSCAPE.md) · [`docs/WHITE_LABEL_PLAN.md`](docs/WHITE_LABEL_PLAN.md) · [`docs/CLAIM_VERIFICATION_PLAN.md`](docs/CLAIM_VERIFICATION_PLAN.md) · [`docs/INVENTORY_PLAN.md`](docs/INVENTORY_PLAN.md) · [`docs/CRM_PLAN.md`](docs/CRM_PLAN.md)

Last verified: 2026-07-10 · `tsc --noEmit` passes clean.

---

## 1. What QuickSites is

A **site generator + commerce platform for local businesses**. Two products share one codebase:

1. **Site Builder** — a schema-driven, drag-and-drop website builder. A *template* is edited in an admin UI, rendered to a public site, and published to a subdomain or programmatically-provisioned custom domain. AI assists with copy (hero, services, testimonials, FAQ).
2. **Open Commerce** — a multi-tenant commerce layer on top of the builder: merchants list catalog items (meals/products/services/digital), customers check out via Stripe, and the **platform takes a per-order fee**. A referral/affiliate system pays residual commissions to reps and partners.

The commercial thesis (see [`docs/MONETIZATION.md`](docs/MONETIZATION.md)): **near-free hosting, monetized by an e-commerce take-rate and/or white-labeling the builder+commerce to partners** who resell to their networks.

## 2. Stack at a glance

| Layer | Choice |
|---|---|
| Framework | **Next.js 15.2.9, App Router** (`app/`), React 18, TypeScript |
| Hosting | Vercel (single deploy today; cron via `vercel.json`) |
| Data / Auth | **Supabase** (Postgres + Auth + Storage), RLS on commerce tables |
| Payments | **Stripe** (+ Stripe Connect for merchant payouts), platform fees |
| AI | **OpenAI** (copy/image gen), **Qdrant** (vectors) |
| Comms | **Resend** (email), **Twilio** (SMS) |
| Domains | **Namecheap** API (register/DNS) + **Vercel** API (attach domains) |
| Observability | **Sentry** (errors). **PostHog** = product analytics (being added — see Revival Plan) |
| Tests | Playwright (e2e/visual), Jest (unit), Storybook |

Node **20.x**, npm **10.x** (see `.nvmrc` / `engines`). `@` path alias = repo root.

## 3. Run it locally

> Full setup, env, and gotchas: **[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)**. Quick version:

```bash
nvm use                       # Node 20
npm install
cp .env.example .env.local    # minimum to boot: Supabase URL + anon + service-role keys
npm run dev                   # http://localhost:3000
```
If `npm run build` fails on `canvas.node … NODE_MODULE_VERSION`, run `npm rebuild canvas`.

Health/quality gates:
```bash
npm run typecheck             # tsc --noEmit  (currently green)
npm run lint                  # eslint
npm run test                  # playwright e2e
npm run build                 # next build (heavier; run before shipping infra changes)
```

**Minimum env to boot:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Commerce additionally needs `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`. AI features need `OPENAI_API_KEY`. Full list in `.env.example` (60+ vars, grouped).

## 4. Repo map (where things live)

```
app/                 # Next App Router: pages + ~349 API routes (app/api/**/route.ts)
  api/               # the entire backend lives here today (see ARCHITECTURE.md for the split plan)
  admin/             # the builder/admin UI (templates editor, dashboards)
  sites/             # public rendered sites (catch-all by slug/domain)
  merchant/ chef(s)/ meals/ cart/ checkout/ orders/   # commerce surfaces
  merchant/customers/ merchant/campaigns/             # customer CRM + email campaigns
  orgs/              # per-tenant (org) landing/routing
components/          # 600+ React components (admin/, sites/, ui/, cart/, ...)
lib/                 # 280 modules: data access, integrations, business logic
  supabase/          # client factories (server/admin/browser/middleware)
  commerce/ payments/ stripe/    # money path
  crm/               # customer identity + segments/campaigns/attribution/activity
  domains/ namecheap/            # domain provisioning
  ai/                # OpenAI wrappers + cost logging
  org/ request/ auth/ guards/    # tenancy, auth, request context
supabase/migrations/ # Open Commerce schema (the canonical money model)
scripts/             # ~100 CLI/SQL/one-off tools
types/               # shared types incl. generated types/supabase.ts
middleware.ts        # host → org/site routing, ref-cookie capture
admin/               # NOTE: a second top-level dir (legacy/parallel admin tooling)
```

> The README and `ROUTER_STRATEGY.md` at the root are **stale** — they describe a Pages Router that was already migrated to App Router. `_pages-legacy/`, `_deprecated__domains/`, `_deprecating_sites/` are corpses pending cleanup. Trust this doc and `docs/ARCHITECTURE.md` over them.

## 5. The two core flows (read these to understand 80% of the system)

**Build & publish a site**
1. `/admin/templates/[id]` loads a template; edits run through `components/admin/templates/template-editor.tsx` + `use-template-editor-state.ts`.
2. Blocks are defined/validated in `admin/lib/zod/blockSchema.ts` (master schema map) + `lib/blockRegistry.core.ts`; rendered via `lib/renderBlockRegistry.ts`.
3. Autosave → `app/api/templates/commit`. Publish → `app/api/templates/[id]/publish`.
4. Public render: `app/sites/[slug]/[[...rest]]/page.tsx` → `components/sites/site-renderer.tsx`.
5. Custom domains: `app/api/domains/*` → `lib/domains/{vercel,namecheap,dns}.ts`.

**Take an order (the money path)**
1. Storefront → `app/api/commerce/checkout` → `lib/commerce/orders.ts#createDraftOrder` (computes `platform_fee_cents`).
2. Stripe Checkout via `lib/commerce/adapters/stripeAdapter.ts` / `lib/payments/stripe.ts` (sets Connect `application_fee_amount` + `transfer_data`).
3. Webhook `app/api/commerce/webhooks/stripe` → `markOrderPaid()` → writes `payments` + a `commission_ledger` entry for any attributed referral, and (step "3b") upserts the buyer into `customers` + links `orders.customer_id` (CRM spine, best-effort).
4. Partner/affiliate payouts: `app/api/referrals/*` (manual today; automation is a known gap).

## 5b. Newer subsystems (added 2026-06 – 07)

- **Homepage showcase** ("Built with QuickSites"): an SSR'd row of curated published sites. `app/page.tsx` is now a **server component** that calls `getShowcaseData()` (`lib/home/getShowcaseData.ts`) and passes data into the client homepage (`components/home/home-client.tsx`) + `components/home/site-showcase.tsx` (localStorage cache; admin display-mode/hide/drag-reorder). Feed: `app/api/public/showcase`; generated thumbnails: `app/api/public/showcase/[slug]/thumb`. Curated list: `lib/home/featured-sites.ts`.
- **Builder first-run chooser**: `/admin/templates/new` shows industry / duplicate-template / blank (`components/admin/templates/start/start-your-site.tsx`). Industry scaffold seeds services + theme (`lib/builder/industryScaffold.ts`); industry themes (`lib/theme/industryPresets.ts`) are wired through the public render via `lib/theme/resolveSiteTheme.ts` + `TemplateThemeWrapper`. **`color_mode` defaults to `dark` everywhere**; the editor action toolbar has a light/dark toggle (persists to the template).
- **AI demo generation**: "Generate demos" admin button → `app/api/admin/demos/generate` (admin+cron) → `lib/builder/generateDemoSite.ts` (metered OpenAI copy+hero → insert → publish via `public.publish_template_demo` RPC). Random, category-diversifying spec: `lib/builder/randomDemoSpec.ts`. Nightly top-up cron `app/api/cron/demo-refresh` (OFF unless `DEMO_AUTOGEN_ENABLED=true`). Generated sites are tagged `claim_source='demo_seed'` + `data.meta.is_demo`.
- **Templates admin**: card view (`components/admin/templates/templates-card-grid.tsx`) with a Cards/Table toggle + shimmer placeholders during generation; admins see **all** templates (the list API + secure-MV gating in `app/api/admin/templates/list`).
- **Agency billing + finished take-rate (Pricing Phase 2)**: per-user + per-site tiers in `lib/billing/*` (`plans`, `agency`, `entitlements`) + `app/api/billing/*`; refund fee-reversal (`lib/commerce/refunds.ts`), agency fee-exemption + margin-aware fee in `createDraftOrder`, reconciliation `app/api/admin/commerce/reconcile`. See [`docs/PRICING_REDESIGN.md`](docs/PRICING_REDESIGN.md).
- **Print-on-demand + Author sites**: Lulu (books) + Gelato (posters/apparel) under `lib/commerce/pod/*`; fulfillment fires from `markOrderPaid` (gated by `POD_ENABLED`), records `print_orders`, syncs via `app/api/cron/print-order-sync` + `app/api/commerce/webhooks/lulu`. Catalog authoring in `components/merchant/CreateItemDrawer.tsx` (spec on `catalog_items.metadata.pod_spec`); admin view `/admin/print-orders`; `author` is a first-class industry. See [`docs/POD_AUTHOR_PLAN.md`](docs/POD_AUTHOR_PLAN.md).
- **Restaurant vertical**: converting a restaurant URL yields a menu-forward ordering site, not a brochure. Three blocks (`menu`, `location`, `order_bar` — mobile-first, in the block registries + a dedicated `menu-editor.tsx`); the food scaffold (`industryScaffold.ts` `FOOD_INDUSTRIES`) builds `[hero, menu, location, hours, faq, contact, order_bar]`. Conversion crawls menu **subpages** (`scrapeMenuPages`) and extracts a structured menu + contact + hours (`inferSiteSpec.ts`, `parseMenu/parseContact/parseHours`). Ordering: the owner **confirms prices** in the editor → `POST /api/menu/publish-catalog` creates `catalog_items` (options→variants, add-ons→`metadata.addons`, category=section) → "Add to order" rides the existing cart/checkout. Money path stays server-authoritative in `authorizeCheckoutItems` (ids only from the client; validates + reprices variants **and** add-ons). Green-path proof: `POST /api/admin/commerce/menu-demo`. See [`docs/RESTAURANT_VERTICAL.md`](docs/RESTAURANT_VERTICAL.md).
- **CedarSites no-website outreach + `delivered.menu` (2026-07)**: a pipeline to auto-build ordering sites for restaurants that have **no website**, from their public listing. Import a Google Places + Yelp listing (`lib/rebuild/importListing.ts` + `importListingYelp.ts`), OCR the menu from listing photos (`lib/rebuild/menuFromPhotos.ts`, vision), assemble a draft (`assembleDraft.ts`) stamped `claim_source='listing_import'`; batch importer `scripts/import-listings-batch.ts` (`npm run import:listings`) with a menu hit-rate tally + ready-to-print QR codes; manage the funnel at `/admin/outreach`. **`delivered.menu` is the default deliverable URL** (`lib/menu/deliveredMenu.ts`, gated by `NEXT_PUBLIC_MENU_BASE_DOMAIN`): a restaurant is reachable at **both** `<slug>.delivered.menu` and `delivered.menu/<slug>` (`middleware.ts` rewrites both → `/sites/<slug>`), the apex `/` is a live-restaurant directory (`app/delivered/page.tsx`), and the **same URL spans the lifecycle** — an unclaimed draft renders watermarked + `noindex` (with a "Claim this site" bar, `components/sites/menu-claim-bar.tsx`), a published claimed site goes live + indexable (the `x-qsites-menu-host` branch in `app/sites/[slug]/[[...rest]]/page.tsx`). Custom domains still work. Claim = operator→prospect ownership transfer (`app/api/claim-draft`, `lib/auth/siteClaimToken.ts`, `claim_operator_draft` RPC, post-login `lib/auth/claimPendingSiteDraft.ts`). See [`docs/RESTAURANT_VERTICAL.md`](docs/RESTAURANT_VERTICAL.md) §7b.
- **Claim verification (2026-07, flag-gated OFF)**: when `CLAIM_VERIFICATION_ENABLED=1`, claiming a `listing_import` draft requires proving control of the business **before ownership transfers** — an SMS OTP to the phone on the public listing (server-derived from the contact/order_bar block, never claimer-supplied) or an operator manual override. `lib/auth/claimVerify.ts` (hashed single-use codes + a signed, template-bound verify-grant cookie), `POST /api/claim/verify/{send,confirm}` (rate-limited), `/claim-site/<id>/verify`, first Twilio sender `lib/sms/sendSms.ts`, `claim_verifications` deny-default table, operator "Verify by phone" on `/admin/outreach`. Off by default (legacy token-only claim unchanged); activate with the migration applied + Twilio env. See [`docs/CLAIM_VERIFICATION_PLAN.md`](docs/CLAIM_VERIFICATION_PLAN.md).
- **Domain-claim email verification (2026-07-09, flag-gated OFF)**: the parallel **email** proof-of-control flow for the legacy `domains`-table claim (`POST /api/claim-site`), distinct from the SMS listing-draft flow above. Behind `DOMAIN_CLAIM_VERIFICATION_ENABLED`: `POST /api/claim/verify/email/{send,confirm}` email a hashed 6-digit OTP + set a domain-bound verify-grant cookie (reuses `lib/auth/claimVerify.ts` with the **domain id** as the HMAC subject — no lib changes); `claim-site` then completes the claim (writes `domains.claimed_email`/`claimed_at`, race-guarded, consumes the row) **only** with a valid grant + a verified `claim_verifications` row. Reusable drop-in UI `components/claim/domain-claim-verify.tsx` (email→code→complete; **not yet wired to a page** — the domains-claim flow has no live entry point). Migration `20260709_domain_claim_verification` (adds `domains.claimed_email/claimed_at` + generalizes `claim_verifications` with a nullable `domain_id`; **pending — run `db:migrate:up`**). Green-path e2e at `app/api/claim/verify/email/__tests__/domainClaimFlow.test.ts`. See [`docs/DOMAIN_CLAIM_VERIFICATION_PLAN.md`](docs/DOMAIN_CLAIM_VERIFICATION_PLAN.md).
- **Hub override (two-tier referral, 2026-07)**: a "hub" recruits *resellers* and earns a configurable, lifetime override on their orders, funded **out of QuickSites' 20% share** (`commission_ledger` subject `order_platform_fee_override`; `parent_code`/`override_share` on `referral_codes`, clamped by `clampOverrideShare`; auto-linked on partner join via the `?hub=<code>`→`qs_hub` cookie). `markOrderPaid` writes the second ledger row; `runPayouts` pays it; `/admin/revenue` net take subtracts it (`lib/commerce/revenue.ts`). Config: `POST /api/admin/referrals/set-hub`. Full mechanics in [`docs/MONETIZATION.md`](docs/MONETIZATION.md).
- **Admin dashboards**: AI spend `/admin/ai-costs`, cron health `/admin/cron`, print orders `/admin/print-orders` (links in the admin nav).
- **Global settings**: `public.site_settings` (key/value jsonb, **service-role only**, RLS-denied) holds showcase mode/hidden/order. Helpers: `lib/settings/siteSettings.ts`.
- **New crons** (`vercel.json`): `agency-site-sync`, `demo-refresh`, `print-order-sync` (all cron-secret auth'd; the latter two are flag-gated).
- **Secrets**: a leaked service-role key was removed + a gitleaks scan added (CI `.github/workflows/secret-scan.yml` + pre-commit). Rotated 2026-06-30 — see [`docs/SECRET_ROTATION_RUNBOOK.md`](docs/SECRET_ROTATION_RUNBOOK.md).
- **White-label / agency branding (Tier 1.5)**: reseller orgs (`organizations_public.billing_mode === 'reseller'`) rebrand the client-facing surface. Brand data = `organizations_public` (a **view** over `organizations`; exposes `name`/`logo_url`/`dark_logo_url`/`theme_json`/`email_from`), resolved host→org by `lib/org/resolveOrg.ts` and served to the client via `OrgProvider`/`useOrg()`/`useBrand()` (`app/providers.tsx`) and `GET /api/org/branding` (`lib/org/branding.ts`, reseller-gated → 404 else). Branded surfaces: login/join pages, admin chrome wordmark+logo (`components/admin/admin-chrome.tsx`, `AppHeader/app-header.tsx`), transactional emails (`orgEmailBrand()` in `lib/email.ts` → per-org `email_from` sender + display-name/footer; **inert until a Resend domain is verified**), and `theme_json` accents (`lib/org/theme.ts#pickAccentColor`, validated hex). See [`docs/WHITE_LABEL_PLAN.md`](docs/WHITE_LABEL_PLAN.md).
- **Money-funnel instrumentation (Model A / A7)**: all 8 funnel steps + partner commission events emit server-side via `captureServer` at their authoritative transitions (`signup`→`platform_fee_collected`, `commission_accrued`/`_paid`). Event constants: `lib/analytics/events.ts`; signup heuristic: `lib/analytics/funnel.ts`. Building the PostHog funnel/insight is now a dashboard task. See [`docs/MODEL_A_PLAN.md`](docs/MODEL_A_PLAN.md).
- **Green-path money-path proofs** (admin-gated, in-app, no real Stripe): `POST /api/admin/commerce/e2e-demo` (seed merchant → order → paid → platform fee + partner residual, asserts the numbers) and `POST /api/admin/commerce/pod-demo` (author/POD flagship: Lulu book + Gelato poster, asserts the fee is taken on **margin** with the printer base cost carved out + a print job is queued). Both idempotent; `{cleanup:true}` tears down.
- **Sales tax**: when `QS_STRIPE_TAX_ENABLED=true`, Stripe `automatic_tax` runs at checkout and `markOrderPaid` records the computed tax to `orders.tax_cents` + reconciles `total_cents` (`parseStripeTaxTotals` in `lib/commerce/fees.ts`). Tax is **excluded from the platform-fee basis** (fee is locked at draft on the pre-tax subtotal); surfaced on the receipt.
- **Customer CRM + email campaigns (2026-07, CRM Phase 0→3)**: a buyer identity spine + the surfaces on top. `markOrderPaid` step "3b" upserts the buyer into `customers` (per-merchant, deduped by normalized email; `upsert_customer_from_order` RPC) and links `orders.customer_id`/`customer_email` (`lib/commerce/customers.ts`). Merchant surfaces: `/merchant/customers` (searchable list with segments/filters/sort + tags), the profile (LTV + a unified **activity timeline** merging orders + campaign receipts; editable notes/tags/`marketing_consent` via owner-gated `PATCH /api/merchant/customers/[id]`), and `/merchant/campaigns` — consent-gated email blasts to a segment (`crm_campaigns`/`crm_campaign_sends`, one-click unsubscribe `/api/crm/unsubscribe` w/ signed token + `List-Unsubscribe`, 250/send cap) with last-touch 7-day **order attribution** (revenue per campaign). Logic in `lib/crm/*` (`segments`, `campaigns`, `attribution`, `activity`, `unsubToken`); tables via `20260707_{customers_identity_spine,orders_customer_id,customers_notes,crm_campaigns}.sql` (all applied). Historical backfill: `npm run backfill:customers`. Deny-default RLS + owner read; service-role writes. **Not plan-gated** (free for every merchant). Buyer/campaign PostHog events emit via `captureServer` (`customer_created`/`repeat_purchase`/`campaign_sent`/`campaign_order_attributed`/`customer_unsubscribed`, distinctId = the customer). See [`docs/CRM_PLAN.md`](docs/CRM_PLAN.md).
- **Brand motif (2026-07)**: a neon-steampunk loading video (`components/brand/BrandLoader.tsx` → `public/brand/qs-loader.mp4`, used by `AsyncGifOverlay` + the guest "Building your site…" wait) and a homepage hero character (`public/brand/qs-character.jpg`, shown only on the default brand via `billingMode !== 'reseller'`). Also: homepage/workspace decorative backgrounds (`components/home/section-backdrop.tsx`, `components/admin/work-surface-background.tsx` — per-user localStorage, picker in the profile) with the homepage glow **off by default** + a glow-opacity slider in the color lab; editor toolbar tooltips now show their keyboard shortcuts (t/s/p).
- **Public marketing surfaces**: `/partners` (reseller landing), `/partners/calculator` (interactive GMV earnings vs flat-markup), and `/compare` (features-vs-Duda/GoHighLevel chart with sourced pricing + an honest "where they lead" section — the CRM/marketing row now reads `partial`, not out-of-scope). Positioning source: [`docs/COMPETITIVE_LANDSCAPE.md`](docs/COMPETITIVE_LANDSCAPE.md).
- **Guest build (unauthenticated draft sites)** — **LIVE in prod** (anonymous sign-ins enabled in Supabase; `NEXT_PUBLIC_GUEST_BUILD_ENABLED=1` set in Vercel production + preview). Env-gated by that flag (`lib/flags/guestBuild.ts`). Entry points: the homepage hero (`components/home/guest-start.tsx`) and `/build`. A logged-out visitor mints a Supabase **anonymous** session (`ensureGuestSession`), builds a draft template stamped `owner_id=<anon uid>` + `claim_source='guest_build'` (`app/api/templates/create|duplicate`) **seeded with a real industry starter** (hero / services / faq / contact + services + theme via `buildIndustryStarter` — the same scaffold as `/admin/templates/new`, so the editor opens a working site rather than empty/typeless placeholder blocks), and **auto-claims on sign-up** (the anon user upgrades in place, same uid → `owner_id` still matches). It **can't reach the homepage**: anon users are blocked from publishing (`app/api/templates/[id]/publish` → `needs_signup`), the showcase requires `published=true`, and `getShowcaseData` additionally drops any still-anon-owned row (`anonymous_user_ids` RPC). `middleware.ts` confines anon users to the template editor. **Abuse guards** (the load-bearing part): per-guest AI call cap (`enforceGuestAiLimit`, `GUEST_AI_CALL_LIMIT`) — on **every** AI route; per-IP guest-draft rate limit (`lib/rateLimit.ts` on `ratelimit_events`, `GUEST_DRAFT_HOURLY_LIMIT_PER_IP`); the dollar budget guard (`meterLLMCall`, keyed on `ai_usage_events.occurred_at`); and the `/api/cron/ai-cost-alert` watchdog (every 15 min) that emails `ADMIN_EMAILS` + raises a Sentry warning when rolling AI spend crosses `AI_ALERT_{HOURLY,DAILY}_USD` (with an anon breakdown via `ai_spend_report`). Note: image-gen routes (`/api/hero/generate-image`, `favicon`, `icon`) set `maxDuration = 60` — gpt-image-1 is slow (~20s at `quality:'medium'`) and would otherwise hit the default serverless timeout.
- **Anonymous-token security hardening (2026-07, PRs #102–#122)**: shipping guest build (an anon token is a *real authenticated user*) prompted an audit of everything an anon/authenticated token could reach, and a staged remediation. Shared auth gates now live in `lib/auth/requireUser.ts`; dozens of mutating routes were gated (including an unauthenticated `spawn`-RCE dev route, unauth Stripe-refund execution, an org-domain hijack, and a critical unauthenticated arbitrary-file-read). A privilege-escalation via self-written `user_profiles.role` was closed. Every RLS-disabled anon-writable table from the audit was locked — **deny-default** for service-role-only/sensitive tables, **scoped policies** for browser-written ones (`domains` public-read, `remix_events` owner-insert, `user_action_logs` authed append-only, `dashboard_layouts` authed), and **`public.sites` gained an `owner_id` column + owner-scoped RLS**. Webhooks verify signatures (Twilio added; Stripe/Lulu already did); public email/claim endpoints are per-IP rate-limited. The residual **redesign** follow-ups were closed 2026-07-09 (PRs #268–#274): `send-contact-email` now derives the recipient from `site_slug` server-side (#268, closes an open relay); the Lulu webhook **fails closed** in prod when its secret is unset (#269); `templates/base-name` writes are **owner-scoped** (#270); the public claim endpoints were hardened so no unverified body-derived privileged writes happen — `claim-site` (which had no callers) performs none, `claim/lead` validates email + template existence (#271); and the **domain-claim** path gained a full **email proof-of-control** flow behind `DOMAIN_CLAIM_VERIFICATION_ENABLED` (#272–#274 — see the *Domain-claim email verification* bullet above). The SMS **outreach site-claim** path already had verification behind `CLAIM_VERIFICATION_ENABLED` (see [`docs/CLAIM_VERIFICATION_PLAN.md`](docs/CLAIM_VERIFICATION_PLAN.md)).

## 6. Architecture facts that will surprise you

- **The backend = Next API routes.** ~349 `route.ts` files; ~70% of business logic is *inline in routes*, not in a service layer. A thin service layer exists only for commerce (`lib/commerce/*`, `lib/payments/*`). Extracting a standalone backend is the planned north star — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). **When writing new logic, put it in `lib/<domain>/` as a pure function and call it from the route** — this is how we incrementally earn the split.
- **Multi-tenant by org.** `middleware.ts` resolves host → org (`lib/org/resolveOrg.ts`), sets `x-qsites-org-*` headers, and rewrites platform/custom domains to `/sites/*` or `/orgs/*`. Default org via `DEFAULT_ORG_SLUG`.
- **Auth is Supabase SSR.** Clients are created in `lib/supabase/{server,admin,browser,middleware}.ts`. Platform-admin is resolved from `ADMIN_EMAILS` + the `admin_users` table (`getAdminUser()`); **`user_profiles.role` is no longer trusted for admin** — a self-writable-role privilege-escalation was closed, so `public.is_platform_admin()` now trusts only `admin_users`. There is no centralized auth middleware — routes gate themselves via the shared helpers in `lib/auth/requireUser.ts` (`requireAdmin` / `requireUser` / `requireMerchantOwner` / `requireOrgAdmin` / `requireCompanyMember`) + `requireTemplateOwner`. **Anonymous (guest) sessions are real authenticated users** (`getUser()` returns them) — `requireUser()` rejects them unless `{ allowAnonymous: true }`. Gate every new non-public route.
- **RLS is real on commerce tables** (see `supabase/migrations/20250827_open_commerce.sql`) and a 2026-07 hardening sweep locked the remaining anon-writable public tables (money/report/`site_merchants`/`sites`/`domains`/`user_action_logs`/… — deny-default or owner-scoped policies). But most app queries use the **service-role key** server-side and bypass RLS, so **route-level authorization is still load-bearing** — don't assume RLS protects you in an API route. Per-IP abuse throttle for public endpoints: `lib/api/rateLimitGuard.ts#rateLimitOr429`.
- **Secrets are read ad-hoc** via `process.env.*` with string-default fallbacks; there's no validated env loader yet (a planned cleanup).
- **AI/LLM calls are metered** via `lib/ai/meter.ts` (`meterLLMCall`): budget guard + cost logging + PostHog mirror. Rollout is **complete** as of 2026-07-04 — every OpenAI inference call-site (chat/image/embeddings) routes through the wrapper, incl. the shared embedder (`lib/useVectorDB.ts#embedText`) and the admin dev-seed tooling. See [`docs/LLM_METERING.md`](docs/LLM_METERING.md). Don't call OpenAI raw in new code; use the wrapper.

## 7. Conventions

- **TypeScript, no `any` in new code.** `tsc --noEmit` is green — keep it green.
- **API routes**: `runtime = 'nodejs'`, `dynamic = 'force-dynamic'` is the norm (Supabase service role needs Node). Use the response helpers in `lib/api/json.ts` and prefer the Zod validation wrappers in `lib/api/withInputOutputValidation.ts` for new endpoints.
- **New business logic → `lib/<domain>/`** (pure, testable), thin route on top.
- **Money in integer cents**, never floats. Match the schema (`*_cents`).
- **Cron** endpoints live under `app/api/cron/*`, registered in `vercel.json`, auth'd by `isCronAuthorized` (`x-cron-secret`/`CRON_SECRET` or Vercel's `Authorization: Bearer`). Wrap the body in `runCron(job, …)` for `cron_runs` logging.
- **DB migrations are tracked** in `public.schema_migrations` via `scripts/db-migrate.mjs`. Add a `supabase/migrations/<ts>_name.sql` file (idempotent DDL: `if [not] exists`), then `npm run db:migrate:status` to see pending and `npm run db:migrate:up` to apply (each runs in one transaction and is recorded on success — never hand-apply with `psql -f` or the ledger drifts). `status` also flags checksum drift + orphaned records. Needs `SUPABASE_DB_URL`.
- **New sites/templates default to `color_mode: 'dark'`.** Creation + render fallbacks all default dark; set `color_mode: 'light'` explicitly to override.
- **Conventional commits** (`npm run commit` / commitlint). NOTE: current history is squashed to `📦 g` placeholders — start writing real messages.

## 8. Known debt / traps (don't trip on these)

- Duplicate/legacy files were purged (2026-07-04): `lib/create-default-block-RESOLVE-DUP.ts`, `lib/blocks/_likely-remove_*`, `vercel.json.bak`, `page-v0.tsx`, and the dead `app/examples/blocks-demo` page (rendered a retired-vertical block through a removed renderer) are gone. If you see a reference to any of them, it's stale.
- `app/api/deploy-webhook/route.ts` is effectively disabled (commented).
- **Direct `UPDATE`s to `templates` are blocked** by the `app.guard_templates_update` trigger ("Use app.commit_template()"). Go through the sanctioned RPCs (`app.commit_template`, `app.set_template_slug`, `app.publish_site`, or the `public.publish_template_demo` helper), or `set_config('app.bypass_template_guard','on', true)` inside a txn for one-off SECURITY DEFINER work. INSERTs are fine.
- Stripe Connect onboarding is consolidated on `payment_accounts` (fee config = `platform_fee_percent`/`collect_platform_fee`/`platform_fee_min_cents`). The legacy `merchant_payment_accounts` table + bps fee columns (`merchants.default_platform_fee_bps`, `sites.platform_fee_bps`) were retired in `supabase/migrations/20260701_retire_legacy_connect_bps.sql`. See [`docs/MONETIZATION.md`](docs/MONETIZATION.md).
- Large artifacts (`quicksites-export.zip`, `get-pip.py`, `.tsbuildinfo`, lint reports) and dead dirs (`_pages-legacy/`, `_deprecated__domains/`, `_deprecating_sites/`) were removed from git in the cleanup milestone — the tree is clean of them today.
- Two `admin/` locations: `app/admin/` (UI) and a top-level `admin/` (libs/tooling, incl. the master block schema). Don't confuse them.
- **`public.sites` is a legacy/secondary table** — the live content model is `templates`. Most `sites` rows are orphaned (131 rows, ~105 with no `owner_id`); it gained an `owner_id` column + owner-scoped RLS in 2026-07 (public read, writes scoped to owner/admin). Build new features on `templates`, not `sites`. Its old write routes (`/api/sites/save`, `/api/sites/create`) referenced columns that never existed and were effectively dead until repaired during the RLS work.
- **`types/supabase.ts` was regenerated** (commit `2c8dd6c`, "align @supabase versions + regenerate full DB types") — the old "88-table, commerce-absent, ~1000-`never`-errors" trap is **resolved**. The `@supabase/*` versions are now aligned (`supabase-js` 2.108, CLI 2.109), so the CLI output no longer resolves to `never`; `tsc --noEmit` is green. The file now types **164 of the 168 live public base tables** (+ views), commerce included. Still missing (added after that regen): `print_orders`, `site_settings`, `stock_reservations`, `schema_migrations`, and the CRM tables `customers` / `crm_campaigns` / `crm_campaign_sends` (+ the new `orders.customer_id` / `customers.notes` columns) — verified against the live DB 2026-07-07. Their absence is low-impact: the routes touching them use the **service-role `createClient(...)` untyped** (no `<Database>` generic), so they don't consume these types anyway. To finish the last few: `supabase gen types typescript --schema public` — needs either Docker (for `--db-url`) or a `SUPABASE_ACCESS_TOKEN` (for `--project-id`); neither is available in a headless session, so it's a "run it locally" chore. When a service-role query's columns matter, verify against the live DB (`psql "$SUPABASE_DB_URL"`), not this file.

## 9. For AI agents specifically

- Prefer editing `lib/<domain>/` pure functions over inflating route handlers.
- Before adding an integration, check §2 — it's probably already a dependency.
- The authoritative data model is **`supabase/migrations/*` + `types/supabase.ts`**, not any prose doc.
- When unsure whether code is live, check for the legacy markers in §8 and grep for imports before assuming.
- Keep `tsc --noEmit` green; run `npm run typecheck` after non-trivial changes.
