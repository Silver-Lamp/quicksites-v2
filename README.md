# 🧠 QuickSites

> ⚠️ **New here? Start with [`CLAUDE.md`](CLAUDE.md)** — the central brain (what this is, where everything lives).
> 🚀 **Running it locally → [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)** (setup, env, commands, gotchas).
> Deeper docs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/COMMERCE_RUNBOOK.md`](docs/COMMERCE_RUNBOOK.md) · [`docs/MONETIZATION.md`](docs/MONETIZATION.md) · [`docs/LLM_METERING.md`](docs/LLM_METERING.md) · [`docs/REVIVAL_PLAN.md`](docs/REVIVAL_PLAN.md)
>
> **Quick start:** `nvm use && npm install && cp .env.example .env.local && npm run dev` → http://localhost:3000
>

**QuickSites** is a site generator and commerce platform for local businesses. A schema-driven
drag-and-drop builder produces sites published to subdomains or programmatically-provisioned custom
domains; a multi-tenant commerce layer on top takes a per-order platform fee. Next.js App Router,
Supabase, Stripe.

Source is public. It is a working commercial product rather than a general-purpose template — the
docs above describe the real system; this file is the short orientation.

---

## 📁 Project Structure

```
app/                  # Next App Router — pages + the entire backend (app/api/**/route.ts)
  admin/              #   the builder / admin UI
  sites/  host/       #   public rendered tenant sites (by slug, and by custom domain)
  api/                #   ~500 route handlers; most business logic still lives inline here
components/           # React components (admin/, sites/, ui/, cart/, ...)
lib/                  # data access, integrations, business logic
  commerce/ payments/ #   the money path
  supabase/           #   client factories (server / admin / browser / middleware)
  probe/              #   production content probe (asserts content, not status codes)
supabase/migrations/  # the canonical schema — authoritative over any prose doc
scripts/              # CLI + SQL tooling
middleware.ts         # host → org/site routing, brand-host rewrites
docs/                 # architecture, runbooks, and per-subsystem plans
```

> Counts drift, so they are not frozen here. Current numbers:
> `git ls-files 'app/api/**/route.ts' | wc -l` · `git ls-files 'components/**/*.tsx' | wc -l`
>
> ⚠️ There is **no `pages/` directory**. This README described one until 2026-08-18, which is worth
> knowing if you are reading an older copy — routing is entirely App Router. See
> [`ROUTER_STRATEGY.md`](ROUTER_STRATEGY.md).

---

## 🧪 Tests and quality gates

```bash
npm run typecheck      # tsc --noEmit — kept green
npm run lint           # eslint
npx jest               # unit tests (Jest)
npm run test           # end-to-end (Playwright)
npm run build          # next build — the real gate before shipping infra changes
```

⚠️ `npm run test` runs **Playwright only**. Jest is a separate command — running one is not running
both, which is easy to assume from the name.

### Pre-commit

The hook runs **gitleaks** against staged changes and aborts on a suspected secret. Install with
`npm run prepare`. A link-usage linter also exists (`npm run lint:links`) but is not wired into the
hook.

---

## ⚙️ Environment

Copy `.env.example` → `.env.local`. The minimum to boot is a Supabase URL, a public key, and a
**server** key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...        # or SUPABASE_SERVICE_ROLE_KEY (legacy, still honored)
```

Commerce additionally needs `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`; AI features need
`OPENAI_API_KEY`. `.env.example` documents the rest, grouped.

---

## 🗺 Nightly sitemap snapshots

`.github/workflows/snapshot-sitemaps.yml` snapshots sitemaps nightly into `snapshots/` and uploads
them to Supabase Storage, so changes to published domains and pages are diffable over time.

> Earlier revisions of this README documented these as three separate sections of public links, each
> telling the reader to "replace YOUR_PROJECT" — a placeholder that appeared nowhere and resolved to
> nothing. The mechanism is real; the instructions were not.

---

## 🔗 Resources

- [Report a bug or request a feature](https://github.com/Silver-Lamp/quicksites-v2/issues) — Issues are enabled; Discussions are not
- [Plans and architecture](docs/) — the working planning docs. There is no public roadmap board
- **A real site built with this:** [renton-lemonade.quicksites.ai](https://renton-lemonade.quicksites.ai) · more on the [homepage showcase](https://www.quicksites.ai)

---

## ✅ CI Status

<!--
  Both previous badges 404'd twice over: wrong repo (`quicksites-core`) AND wrong workflow files.
  There is no `test.yml` or `visual.yml` — the suite runs in `ci.yml`, and visual.yml lives in
  .github/workflows/disabled/. A badge pointing at a workflow that does not exist renders as an
  error image, which reads to a visitor as "the build is broken" rather than "the badge is wrong".
-->
![CI](https://github.com/Silver-Lamp/quicksites-v2/actions/workflows/ci.yml/badge.svg)

---

## 🚀 Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/Silver-Lamp/quicksites-v2)

> ⚠️ One-click deploy will build but **will not boot** without Supabase credentials
> (`NEXT_PUBLIC_SUPABASE_URL`, the anon key, and `SUPABASE_SERVICE_ROLE_KEY`). See
> [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md). Saying so here because a deploy button that yields a
> broken app is a worse first impression than no button.
