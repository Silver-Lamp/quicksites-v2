# 🛠 Contributing to QuickSites

Thanks for your interest in contributing! This project is modular, test-covered, and built with long-term maintainability in mind.

---

## 📦 Setup

```bash
git clone https://github.com/Silver-Lamp/quicksites-core.git
cd quicksites-core
npm install
cp .env.example .env.local  # configure Supabase keys
```

---

## 🧪 Run the App

```bash
npm run dev      # Starts the Next.js dev server
npm run lint     # Lints the codebase
npm run test     # Jest + Playwright tests
```

---

## ✅ Commit Conventions

This project uses Husky + custom linting rules to enforce:

- No `<Link><a>` misuse (via `npm run lint:links`)
- Prettier formatting
- Git pre-commit hook

Run all:

```bash
npm run lint:fix
```

---

## 🧩 Folder Notes

- `components/analytics/` — heatmaps, charts, tiles
- `pages/admin/` — dashboard, logs, profile
- `scripts/` — SQL patches, link check, automation
- `lib/supabase.ts` — shared db client
- `tests/` — Playwright + mocks

---

## 🧠 Want to Contribute?

- Check [Discussions](https://github.com/Silver-Lamp/quicksites-core/discussions)
- Submit a feature via [Issues](https://github.com/Silver-Lamp/quicksites-core/issues)
- Submit PRs to `main` with clear commit messages

Thanks for helping grow the ecosystem!
