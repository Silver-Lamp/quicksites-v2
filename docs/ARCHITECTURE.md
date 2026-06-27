# QuickSites — Architecture & the Standalone-Backend Plan

> Companion to [`../CLAUDE.md`](../CLAUDE.md). This doc is the deeper system map and the **north-star plan for extracting a standalone backend**.

---

## 1. System overview

QuickSites is a **Next.js 15 App-Router monolith** on Vercel, backed by Supabase. The browser app, the public rendered sites, and the entire backend (~349 API routes) all live in one deployment.

```
                         ┌──────────────────────────────────────────┐
   Browser / Public      │            Vercel (one deploy)            │
   site visitors  ─────▶ │  Next.js App Router                       │
                         │   ├── app/admin/*      builder UI         │
                         │   ├── app/sites/*      public sites       │
                         │   ├── app/{merchant,chef,meals,cart,...}  │
                         │   └── app/api/**       ~349 route.ts  ◀── backend
                         │            │                              │
                         │      middleware.ts  (host→org routing)    │
                         └────────────┼──────────────────────────────┘
                                      │ service-role key (bypasses RLS)
                        ┌─────────────┼───────────────────────────────┐
                        ▼             ▼              ▼          ▼
                   Supabase       Stripe (+Connect)  OpenAI/Qdrant   Namecheap/Vercel API
                   PG+Auth+Store   payments/payouts  AI/vectors      domain provisioning
                                      Resend(email) · Twilio(SMS) · Sentry(errors)
```

## 2. Request lifecycle

1. **`middleware.ts`** runs first. It resolves the tenant from the `Host` header (or `?org=` / `qs_org_slug` cookie), sets `x-qsites-org-slug` / `x-qsites-org`, captures `?ref=` into a 90-day `qs_ref` cookie (referral attribution), and **rewrites** hostnames:
   - platform subdomains `*.quicksites.ai` → `/sites/<subdomain>`
   - mapped org domains → `/orgs/<slug>`
   - custom domains → `/sites/<apex>`
2. **Org resolution** for server code: `lib/org/resolveOrg.ts` (cookie → `org_domains_public` table → `DEFAULT_ORG_SLUG`).
3. **Auth**: route handlers build a Supabase client (`lib/supabase/server.ts` for user context, `lib/supabase/admin.ts` for service-role) and check the session themselves. Request context (userId, role, geo, traceId) is assembled by `lib/request/getRequestContext.ts`. Roles: `user_profiles.role` + `ADMIN_EMAILS` + `admin_users`.
4. **Handler** executes — mostly inline logic; commerce routes delegate to `lib/commerce/*`.

> **Authorization is load-bearing at the route level.** Most server queries use the service-role key and bypass Postgres RLS. RLS exists (good defense in depth on commerce tables) but must not be relied on inside API routes. Gate every non-public route explicitly.

## 3. Subsystems

| Subsystem | UI | API | Core lib | Notes |
|---|---|---|---|---|
| **Site builder** | `app/admin/templates/*`, `components/admin/templates/*` | `app/api/templates/*` (24) | `lib/blockRegistry.core.ts`, `lib/renderBlockRegistry.ts`, `admin/lib/zod/blockSchema.ts` | Template = JSON of pages→blocks; Zod-validated; rendered by registry. |
| **Public sites** | `app/sites/[slug]/[[...rest]]` | — | `components/sites/site-renderer.tsx`, `lib/site-chrome.ts` | Catch-all renders published template by slug/domain. |
| **Domains** | settings panels | `app/api/domains/*` | `lib/domains/{vercel,namecheap,dns}.ts` | Programmatic register + DNS + attach-to-Vercel. |
| **Commerce** | `app/{merchant,chef,meals,cart,checkout,orders}` | `app/api/{commerce,chef,merchant,orders,payments}/*` | `lib/commerce/*`, `lib/payments/*`, `lib/stripe/*` | Open Commerce schema; Stripe Connect; platform fee. |
| **Billing/subscriptions** | — | `app/api/billing/*` | — | QS platform subscriptions → `merchant_billing`, commission ledger. |
| **Referrals/affiliates** | `app/admin/referrals/*` | `app/api/referrals/*`, `app/api/rep/*` | `lib/commerce/attribution.ts` | Commission ledger + payout runs (manual). |
| **AI** | inline in editors | `app/api/ai/*`, `app/api/{hero,faq,testimonials,icon,favicon}/*` (≈15) | `lib/ai/*` (incl. cost logging) | Copy/image generation. |
| **Tenancy (orgs)** | `app/orgs/*` | `app/api/org(s)/*` | `lib/org/resolveOrg.ts` | White-label theming per org (`organizations_public`). |
| **Admin** | `app/admin/*` | `app/api/admin/*` (67) | `lib/admin/*` | Largest, most heterogeneous surface. |

