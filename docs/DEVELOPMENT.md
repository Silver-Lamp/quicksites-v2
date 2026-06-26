# QuickSites — Local Development

How to run QuickSites locally. Companion to [`../CLAUDE.md`](../CLAUDE.md) (the architecture brain).
Last verified: 2026-06-26 · Next.js 15 App Router · Node 20.

## Prerequisites
- **Node 20.x** and **npm 10.x** (see `.nvmrc` / `package.json#engines`). Use `nvm use`.
- A **Supabase** project (URL + anon + service-role keys) — the app won't boot without it.
- Optional, per feature: **Stripe** test keys (commerce), **OpenAI** key (AI features), **PostHog** keys (analytics).
- Docker is **not** required for `npm run dev`. (It's only needed for `supabase gen types --local` — and see the types caveat below.)

## First run
```bash
nvm use                       # Node 20
npm install
cp .env.example .env.local     # then fill in the keys below
npm run dev                    # → http://localhost:3000
```
`npm run dev` clears `.next`, prints a dev banner, and starts Next on `localhost:3000`.

## Environment
Copy `.env.example` → `.env.local`. It's grouped by feature; the **minimum to boot** is Supabase:

```env
# Required to boot
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>      # server-side; keep secret
```
Add per feature:
```env
# Commerce (Stripe Connect) — real money path
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_BASE_URL=http://localhost:3000

# Commerce TEST MODE — exercise orders/fees without Stripe (see Commerce runbook)
QS_TEST_CHECKOUT=1
QS_TEST_PLATFORM_FEE_PERCENT=0.05
QS_PUBLIC_URL=http://localhost:3000

# AI features
OPENAI_API_KEY=sk-...

# Analytics (optional; no-ops if unset)
NEXT_PUBLIC_POSTHOG_KEY=phc_...
POSTHOG_KEY=phc_...
```
`.env.example` has the full grouped list. `.env*` files are gitignored (except `.env.example`).

## Everyday commands
| Command | What |
|---|---|
| `npm run dev` | Dev server on `localhost:3000` |
| `npm run typecheck` | `tsc --noEmit` — keep this green |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run test` | Playwright e2e |
| `npm run build` | Production build (`next build`) |
| `npm run clean` / `npm run reset` | Wipe `.next`/caches / full reset + reinstall |

Commits use **conventional commits** (Husky + commitlint); a pre-commit hook runs `lint:links`.

## Try the commerce flow locally (no Stripe needed)
With `QS_TEST_CHECKOUT=1` set, the checkout marks orders paid in **test mode** so you can see the full money path:
1. Seed demo products: `psql "$SUPABASE_DB_URL" -f scripts/seed-demo-products.sql`
2. Visit `http://localhost:3000/store/<merchant-id-or-slug>` → add to cart → `/checkout` → **Place order**.
3. See the receipt at `/checkout/success`; check the order/fee in the DB or `/admin/revenue`.

For a **real** test-mode Stripe charge (Connect onboarding + `4242` card), follow [`COMMERCE_RUNBOOK.md`](COMMERCE_RUNBOOK.md).

## Gotchas (these will bite you)
- **`next build` fails with `canvas.node ... NODE_MODULE_VERSION`** → the native `canvas` module was built for a different Node. Fix: `npm rebuild canvas` (ensure you're on Node 20).
- **Don't naively run `supabase gen types`** to refresh `types/supabase.ts` — the CLI's output format breaks the pinned `@supabase/supabase-js`, producing ~1000 `'never'` type errors. The committed file is hand-trimmed for compatibility; verify columns against the live DB instead (`psql "$SUPABASE_DB_URL"`). Details in [`../CLAUDE.md`](../CLAUDE.md) §8.
- **`next@15.2.4` carries CVE-2025-66478** — a planned upgrade (see [`REVIVAL_PLAN.md`](REVIVAL_PLAN.md)).
- Stale root docs: `README.md`, `ROUTER_STRATEGY.md` describe the old Pages Router. Trust `CLAUDE.md` + this folder.

## Where to go next
- **Architecture / where things live** → [`../CLAUDE.md`](../CLAUDE.md)
- **System map + backend plan** → [`ARCHITECTURE.md`](ARCHITECTURE.md)
- **Commerce / money path** → [`COMMERCE_RUNBOOK.md`](COMMERCE_RUNBOOK.md), [`MONETIZATION.md`](MONETIZATION.md)
- **What's planned** → [`REVIVAL_PLAN.md`](REVIVAL_PLAN.md), [`MODEL_A_PLAN.md`](MODEL_A_PLAN.md)
