# QuickSites Router Strategy

> ⚠️ **Corrected 2026-06-30.** The previous version of this file claimed QuickSites
> ran on the **Pages Router** — that is no longer true and was actively misleading.

## Current setup: App Router

QuickSites runs on the **Next.js App Router** (`app/` directory), Next 15.2.x. The
entire app — admin/builder UI, public rendered sites, and ~305 API routes
(`app/api/**/route.ts`) — lives under `app/`. There is a small legacy `pages/`
remnant, but routing, data, and the backend are App Router.

For the authoritative picture of how routing, tenancy, and the backend fit
together, see:

- [`CLAUDE.md`](CLAUDE.md) — the central orientation doc (what this is, where things live).
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — request lifecycle, middleware host→org routing, subsystems, and the standalone-backend north star.

## Direction

The forward plan is **not** a router change — it's incrementally extracting the
backend (the API routes) into standalone Supabase Edge Functions while the App
Router frontend stays in Next. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §6.
