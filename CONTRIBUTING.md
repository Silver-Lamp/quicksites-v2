# 🛠 Contributing to QuickSites

Thanks for contributing! QuickSites is a Next.js 15 (App Router) + Supabase app — a
schema-driven site builder with a generic e-commerce layer.

> **New here?** Read [`CLAUDE.md`](CLAUDE.md) (architecture brain) and
> [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) (full local-dev setup) first.

## 📦 Setup (short version)
```bash
git clone git@github.com:Silver-Lamp/quicksites-v2.git
cd quicksites-v2
nvm use                       # Node 20.x
npm install
cp .env.example .env.local    # fill in Supabase keys (minimum to boot)
npm run dev                   # → http://localhost:3000
```
Full env list, feature keys, and gotchas: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## 🧪 Commands
```bash
npm run dev         # dev server (localhost:3000)
npm run typecheck   # tsc --noEmit — keep it green
npm run lint:fix    # ESLint (+ Prettier)
npm run test        # Playwright e2e
npm run build       # production build
```

## ✅ Conventions
- **Conventional commits** (Husky + commitlint). A pre-commit hook runs `lint:links`.
- **TypeScript, no `any` in new code.** Keep `npm run typecheck` green.
- **New business logic → `lib/<domain>/`** as pure functions; keep route handlers thin
  (this is how we earn the planned backend split — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)).
- Money in integer **cents**; gate every non-public API route explicitly (don't rely on RLS
  inside service-role routes).
- PRs to `main` (or a branch) with clear messages.

## 🧩 Where things live
- `app/` — App Router pages + `app/api/**` (the backend today)
- `components/` — React UI · `lib/` — data access, integrations, domain logic
- `lib/supabase/*` — Supabase client factories · `lib/commerce/*`, `lib/payments/*` — money path
- `supabase/migrations/` — the canonical data model
- `docs/` — architecture, dev setup, commerce, monetization, plans

(Full map in [`CLAUDE.md`](CLAUDE.md) §4.)

## 🧠 Before a non-trivial change
- Run `npm run typecheck`.
- If you change a subsystem's shape, update the relevant doc in `docs/`.
- Check the "Gotchas" in [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) (canvas rebuild, the
  `types/supabase.ts` regen trap).
