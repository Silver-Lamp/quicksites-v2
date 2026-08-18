# 🧠 QuickSites

> ⚠️ **New here? Start with [`CLAUDE.md`](CLAUDE.md)** — the central brain (what this is, where everything lives).
> 🚀 **Running it locally → [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)** (setup, env, commands, gotchas).
> Deeper docs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/COMMERCE_RUNBOOK.md`](docs/COMMERCE_RUNBOOK.md) · [`docs/MONETIZATION.md`](docs/MONETIZATION.md) · [`docs/LLM_METERING.md`](docs/LLM_METERING.md) · [`docs/REVIVAL_PLAN.md`](docs/REVIVAL_PLAN.md)
>
> **Quick start:** `nvm use && npm install && cp .env.example .env.local && npm run dev` → http://localhost:3000
>
> ⛔ **The rest of this README is stale** (it describes the old Pages Router; the app migrated to the App Router). It's kept for reference pending a rewrite — trust `CLAUDE.md` over anything below.

Modern template engine + affiliate funnel automation, now powered by clean architecture and developer-friendly tooling.

---

## 📁 Project Structure   

```
.
├── pages/
│   ├── _app.tsx
│   ├── index.tsx
│   └── admin/              # Admin-specific routes (dashboard, logs, etc.)
│       └── dashboard.tsx

├── components/
│   └── admin/              # Admin UI components (Sidebar, Layout, etc.)
│   └── ui/                 # Generic reusable UI components
│   └── analytics/          # Heatmaps, charts, widgets

├── lib/
│   ├── supabase.ts         # Supabase client
│   ├── domainTracker.js
│   ├── db.js
│   ├── sdk/                # API wrappers
│   └── admin/              # Dashboard logic and data hooks

├── scripts/                # CLI + SQL tools
│   ├── check-links.js      # Prevents bad <Link><a> usage
│   └── *.sql               # DB setup, patch scripts

├── tools/
│   └── cli/                # Code generation, import/export, publishing

├── public/
│   └── sites/              # Static exports of generated sites

├── tests/                 # Playwright, Jest
│   ├── visual-regression/
│   ├── mocks/
│   └── *.spec.ts

├── .husky/                 # Git hooks (lint:links in pre-commit)
├── .github/                # CI workflows
├── .gitignore              # Ignores /dist, /.next, etc.
├── tsconfig.json           # Alias support
├── next.config.mjs         # Path alias: @ = project root
└── README.md               # You are here
```

---

## 🧪 Testing

```bash
npm run test           # Runs unit tests and e2e
npm run test:e2e       # Runs Playwright tests
npx playwright test    # Local or CI
```

---

## 🧼 Code Quality

```bash
npm run lint           # Lints project
npm run lint:fix       # Auto-fix safe issues
npm run lint:links     # Custom script to detect <Link><a> misuse

npm run format         # Runs Prettier
```

### 🧱 Husky

Pre-commit hook runs `npm run lint:links`. To install manually:

```bash
npm run prepare
chmod +x .husky/pre-commit
```

---

## ⚙️ Env Setup

Copy `.env.example` → `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
```

---

## 🛠 Features

- ✅ Drag-n-drop block dashboard
- 📊 Analytics, heatmaps, filters
- 🧩 Template versioning
- 🧠 Per-user + role-based layouts
- 🗂 Admin view tools + CSV exports
- 🔁 Supabase-powered sync + restore
- 🔒 Git hooks prevent accidental misuse
- 🌱 Affiliate + referrer system built-in

---

## 🔗 Resources

<!--
  Every link in this section was dead as of 2026-08-18, and they were dead for two different
  reasons worth keeping straight:

  1. Three pointed at `Silver-Lamp/quicksites-core`, which is not this repo — this is
     `quicksites-v2`. (The npm package IS named quicksites-core; the GitHub path never was.)
  2. Two pointed at features that do not exist rather than at the wrong address: Discussions are
     DISABLED on this repo, and there is no /demo route. Repointing those at the right repo would
     have moved the 404 rather than fixed it, which is why each replacement below is a thing that
     was checked to exist.
-->
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

## 📦 Nightly Sitemap Snapshots

Your latest sitemap snapshots are generated automatically every night and uploaded to Supabase Storage for transparency, debugging, and SEO tooling.

🧭 Public Snapshot Links:
📄 sitemap-index-latest.xml

🌍 sitemap-hreflang-latest.xml
Replace YOUR_PROJECT with your actual Supabase project ref or custom domain.

## 🧾 Sitemap Diffs (Nightly)

Compare changes between yesterday’s and today’s sitemaps:

🔄 sitemap-index.diff

🌍 sitemap-hreflang.diff

These files update every night. Use them to track when new domains, languages, or pages are published.

Replace YOUR_PROJECT with your Supabase project ref or custom domain.

## 📘 Sitemap Diff Reports (Markdown)

Compare changes between yesterday and today in a human-friendly format:

🔄 sitemap-index.diff.md

🌍 sitemap-hreflang.diff.md

These files auto-update nightly via GitHub Actions.

Just replace YOUR_PROJECT with your actual Supabase project ID or custom domain.
