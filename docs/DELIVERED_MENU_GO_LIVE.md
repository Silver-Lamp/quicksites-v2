# delivered.menu — Go-Live Runbook

> The step-by-step to launch the no-website restaurant / demand-capture funnel with real
> people. Everything is flag-gated OFF by default — this doc is the order to turn it on.
> Companion: [`RESTAURANT_VERTICAL.md`](RESTAURANT_VERTICAL.md) §7b (delivered.menu) + §7c (demand capture).

The funnel: **import a no-website restaurant → auto-built draft on `delivered.menu` → diners find it (search/QR) → they try to order (demand logged) → we pitch the owner "N tried to order" → they claim → onboard @ 8%+60¢ → orders + fees.** Watch it at [`/admin/demand-funnel`](../app/admin/demand-funnel/page.tsx).

> **This runbook is live in the admin UI** at [`/admin/go-live`](../app/admin/go-live/page.tsx) — it auto-detects the state of each env/flag/cohort check below, so a super-admin can see readiness at a glance. The steps here are the source of truth; the page is the live view.

---

## 0. Pre-flight (once)

- [ ] `npm run db:migrate:status` → **0 pending** (demand tables `20260722`/`20260723` applied).
- [ ] `npm run typecheck` green.
- [ ] Confirm anonymous sign-ins enabled in Supabase (guest build already relies on it).

## 1. Domain + DNS

- [ ] Point **`delivered.menu`** at the Vercel project: apex `@`, `www`, **and a `*.delivered.menu` wildcard** (both `<slug>.delivered.menu` and `delivered.menu/<slug>` must resolve).
- [ ] Add all three in Vercel → Project → Domains; wait for "Valid Configuration".
- [ ] Set `NEXT_PUBLIC_MENU_BASE_DOMAIN=delivered.menu` (Production + Preview). *Until this is set the whole menu surface + all links are inert.*

## 2. API keys (Vercel Production env)

- [ ] `GOOGLE_PLACES_API_KEY` — listing import + territory discovery.
- [ ] `YELP_API_KEY` — menu photos (raises the menu hit-rate; see §7 Watch).
- [ ] `OPENAI_API_KEY` — menu OCR from photos + copy.
- [ ] `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`, and `APP_BASE_URL` (or `QS_PUBLIC_URL`) for Connect onboarding return URLs — the post-claim money path.

## 3. Sender identity (required before ANY outreach)

- [ ] `/admin/growth?tab=prospects` → **sender profile** modal → set at least **name + email** (the claim page + postcards show "who built this / questions?"). The send flow warns if unset.

## 4. Flags — the go-live flips

| Flag | Set to | Why |
|---|---|---|
| `MENU_DEMAND_CAPTURE_ENABLED` | `1` | Phase 1 demand capture (already on). |
| `MENU_DRAFT_INDEXABLE` | `1` | Let no-website drafts be **indexed** so they rank for the restaurant's name and feed demand. Flip **after** DNS (step 1). |
| `NEXT_PUBLIC_GUEST_BUILD_ENABLED` | `1` | Guest build (already on in prod). |
| `MENU_DEMAND_CAPTURE_SMS` | **leave OFF** | Auto-SMS to restaurants — hold until Phase 1 proves out with real people (A2P 10DLC/TCPA). |
| `CLAIM_VERIFICATION_ENABLED` | leave OFF (unless Twilio ready) | Requires OTP to the listing phone before a claim transfers. |

Pricing defaults are fine (`QS_RESTAURANT_PLATFORM_FEE_PERCENT=0.08`, `QS_RESTAURANT_PLATFORM_FEE_MIN_CENTS=60`); set them explicitly only to change the rate.

## 5. Smoke-test the whole chain (no real Stripe)

- [ ] As an admin, `POST /api/admin/commerce/demand-demo` → expect `ok:true` (10 checks: draft → demand → claim → payoff → 8%+60¢ → $5 fee 60¢ / $30 fee 240¢).
- [ ] Tear down: `POST /api/admin/commerce/demand-demo {"cleanup":true}`.

## 6. Launch cohort #1

- [ ] Pick **one dense neighborhood, 10–30 no-website independents** — somewhere you can physically place QRs.
- [ ] Build `leads.json` (Google Places + Yelp listing refs; see `scripts/import-listings-batch.ts` header for the shapes).
- [ ] `npm run import:listings -- leads.json` → note the **menu hit-rate** tally. Writes `leads-results.json` + `leads-qr/<slug>.png` (owner **claim** QR) + `leads-qr/<slug>-order.png` (diner **order** QR).
- [ ] Verify: drafts render watermarked on `delivered.menu`; they appear in [`/admin/outreach`](../app/admin/outreach/page.tsx) and bump "Drafts built" on [`/admin/demand-funnel`](../app/admin/demand-funnel/page.tsx).

## 7. Feed demand (the fuel — a noindex draft has none)

- [ ] **Indexing** is live from step 4 (`MENU_DRAFT_INDEXABLE=1`) → drafts rank for "{name} {city}".
- [ ] **Diner order QRs**: print `<slug>-order.png` (or the per-draft "Order QR ⤓" on `/admin/outreach`) and **place them at the restaurants** — window sticker / table tent / receipt. This is the fastest real-demand source for cohort #1.

## 8. Watch → pitch → convert

- [ ] `/admin/demand-funnel` — demand lands, "hottest drafts" surface the ones to push. (PostHog: `menu_demand_captured`.)
- [ ] On a draft with demand: pitch the owner **manually** (call / postcard — SMS is off). The claim page already shows "🔥 N tried to order".
- [ ] Owner claims → lands on `/welcome/<id>` (sees the captured leads) → Stripe Connect onboard **@ 8% + 60¢** → first order → fee. Reconcile at `/admin/revenue`.

---

## Rollback / safety

- De-index instantly: `MENU_DRAFT_INDEXABLE=0` (redeploy). Stop capture: `MENU_DEMAND_CAPTURE_ENABLED=0`.
- No customer money is ever held pre-claim (demand is a *signal*, not an order). SMS + claim-OTP stay off until deliberately enabled.

## Watch / gotchas

- **Menu hit-rate is the top-of-funnel bottleneck.** In the current data only ~1 in ~96 drafts had a *real* menu — the funnel's "With a real menu" stage makes this visible. Supplying menu photos (or Yelp Premium access) raises it; a draft with no menu can't take orders.
- **CI red is noise:** GitHub Actions runs Node 18 → `EBADENGINE` fails the `test`/`build-and-test` jobs. **Vercel's build is the real gate** (correct Node).
- Drafts are **noindex until** `MENU_DRAFT_INDEXABLE=1` — don't expect organic traffic before the flip.
- Custom domains still work per-restaurant after claim (unchanged `domain` column).
