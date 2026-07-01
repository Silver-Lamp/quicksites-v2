# QuickSites — Central Brain

> The single orientation doc for humans and AI agents working in this repo.
> If you read one file before touching code, read this one.
> Companion docs: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) (run it locally) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/COMMERCE_RUNBOOK.md`](docs/COMMERCE_RUNBOOK.md) · [`docs/MONETIZATION.md`](docs/MONETIZATION.md) · [`docs/PRICING_REDESIGN.md`](docs/PRICING_REDESIGN.md) · [`docs/LLM_METERING.md`](docs/LLM_METERING.md) · [`docs/POD_AUTHOR_PLAN.md`](docs/POD_AUTHOR_PLAN.md) · [`docs/SECRET_ROTATION_RUNBOOK.md`](docs/SECRET_ROTATION_RUNBOOK.md) · [`docs/REVIVAL_PLAN.md`](docs/REVIVAL_PLAN.md) · [`docs/MODEL_A_PLAN.md`](docs/MODEL_A_PLAN.md) · [`docs/COMPETITIVE_LANDSCAPE.md`](docs/COMPETITIVE_LANDSCAPE.md) · [`docs/WHITE_LABEL_PLAN.md`](docs/WHITE_LABEL_PLAN.md)

Last verified: 2026-07-01 · `tsc --noEmit` + `next build` pass clean.

---

## 1. What QuickSites is

A **site generator + commerce platform for local businesses**. Two products share one codebase:

1. **Site Builder** — a schema-driven, drag-and-drop website builder. A *template* is edited in an admin UI, rendered to a public site, and published to a subdomain or programmatically-provisioned custom domain. AI assists with copy (hero, services, testimonials, FAQ).
2. **Open Commerce** — a multi-tenant commerce layer on top of the builder: merchants list catalog items (meals/products/services/digital), customers check out via Stripe, and the **platform takes a per-order fee**. A referral/affiliate system pays residual commissions to reps and partners.

The commercial thesis (see [`docs/MONETIZATION.md`](docs/MONETIZATION.md)): **near-free hosting, monetized by an e-commerce take-rate and/or white-labeling the builder+commerce to partners** who resell to their networks.

## 2. Stack at a glance

| Layer | Choice |
|---|---|
| Framework | **Next.js 15.2.6, App Router** (`app/`), React 18, TypeScript |
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
  orgs/              # per-tenant (org) landing/routing
components/          # 600+ React components (admin/, sites/, ui/, cart/, ...)
lib/                 # 280 modules: data access, integrations, business logic
  supabase/          # client factories (server/admin/browser/middleware)
  commerce/ payments/ stripe/    # money path
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
3. Webhook `app/api/commerce/webhooks/stripe` → `markOrderPaid()` → writes `payments` + a `commission_ledger` entry for any attributed referral.
4. Partner/affiliate payouts: `app/api/referrals/*` (manual today; automation is a known gap).

## 5b. Newer subsystems (added 2026-06 – 07)

- **Homepage showcase** ("Built with QuickSites"): an SSR'd row of curated published sites. `app/page.tsx` is now a **server component** that calls `getShowcaseData()` (`lib/home/getShowcaseData.ts`) and passes data into the client homepage (`components/home/home-client.tsx`) + `components/home/site-showcase.tsx` (localStorage cache; admin display-mode/hide/drag-reorder). Feed: `app/api/public/showcase`; generated thumbnails: `app/api/public/showcase/[slug]/thumb`. Curated list: `lib/home/featured-sites.ts`.
- **Builder first-run chooser**: `/admin/templates/new` shows industry / duplicate-template / blank (`components/admin/templates/start/start-your-site.tsx`). Industry scaffold seeds services + theme (`lib/builder/industryScaffold.ts`); industry themes (`lib/theme/industryPresets.ts`) are wired through the public render via `lib/theme/resolveSiteTheme.ts` + `TemplateThemeWrapper`. **`color_mode` defaults to `dark` everywhere**; the editor action toolbar has a light/dark toggle (persists to the template).
- **AI demo generation**: "Generate demos" admin button → `app/api/admin/demos/generate` (admin+cron) → `lib/builder/generateDemoSite.ts` (metered OpenAI copy+hero → insert → publish via `public.publish_template_demo` RPC). Random, category-diversifying spec: `lib/builder/randomDemoSpec.ts`. Nightly top-up cron `app/api/cron/demo-refresh` (OFF unless `DEMO_AUTOGEN_ENABLED=true`). Generated sites are tagged `claim_source='demo_seed'` + `data.meta.is_demo`.
- **Templates admin**: card view (`components/admin/templates/templates-card-grid.tsx`) with a Cards/Table toggle + shimmer placeholders during generation; admins see **all** templates (the list API + secure-MV gating in `app/api/admin/templates/list`).
- **Agency billing + finished take-rate (Pricing Phase 2)**: per-user + per-site tiers in `lib/billing/*` (`plans`, `agency`, `entitlements`) + `app/api/billing/*`; refund fee-reversal (`lib/commerce/refunds.ts`), agency fee-exemption + margin-aware fee in `createDraftOrder`, reconciliation `app/api/admin/commerce/reconcile`. See [`docs/PRICING_REDESIGN.md`](docs/PRICING_REDESIGN.md).
- **Print-on-demand + Author sites**: Lulu (books) + Gelato (posters/apparel) under `lib/commerce/pod/*`; fulfillment fires from `markOrderPaid` (gated by `POD_ENABLED`), records `print_orders`, syncs via `app/api/cron/print-order-sync` + `app/api/commerce/webhooks/lulu`. Catalog authoring in `components/merchant/CreateItemDrawer.tsx` (spec on `catalog_items.metadata.pod_spec`); admin view `/admin/print-orders`; `author` is a first-class industry. See [`docs/POD_AUTHOR_PLAN.md`](docs/POD_AUTHOR_PLAN.md).
- **Admin dashboards**: AI spend `/admin/ai-costs`, cron health `/admin/cron`, print orders `/admin/print-orders` (links in the admin nav).
- **Global settings**: `public.site_settings` (key/value jsonb, **service-role only**, RLS-denied) holds showcase mode/hidden/order. Helpers: `lib/settings/siteSettings.ts`.
- **New crons** (`vercel.json`): `agency-site-sync`, `demo-refresh`, `print-order-sync` (all cron-secret auth'd; the latter two are flag-gated).
- **Secrets**: a leaked service-role key was removed + a gitleaks scan added (CI `.github/workflows/secret-scan.yml` + pre-commit). Rotated 2026-06-30 — see [`docs/SECRET_ROTATION_RUNBOOK.md`](docs/SECRET_ROTATION_RUNBOOK.md).
- **White-label / agency branding (Tier 1.5)**: reseller orgs (`organizations_public.billing_mode === 'reseller'`) rebrand the client-facing surface. Brand data = `organizations_public` (a **view** over `organizations`; exposes `name`/`logo_url`/`dark_logo_url`/`theme_json`/`email_from`), resolved host→org by `lib/org/resolveOrg.ts` and served to the client via `OrgProvider`/`useOrg()`/`useBrand()` (`app/providers.tsx`) and `GET /api/org/branding` (`lib/org/branding.ts`, reseller-gated → 404 else). Branded surfaces: login/join pages, admin chrome wordmark+logo (`components/admin/admin-chrome.tsx`, `AppHeader/app-header.tsx`), transactional emails (`orgEmailBrand()` in `lib/email.ts` → per-org `email_from` sender + display-name/footer; **inert until a Resend domain is verified**), and `theme_json` accents (`lib/org/theme.ts#pickAccentColor`, validated hex). See [`docs/WHITE_LABEL_PLAN.md`](docs/WHITE_LABEL_PLAN.md).
- **Money-funnel instrumentation (Model A / A7)**: all 8 funnel steps + partner commission events emit server-side via `captureServer` at their authoritative transitions (`signup`→`platform_fee_collected`, `commission_accrued`/`_paid`). Event constants: `lib/analytics/events.ts`; signup heuristic: `lib/analytics/funnel.ts`. Building the PostHog funnel/insight is now a dashboard task. See [`docs/MODEL_A_PLAN.md`](docs/MODEL_A_PLAN.md).
- **Green-path money-path proofs** (admin-gated, in-app, no real Stripe): `POST /api/admin/commerce/e2e-demo` (seed merchant → order → paid → platform fee + partner residual, asserts the numbers) and `POST /api/admin/commerce/pod-demo` (author/POD flagship: Lulu book + Gelato poster, asserts the fee is taken on **margin** with the printer base cost carved out + a print job is queued). Both idempotent; `{cleanup:true}` tears down.
- **Sales tax**: when `QS_STRIPE_TAX_ENABLED=true`, Stripe `automatic_tax` runs at checkout and `markOrderPaid` records the computed tax to `orders.tax_cents` + reconciles `total_cents` (`parseStripeTaxTotals` in `lib/commerce/fees.ts`). Tax is **excluded from the platform-fee basis** (fee is locked at draft on the pre-tax subtotal); surfaced on the receipt.
- **Public marketing surfaces**: `/partners` (reseller landing), `/partners/calculator` (interactive GMV earnings vs flat-markup), and `/compare` (features-vs-Duda/GoHighLevel chart with sourced pricing + an honest "where they lead" section). Positioning source: [`docs/COMPETITIVE_LANDSCAPE.md`](docs/COMPETITIVE_LANDSCAPE.md).

## 6. Architecture facts that will surprise you

- **The backend = Next API routes.** ~349 `route.ts` files; ~70% of business logic is *inline in routes*, not in a service layer. A thin service layer exists only for commerce (`lib/commerce/*`, `lib/payments/*`). Extracting a standalone backend is the planned north star — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). **When writing new logic, put it in `lib/<domain>/` as a pure function and call it from the route** — this is how we incrementally earn the split.
- **Multi-tenant by org.** `middleware.ts` resolves host → org (`lib/org/resolveOrg.ts`), sets `x-qsites-org-*` headers, and rewrites platform/custom domains to `/sites/*` or `/orgs/*`. Default org via `DEFAULT_ORG_SLUG`.
- **Auth is Supabase SSR.** Clients are created in `lib/supabase/{server,admin,browser,middleware}.ts`. Roles come from `user_profiles.role` + `ADMIN_EMAILS` + an `admin_users` table. There is no centralized auth middleware — routes check `getUser()` themselves. Be consistent: gate every new non-public route.
- **RLS is real on commerce tables** (see `supabase/migrations/20250827_open_commerce.sql`) but most app queries use the **service-role key** server-side and bypass RLS — so route-level authorization is load-bearing. Don't assume RLS protects you in an API route.
- **Secrets are read ad-hoc** via `process.env.*` with string-default fallbacks; there's no validated env loader yet (a planned cleanup).
- **AI/LLM calls are metered** via `lib/ai/meter.ts` (`meterLLMCall`): budget guard + cost logging + PostHog mirror. ~21 OpenAI routes still need converting — see [`docs/LLM_METERING.md`](docs/LLM_METERING.md). Don't call OpenAI raw in new code; use the wrapper.

## 7. Conventions

- **TypeScript, no `any` in new code.** `tsc --noEmit` is green — keep it green.
- **API routes**: `runtime = 'nodejs'`, `dynamic = 'force-dynamic'` is the norm (Supabase service role needs Node). Use the response helpers in `lib/api/json.ts` and prefer the Zod validation wrappers in `lib/api/withInputOutputValidation.ts` for new endpoints.
- **New business logic → `lib/<domain>/`** (pure, testable), thin route on top.
- **Money in integer cents**, never floats. Match the schema (`*_cents`).
- **Cron** endpoints live under `app/api/cron/*`, registered in `vercel.json`, auth'd by `isCronAuthorized` (`x-cron-secret`/`CRON_SECRET` or Vercel's `Authorization: Bearer`). Wrap the body in `runCron(job, …)` for `cron_runs` logging.
- **New sites/templates default to `color_mode: 'dark'`.** Creation + render fallbacks all default dark; set `color_mode: 'light'` explicitly to override.
- **Conventional commits** (`npm run commit` / commitlint). NOTE: current history is squashed to `📦 g` placeholders — start writing real messages.

## 8. Known debt / traps (don't trip on these)

- Duplicate/legacy files: `lib/create-default-block-RESOLVE-DUP.ts`, `lib/blocks/_likely-remove_*`, `vercel.json.bak`, `page-v0.tsx`. Don't import them.
- `app/api/deploy-webhook/route.ts` is effectively disabled (commented).
- **Direct `UPDATE`s to `templates` are blocked** by the `app.guard_templates_update` trigger ("Use app.commit_template()"). Go through the sanctioned RPCs (`app.commit_template`, `app.set_template_slug`, `app.publish_site`, or the `public.publish_template_demo` helper), or `set_config('app.bypass_template_guard','on', true)` inside a txn for one-off SECURITY DEFINER work. INSERTs are fine.
- Stripe Connect onboarding has two code paths; the older one writes a deprecated `merchant_payment_accounts` table. Use the `payment_accounts` path. See [`docs/MONETIZATION.md`](docs/MONETIZATION.md).
- Large artifacts were committed to git (`quicksites-export.zip`, `get-pip.py`, `.tsbuildinfo`, lint reports) — being purged in the cleanup milestone.
- Two `admin/` locations: `app/admin/` (UI) and a top-level `admin/` (libs/tooling, incl. the master block schema). Don't confuse them.
- **`types/supabase.ts` is stale** (88 tables; the live DB has ~214 — commerce tables absent). DON'T naively run `supabase gen types` to "fix" it: the CLI (2.98) emits a format the pinned `@supabase/supabase-js` (2.75) resolves to `never`, producing **~1000 `TS2339 … on type 'never'`** errors across the whole typed-client surface. The current file is hand-trimmed to stay compatible. Properly regenerating requires first aligning the `@supabase/*` versions with the CLI output format — treat as its own task. Until then, commerce queries are loosely typed; verify columns against the live DB (`psql "$SUPABASE_DB_URL"`), not the types file.

## 9. For AI agents specifically

- Prefer editing `lib/<domain>/` pure functions over inflating route handlers.
- Before adding an integration, check §2 — it's probably already a dependency.
- The authoritative data model is **`supabase/migrations/*` + `types/supabase.ts`**, not any prose doc.
- When unsure whether code is live, check for the legacy markers in §8 and grep for imports before assuming.
- Keep `tsc --noEmit` green; run `npm run typecheck` after non-trivial changes.
