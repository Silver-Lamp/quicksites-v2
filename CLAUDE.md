# QuickSites — Central Brain

> The single orientation doc for humans and AI agents working in this repo.
> If you read one file before touching code, read this one.
> Companion docs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/MONETIZATION.md`](docs/MONETIZATION.md) · [`docs/LLM_METERING.md`](docs/LLM_METERING.md) · [`docs/REVIVAL_PLAN.md`](docs/REVIVAL_PLAN.md)

Last verified: 2026-06-26 · `tsc --noEmit` passes clean (0 errors).

---

## 1. What QuickSites is

A **site generator + commerce platform for local businesses**. Two products share one codebase:

1. **Site Builder** — a schema-driven, drag-and-drop website builder. A *template* is edited in an admin UI, rendered to a public site, and published to a subdomain or programmatically-provisioned custom domain. AI assists with copy (hero, services, testimonials, FAQ).
2. **Open Commerce** — a multi-tenant commerce layer on top of the builder: merchants list catalog items (meals/products/services/digital), customers check out via Stripe, and the **platform takes a per-order fee**. A referral/affiliate system pays residual commissions to reps and partners.

The commercial thesis (see [`docs/MONETIZATION.md`](docs/MONETIZATION.md)): **near-free hosting, monetized by an e-commerce take-rate and/or white-labeling the builder+commerce to partners** who resell to their networks.

## 2. Stack at a glance

| Layer | Choice |
|---|---|
| Framework | **Next.js 15.4.6, App Router** (`app/`), React 18, TypeScript |
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

```bash
nvm use                       # Node 20
npm install
cp .env.example .env.local    # fill Supabase + Stripe (test) + OpenAI keys at minimum
npm run dev                   # http://localhost:3000
```

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
- **Cron** endpoints live under `app/api/cron/*`, registered in `vercel.json`, auth'd by the `x-cron-secret` header (`CRON_SECRET`).
- **Conventional commits** (`npm run commit` / commitlint). NOTE: current history is squashed to `📦 g` placeholders — start writing real messages.

## 8. Known debt / traps (don't trip on these)

- Duplicate/legacy files: `lib/create-default-block-RESOLVE-DUP.ts`, `lib/blocks/_likely-remove_*`, `vercel.json.bak`, `page-v0.tsx`. Don't import them.
- `app/api/deploy-webhook/route.ts` is effectively disabled (commented).
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
