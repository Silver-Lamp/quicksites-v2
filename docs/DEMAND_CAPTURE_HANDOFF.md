# Demand Capture — Session Handoff (2026-07-15)

> A pick-up-where-we-left-off summary of the no-website / demand-capture funnel built this
> session. Deeper detail lives in [`RESTAURANT_VERTICAL.md`](RESTAURANT_VERTICAL.md) §7c and
> the go-live steps in [`DELIVERED_MENU_GO_LIVE.md`](DELIVERED_MENU_GO_LIVE.md). This doc is
> the orientation + the next task.

## The idea

For restaurants with **no website**, we auto-build an ordering site on `delivered.menu`, let
diners try to order (capturing **demand**, never money), and use "N people tried to order" as
the pitch to get the owner to claim + onboard. Deliberately **not** the fake-review / silent-
order-taking version (platform-policy + phantom-listing law); demand is a *signal*, not an order.

Funnel: **import → draft on delivered.menu → diners find it (search/QR) → demand logged →
pitch owner → claim → `/welcome` payoff → onboard @ 8%+60¢ → orders + fees.**

## What shipped (all merged to `main`)

| PR | What | Key files |
|---|---|---|
| #411 | Demand capture + leads/PostHog + pricing | `lib/menu/demand.ts`, `app/api/menu/demand/[templateId]`, `components/sites/demand-capture.tsx`, `lib/commerce/pricingPolicy.ts` |
| #412 | Lead visibility + `/welcome` payoff + mobile fix | `components/admin/demand-leads-cell.tsx`, `app/welcome/[id]/page.tsx` |
| #413 | Full-funnel green-path proof | `app/api/admin/commerce/demand-demo/route.ts` |
| #414 | Traffic lever — indexable drafts + diner order QR | `lib/flags/menuDemand.ts` (`MENU_DRAFT_INDEXABLE`), `app/api/admin/outreach/[id]/order-qrcode` |
| #415 | Demand funnel cockpit dashboard | `app/admin/demand-funnel`, `lib/menu/demandFunnel.ts` |
| #416 | Go-live runbook + live readiness page | `docs/DELIVERED_MENU_GO_LIVE.md`, `app/admin/go-live`, `lib/menu/goLiveChecklist.ts` |

## How it fits together

- **Tables:** `demand_events` (migrations `20260722` + `20260723`, applied). Deny-default RLS.
- **Capture:** `POST /api/menu/demand/[templateId]` (flag-gated, rate-limited) → `recordDemandEvent`. The `demand-capture.tsx` client (tap-to-call beacon + honest order-ahead modal) renders on an unclaimed `listing_import` draft on the menu host.
- **Escalation:** `MenuClaimBar` + the claim page show "🔥 N tried to order"; `/welcome/[id]` shows the owner the captured leads post-claim.
- **Pricing:** `lib/commerce/pricingPolicy.ts` — menu-ordering sites (has a `menu` block) onboard @ **8% + 60¢**, else the general 5%. Seeded at `/api/connect/onboard`.
- **Traffic:** `MENU_DRAFT_INDEXABLE` (index no-website drafts) + diner order QRs (importer `<slug>-order.png` + `/admin/outreach` per-draft download).
- **Cockpit:** `/admin/demand-funnel` (the funnel) + `/admin/go-live` (readiness) + `/admin/outreach` (the drafts).

## Flags (all OFF by default; prod state in Vercel)

| Flag | Purpose | Go-live |
|---|---|---|
| `MENU_DEMAND_CAPTURE_ENABLED` | Phase 1 capture | ON (set) |
| `MENU_DRAFT_INDEXABLE` | index no-website drafts | flip ON after DNS |
| `MENU_DEMAND_CAPTURE_SMS` | Phase-2 auto-SMS to owner | **stay OFF** until validated with real people |
| `CLAIM_VERIFICATION_ENABLED` | OTP before claim transfer | OFF (needs Twilio) |

## Verify admin-gated / service-role logic headlessly (technique)

Admin pages + service-role routes can't be driven by unauthenticated `curl`. To verify their
*logic* against the live DB, run the real libs via `tsx` (they resolve `@/` from tsconfig):

```bash
# Node 20 needs a WebSocket polyfill for supabase-realtime:
echo "try{const ws=require('ws');if(!globalThis.WebSocket)globalThis.WebSocket=ws.WebSocket||ws}catch{}" > /tmp/ws.cjs
NODE_PATH="$(pwd)/node_modules" NODE_OPTIONS="--require /tmp/ws.cjs" \
  node_modules/.bin/tsx --env-file=.env.local /path/to/harness.ts
```

- The harness must live **inside the repo** (or `NODE_PATH` won't resolve bare imports).
- Next-context libs (`createDraftOrder`/`markOrderPaid` use `getServerSupabase` → `cookies()`) can't run this way — assert their fee math with `computePlatformFeeCents` directly instead.
- Wrap in an async IIFE (no top-level await under tsx's cjs transform).
- For layout ("look at it"), build a standalone HTML with the real data + Playwright screenshot.

This is how #413/#415/#416's loaders were verified (all assertions green against the live DB).

## What's left

**Operational only (no code)** — work the amber items on `/admin/go-live` to green: point
`delivered.menu` DNS (`*.` wildcard) + `NEXT_PUBLIC_MENU_BASE_DOMAIN`, keys + sender profile in
Vercel, flip `MENU_DRAFT_INDEXABLE=1`, `npm run import:listings -- leads.json`, place diner QRs.

### Next session: the lead-list builder

Today, `npm run import:listings` consumes a **hand-built `leads.json`** (Google Places + Yelp
refs; see `scripts/import-listings-batch.ts` header for the shapes). The next build is a UI to
**assemble that list without hand-editing JSON**:

- **Reuse what exists:** `/admin/growth?tab=prospects` already discovers businesses by city via
  `POST /api/admin/prospects/discover` (Google Places) and can score territories. The builder
  likely extends this rather than starting fresh.
- **Core need:** filter discovered businesses to **"no website"** candidates (the whole premise),
  let the operator pick a cohort, and **export → `leads.json`** (or trigger the import directly).
- **Watch:** the **menu hit-rate** is the top-of-funnel bottleneck (~1 of 96 current drafts has a
  real menu). The builder should surface whether a candidate has menu photos (Yelp/Places) before
  import, so the cohort skews toward importable menus.
- **Open question for the session:** export-a-file vs. one-click "import these N now" (server-side
  run of the batch importer). The latter is nicer but the importer is a CLI script today — may
  need a route wrapper.

## Gotchas carried forward

- **Menu hit-rate** is the #1 bottleneck — surfaced on `/admin/demand-funnel` ("With a real menu").
- **CI red is noise:** GitHub Actions runs Node 18 → `EBADENGINE`. **Vercel's build is the real gate.**
- Drafts are **noindex until** `MENU_DRAFT_INDEXABLE=1` — no organic traffic before the flip.
- `.gitignore` has `*-qr/` (importer QR output) — that's why the route dir is `order-qrcode/`, not `order-qr/`.
- No customer money is held pre-claim; SMS + claim-OTP stay off until deliberately enabled.
