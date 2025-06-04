# 🧠 QuickSites

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

- [Feature Requests](https://github.com/Silver-Lamp/quicksites-core/discussions/categories/feature-requests)
- [Public Roadmap](https://github.com/Silver-Lamp/quicksites-core/projects)
- [Live Demo](https://quicksites.ai/demo)

---

## ✅ CI Status

![Visual QA](https://github.com/Silver-Lamp/quicksites-core/actions/workflows/visual.yml/badge.svg)
![Test](https://github.com/Silver-Lamp/quicksites-core/actions/workflows/test.yml/badge.svg)

---

## 🚀 Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/Silver-Lamp/quicksites-core)


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