## 4. Data model anchors

The **authoritative schema is `supabase/migrations/*` + generated `types/supabase.ts`**. Key clusters:

- **Builder**: `templates` (JSON `data` column = pages/blocks; denormalized `industry`, `custom_domain`, `published`), snapshots/history, `domains`, `org_domains_public`, `organizations_public`.
- **Open Commerce** (`20250827_open_commerce.sql`): `merchants`, `catalog_items`, `availability`, `carts`/`cart_items`, `orders`/`order_items`, `payment_accounts`, `payments`, `referral_codes`, `attributions`, `commission_ledger`. RLS enabled; `is_owner()` helper.
- **Fees/billing** (`20250827_platform_fees_and_billing.sql`): per-merchant `collect_platform_fee` / `platform_fee_percent` / `platform_fee_min_cents`; `merchant_billing`.
- **Payouts/tax** (`20250827_payout_runs.sql`, `20250827_affiliate_tax.sql`): `payout_runs`, `affiliate_tax_profiles`, `affiliate_payouts`, `affiliate_1099_filings`.

## 5. Background work

- **Vercel cron** (`vercel.json`) → `app/api/cron/*`: `email-drain` (daily), `social-dispatch` (5-min), `last-call-scan` (5-min), `compliance-reminders` (daily), `weekly-compliance-digest` (weekly); plus trial-expiry and AI-pricing-sync admin jobs.
- **No dedicated queue** (no BullMQ/Inngest). Long tasks (screenshots, AI gen) run inline in the request or call external services. This is a scaling constraint and a prime candidate for the worker service below.

---

## 6. North star: extracting a standalone backend

**Decision (2026-06-26):** move toward a **standalone API backend on Supabase Edge Functions** (Deno), consumed by a thinner Next.js frontend. This section is the pragmatic, incremental path — *not* a big-bang rewrite. The monolith stays shippable the entire way.

**Why Edge Functions (vs a Fastify/Nest container):** no separate infra to run/scale, deploys with the same `supabase` CLI as our migrations, native access to the Postgres + service-role key we already use, and webhooks/cron co-located with the data. **Constraints to design around:** Deno runtime (not Node) — so logic we extract must be runtime-agnostic (no `next/*`, no Node-only built-ins in `packages/core`); cold starts and a per-invocation time budget (heavy/long jobs need chunking or pg_cron + queue); npm interop via `npm:`/`esm.sh` specifiers. These constraints reinforce the enabling refactor below: pure, dependency-light domain functions port cleanly to Deno.

### 6.1 Why, honestly
- **Pros that matter here:** independent scaling of heavy/async work; a clean contract that lets multiple devs (and partners/white-label consumers) build against a documented API; ability to run long jobs off the Vercel request path; clearer security boundary than "service-role key in 349 routes."
- **Costs to respect:** more infra to run/observe/document; latency of an extra hop; duplicated auth/tenancy plumbing if done carelessly. **Onboarding-readiness (Milestone 1) comes first** — a half-extracted backend is worse than a documented monolith.

### 6.2 Target shape

```
apps/
  web/        Next.js — UI, public site rendering, BFF-thin routes
supabase/
  functions/  Deno Edge Functions = the standalone backend
              commerce-checkout, stripe-webhook, payouts, domains, ai-jobs, cron-*
  migrations/ schema (already here)
packages/                         (Deno-compatible: no next/*, no Node-only APIs)
  core/       pure domain logic (today's lib/commerce, lib/payments, ...)
  db/         Supabase client factory + generated types (shared)
  contracts/  Zod schemas / OpenAPI = the API contract both sides import
```

