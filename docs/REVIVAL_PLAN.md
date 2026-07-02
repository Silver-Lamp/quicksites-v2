# QuickSites — Revival Plan

> The phased plan to bring QuickSites back to active, multi-dev development.
> Companion to [`../CLAUDE.md`](../CLAUDE.md), [`ARCHITECTURE.md`](ARCHITECTURE.md), [`MONETIZATION.md`](MONETIZATION.md).
> Owner: Sandon · Started: 2026-06-26.

## Decisions locked (2026-06-26)
1. **Backend:** extract a standalone API on **Supabase Edge Functions (Deno)**, incrementally (north star in [`ARCHITECTURE.md`](ARCHITECTURE.md) §6). First functions = the Stripe webhook + commerce-checkout, which double as Model A's backend.
2. **First milestone:** **onboarding-ready repo** (build green, docs, cleanup, PostHog) — ✅ done.
3. **Monetization lead:** **Model A (free hosting + e-commerce slice).** Prove the take-rate path first; Model B (white-label/partner) layers on the same `commission_ledger` afterward. Execution plan: [`MODEL_A_PLAN.md`](MODEL_A_PLAN.md).

## Starting state (verified)
- Next.js 15 App Router, Supabase, Stripe/OpenAI/Qdrant/Resend/Twilio/Sentry/Namecheap all wired.
- `tsc --noEmit` **passes clean (0 errors)** — codebase is healthy, not bit-rotted.
- Monetization machine **~50% built** (schema + most of the order→fee→ledger path).
- Gaps: no central docs (now addressed), repo hygiene, no PostHog, money-path "last mile."

---

## Milestone 1 — Onboarding-ready  *(in progress)*
**Goal:** a new dev (or one of Dwayne's people) can clone, run, and understand the system in under an hour.

- [x] Deep recon of the codebase + subsystems.
- [x] **Central brain**: `CLAUDE.md`.
- [x] **Architecture map** + backend north star: `docs/ARCHITECTURE.md`.
- [x] **Revenue review**: `docs/MONETIZATION.md`.
- [x] This plan: `docs/REVIVAL_PLAN.md`.
- [x] **PostHog** wired (`components/analytics/posthog-provider.tsx` + `lib/analytics/posthog-server.ts`, mirrored from `trackEvent`).
- [x] **Dependency conflict fixed**: package.json `overrides`/pins for `@types/node|react|react-dom` were forcing versions incompatible with TS 5.9 (the "green" build relied on un-committed `node_modules` drift). Aligned to the known-good `24.3.0 / 19.1.10 / 19.1.7`; `tsc --noEmit` green on the committed deps.
- [x] **LLM metering** primitive: `ai_usage_events` migration + `lib/ai/meter.ts` (budget guard + cost logging + PostHog `llm_call` mirror) + `docs/LLM_METERING.md`; first route wired (`/api/ai/suggest`). ~20 OpenAI routes remain to convert (follow-on).
- [ ] **Security: bump Next off CVE-2025-66478** — currently pinned `next@15.2.4` (+ `eslint-config-next@15.2.4`). Move to a patched 15.4.x. Own PR (verify build).
- [ ] **Repo cleanup**: purge large committed artifacts (`quicksites-export.zip`, `get-pip.py`, `.tsbuildinfo`, lint reports, `*.bak`) and dead dirs (`_pages-legacy/`, `_deprecated__domains/`, `_deprecating_sites/`, `page-v0.tsx`); fix `.gitignore`.
- [ ] **Refresh stale docs**: retire/replace `README.md` + `ROUTER_STRATEGY.md` (they describe the old Pages Router); make `README.md` point at `CLAUDE.md`.
- [ ] **CONTRIBUTING + dev setup**: confirm `.env.example` is complete; document the minimum-boot env set.
- [ ] **Green `next build`** verified once (typecheck already green).
- [ ] Real commit messages going forward (current history is `📦 g` placeholders).

**Exit criteria:** fresh clone → `npm install && npm run dev` boots with documented env; `CLAUDE.md` answers "what is this / how do I run it / where does X live"; PostHog shows events; CI is green.

## Milestone 2 — Foundation for the split  *(enabling refactor)*
**Goal:** make the backend extraction cheap, without yet splitting deploys.

- [ ] Validated **env loader** (`packages/core/env.ts` w/ Zod) replacing scattered `process.env.*`.
- [ ] **Auth/tenancy** helpers decoupled from `next/headers` (`requireUser`, `resolveOrg` over plain headers/cookies).
- [ ] Begin **service-layer extraction** of hottest logic into pure `lib/<domain>/` functions (start: commerce/payments).
- [ ] Adopt Zod **request/response contracts** on all new routes (`lib/api/withInputOutputValidation.ts`).
- [ ] Stand up **monorepo tooling** (pnpm workspaces / Turborepo) scaffolding for `apps/*` + `packages/*` when ready.
- [ ] Decide standalone-API runtime: **Fastify/Nest vs Supabase Edge Functions** (see ARCHITECTURE §8).

## Milestone 3 — Monetization: Model A first dollar  *(next up)*
**Goal:** first real (test-mode) dollar through the e-commerce slice. Full ticketed plan: [`MODEL_A_PLAN.md`](MODEL_A_PLAN.md).
- [x] **Lead model chosen: Model A.**
- [x] Canonical funnel events defined (`lib/analytics/events.ts`).
- [x] **A1** consolidate on `payment_accounts` (killed `merchant_payment_accounts` + bps fee columns; migration `20260701_retire_legacy_connect_bps.sql`).
- [ ] **A2** one checkout entry point (`app/api/commerce/checkout`).
- [ ] **A3** first live test-mode order → platform fee collected. ← *first dollar*
- [ ] **A4/A5** refund fee-reversal + revenue reconciliation.
- [ ] **A6** seeded demo storefront (finish chefs/meals checkout).
- [x] **A7** funnel events emitted server-side at all 8 money steps + commission accrue/pay (see [`MODEL_A_PLAN.md`](MODEL_A_PLAN.md) A7 emit map). Building the PostHog funnel/insight dashboard is now a PostHog-side task.

## Milestone 4 — Backend extraction to Supabase Edge Functions (phased)
Execute ARCHITECTURE §6.4: Phase 0 (Deno-safe `packages/db`+`contracts`+env) → Phase 1 (**stripe-webhook** Edge Function) → Phase 2 (**commerce-checkout**) → Phase 3 (cron via `pg_cron`) → Phase 4 (payouts/domains/AI) → Phase 5 (admin/public). Phases 1–2 are shared with Model A (A3/A4/A2) — the monetization work *is* the first backend extraction. Each phase reversible behind a flag.

## Milestone 5 — White-label / partner productization (if Model B)
Partner self-serve onboarding, automated commission approval, **actual disbursement** (Stripe Transfer/Payout), reconciliation, 1099 furnishing.

---

## Working agreements (for multiple devs)
- **New logic → `lib/<domain>/` pure functions**, thin routes on top. This is how we earn the backend split for free.
- Keep `tsc --noEmit` green; run `npm run typecheck` before pushing.
- Money in integer **cents**; never floats.
- Gate every non-public route explicitly — **don't rely on RLS inside service-role routes**.
- Conventional commits; PRs small and reviewable.
- Update the relevant doc in this folder when you change a subsystem's shape.

## Immediate next actions
1. Finish Milestone 1: **PostHog + cleanup** (in progress this session).
2. Decide the **monetization lead model** (A recommended) → spin its checklist into tickets.
3. Decide the **standalone-API runtime** so Milestone 2 can start.
