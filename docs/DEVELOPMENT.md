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

## Working in a git worktree (two sessions, one repo)

When more than one person or session is live, use a worktree — a shared working tree turns an ordinary
`git checkout -b` into someone else's commits riding your PR, and a stray commit into a
direct-to-`main` push. Both happened on 2026-08-17.

```bash
git worktree add -b feat/<your-lane> ../qs-<lane>   # ⚠️ NOT `... ../dir main`
cp .env.local ../qs-<lane>/.env.local               # gitignored → a fresh tree boots nothing without it
cd ../qs-<lane> && nvm use && npm install
npm rebuild canvas                                  # deliberate step, not a fallback — see below
```

- **`git worktree add <dir> main` fails.** Git refuses one branch in two worktrees and the main tree
  holds `main`. Always `-b <new-branch>`.
- **`.env.local` holds live keys**, including a live-mode Stripe secret. Copying it is a decision about
  where credentials live — it is the owner's call, not a setup detail. Confirm it is still *ignored*
  (`git -C ../qs-<lane> check-ignore -v .env.local`), not merely untracked, before doing anything else.
- **Never symlink `node_modules` between worktrees** — native modules fail in ways that read as source
  bugs.

## Gotchas (these will bite you)
- **`canvas` is an `optionalDependency`, so a failed build is SILENT.** `npm install` will not error when
  it can't build; it skips it. The break surfaces much later as a module-not-found from one of the
  **seven** consumers — five of them API routes (`/api/posters/[slug]`, `/api/qr-poster`, and three
  `/api/block-qr/*`) — none of which mentions canvas in its URL. So on a fresh install or a new
  worktree, run `npm rebuild canvas` **deliberately** and then verify:
  ```bash
  curl -sI localhost:3000/api/block-qr/preview   # expect: 200, content-type: image/png
  ```
  **`GET /api/block-qr/preview` is a purpose-built canvas smoke test** — no params, no auth, just
  `createCanvas(100,100)` → PNG. Use it and nothing else. ⚠️ A `400` from `/api/qr-poster` or a `405`
  from `/api/block-qr` proves only that the module *compiled*: validation short-circuits before
  `createCanvas` is ever reached, so those replies look identical whether or not the native binding
  works. (`/api/qr-poster` additionally needs a `support_campaigns` row, and that table is empty here.)
- **`next build` fails with `canvas.node ... NODE_MODULE_VERSION`** → the native `canvas` module was built for a different Node. Fix: `npm rebuild canvas` (ensure you're on Node 20).
- **Don't silence stderr in a `&&` chain whose earlier link can fail.** `nvm use >/dev/null 2>&1 && npm install`
  exited **3 with zero bytes of output** when `.nvmrc` pinned an uninstalled patch — the exit code said
  something broke and only stderr could say *which link*, so it read as a mysterious `npm install`
  failure. (`.nvmrc` now pins the major, guarded by `lib/config/__tests__/nodeVersionPin.test.ts`.)
- **Don't naively run `supabase gen types`** to refresh `types/supabase.ts` — the CLI's output format breaks the pinned `@supabase/supabase-js`, producing ~1000 `'never'` type errors. The committed file is hand-trimmed for compatibility; verify columns against the live DB instead (`psql "$SUPABASE_DB_URL"`). Details in [`../CLAUDE.md`](../CLAUDE.md) §8.
- **`next@15.2.4` carries CVE-2025-66478** — a planned upgrade (see [`REVIVAL_PLAN.md`](REVIVAL_PLAN.md)).
- Stale root docs: `README.md`, `ROUTER_STRATEGY.md` describe the old Pages Router. Trust `CLAUDE.md` + this folder.

## Where to go next
- **Architecture / where things live** → [`../CLAUDE.md`](../CLAUDE.md)
- **System map + backend plan** → [`ARCHITECTURE.md`](ARCHITECTURE.md)
- **Commerce / money path** → [`COMMERCE_RUNBOOK.md`](COMMERCE_RUNBOOK.md), [`MONETIZATION.md`](MONETIZATION.md)
- **What's planned** → [`REVIVAL_PLAN.md`](REVIVAL_PLAN.md), [`MODEL_A_PLAN.md`](MODEL_A_PLAN.md)