The repo already has an `openapi-gen/` setup and `zod-to-openapi` — the **contract-first** path is viable. Edge Functions import `packages/core` + `packages/contracts` directly (same monorepo); Next calls the functions over HTTP (or via the Supabase client's `functions.invoke`).

### 6.3 The enabling refactor (do this regardless of when the split lands)

The split is cheap *if and only if* business logic isn't trapped in route handlers. So the standing rule (already in CLAUDE.md §6):

> **All new logic goes in `lib/<domain>/` as pure, framework-free functions. Routes become thin adapters: parse → call lib → format response.**

Concretely:
1. **Extract a service layer** from the hottest routes into `packages/core` candidates: start with `lib/commerce/*` and `lib/payments/*` (already partly there).
2. **Centralize env access** behind a validated loader (`packages/core/env.ts` with Zod) — removes the scattered `process.env.*` fallbacks and makes the backend portable.
3. **Centralize auth/tenancy** into a single `requireUser(req)` / `resolveOrg(req)` pair that takes plain headers/cookies (no `next/headers` dependency) so it works in both Next and a standalone server.
4. **Adopt the Zod request/response wrappers** (`lib/api/withInputOutputValidation.ts`) everywhere new — this *is* the contract.

### 6.4 Sequenced extraction (low→high coupling)

| Phase | Extract → Edge Function(s) | Why first |
|---|---|---|
| 0 | `packages/db` + `packages/contracts` + env loader (Deno-compatible) | Shared foundation; no behavior change. |
| 1 | **Stripe webhook** (`supabase/functions/stripe-webhook`) | Highest-value isolation: a stateless, security-sensitive endpoint that *should* live next to the DB; directly serves Model A (A3/A4). Great first real function. |
| 2 | **commerce-checkout** function | The money path (Model A A2); bounded I/O (cart → `createDraftOrder` → Stripe session). |
| 3 | **cron-*** (email-drain, social-dispatch, etc.) via `pg_cron` → functions | Off the Vercel request path; pairs with Edge cron. |
| 4 | **payouts / domains / ai-jobs** | Integration-bound, moderate coupling. |
| 5 | **Admin + public data APIs** | Largest/most heterogeneous; split by domain last. |

Each phase: extract logic to `packages/core` (pure Deno-safe TS), stand up the Edge Function, point Next at it behind a feature flag, verify, then delete the in-Next route. Reversible at every step. **Note the alignment with Model A:** Phases 1–2 *are* the backend for the e-commerce-slice money path, so the monetization work and the first real Edge Functions are the same effort.

### 6.5 Explicitly out of scope (for now)
- Rewriting the builder/editor — it stays in Next (it's UI-heavy, RSC-friendly).
- Public site rendering — stays in Next (SEO/edge rendering is a Next strength).
- A second database or non-Supabase ORM — Supabase remains the system of record.

---

## 7. Observability & analytics

- **Sentry** is wired for errors.
- **PostHog** is being added for product analytics (funnels: builder activation, publish, first order, partner-attributed revenue). See [`REVIVAL_PLAN.md`](REVIVAL_PLAN.md). Capture both client (autocapture + key events) and **server-side** events on the money path so revenue analytics survive the backend split.

## 8. Open questions for the team
- ~~Standalone-API runtime~~ → **Decided: Supabase Edge Functions (Deno)** (2026-06-26). See §6.1–6.4.
- Monorepo tooling: adopt **pnpm workspaces** (Deno can consume them) when we create `apps/web` + `packages/*`. Decide before Phase 0.
- Background jobs on Supabase: **`pg_cron` + `pg_net`** to invoke Edge Functions, vs a managed queue. Decide before Phase 3. (Removes the earlier Inngest question — staying in the Supabase platform.)
- Deno npm-interop strategy for shared deps (Stripe SDK, OpenAI SDK): `npm:` specifiers vs HTTP imports. Pin early to avoid drift.
