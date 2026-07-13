# Domain Acquisition Planner — Handoff

> Operating + next-steps handoff for the buy-list planner shipped 2026-07-13 (PRs #363–#372).
> Design/rationale: [`DOMAIN_ACQUISITION_PLAN.md`](DOMAIN_ACQUISITION_PLAN.md). Rent model:
> [`GEO_DOMAIN_MONETIZATION.md`](GEO_DOMAIN_MONETIZATION.md). Where it lives in-app:
> `/admin/growth?tab=prospects` → **Domain buy-list planner**.

---

## 1. What's built (all merged, `tsc` green, unit-tested)

| Capability | Code | Flag / dep |
|---|---|---|
| Rank + budget-fill the buy-list | `lib/prospects/buyList.ts`, `POST /api/admin/prospects/buy-list` | (on) |
| Map-pack (competitor-review-weakness) scoring | `buyList.ts` (`weakPackFactor`) | needs review data (below) |
| Place Details backfill (populates review data) | `lib/outreach/placeSignals.ts`; on-sweep + `POST …/backfill-signals`; planner "Backfill" button | `PLACE_SIGNALS_BACKFILL_ENABLED` + `GOOGLE_PLACES_API_KEY` |
| Keyword search volume | `lib/prospects/keywordVolume.ts` | `KEYWORD_VOLUME_ENABLED` + `DATAFORSEO_*` |
| Owned-domain dedupe (exact / similar / alias) | `lib/prospects/ownedDomains.ts` | (on; localStorage) |
| City seeds (metro → cities) | `lib/prospects/citySeeds.ts` | (on) |
| One-click bulk buy + campaign mint | `POST /api/admin/prospects/buy-list/purchase` | `VERCEL_DOMAIN_REGISTER_ENABLED` + `DOMAIN_REGISTRANT_*` |
| Tracked call number on buy | purchase route (`provisionNumbers`) | `CALL_TRACKING_ENABLED` + `CALL_TRACKING_FALLBACK_NUMBER` + Twilio |
| GSC auto-connect on buy + retry | `lib/gsc/connectDomain.ts`; `POST …/gsc-connect`; planner "Retry GSC" | `GSC_AUTO_CONNECT_ENABLED` + GSC re-consent |

## 2. Environment matrix

Set locally in `.env.local`; in prod via **Vercel → Project → Settings → Environment Variables**
(Production + Preview), then redeploy. All documented in `.env.example`.

| Var | Purpose | Notes |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | Discovery sweep **and** map-pack review backfill | Places API (NEW) enabled in GCP |
| `PLACE_SIGNALS_BACKFILL_ENABLED` | Auto-backfill review data on a sweep | `1` to enable; paid Places SKU |
| `PLACE_SIGNALS_BACKFILL_LIMIT` | Max Place Details calls per sweep | default 60 |
| `KEYWORD_VOLUME_ENABLED` | Turn on keyword-volume enrichment | needs both DataForSEO creds |
| `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` | DataForSEO API creds | see §3 |
| `DATAFORSEO_LOCATION_CODE` | Volume location | optional, default `2840` (US) |
| `VERCEL_DOMAIN_REGISTER_ENABLED` | Allow real domain purchases | `1` to enable; **spends money** |
| `DOMAIN_REGISTRANT_*` | Registrant contact for purchases | FIRST/LAST/EMAIL/PHONE/ADDRESS/CITY/STATE/ZIP/COUNTRY; falls back to `NAMECHEAP_REGISTRANT_*` |
| `VERCEL_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` | Vercel registrar + DNS | write-scoped token; payment method on the account |
| `CALL_TRACKING_ENABLED` + `CALL_TRACKING_FALLBACK_NUMBER` + `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` | Tracked numbers on buy | recurring Twilio cost |
| `GSC_AUTO_CONNECT_ENABLED` | Auto-connect bought domains to Search Console | `1`; **requires GSC re-consent** (§4) |
| `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (or `GSC_*`) | GSC OAuth | scope is now read-write (§4) |

## 3. DataForSEO (the keyword-volume data service) — get + set

1. **Create an account** at <https://dataforseo.com> and add a prepaid balance (pay-as-you-go;
   the Google Ads search-volume endpoint we use is a fraction of a cent per keyword).
2. **Get the API credentials** in the dashboard under **API Access / API Dashboard** — you'll
   see an **API login** (your account email) and a separate **API password** (NOT your website
   login password). Auth is HTTP Basic; the code base64s `login:password` for you.
3. **Set the env vars:**
   - Local: add to `.env.local`
     ```
     KEYWORD_VOLUME_ENABLED=1
     DATAFORSEO_LOGIN=you@example.com
     DATAFORSEO_PASSWORD=your_api_password
     # DATAFORSEO_LOCATION_CODE=2840   # optional; US default
     ```
   - Production (Vercel): **Settings → Environment Variables** → add the three (Production +
     Preview) → **Redeploy**. Or CLI: `vercel env add DATAFORSEO_LOGIN` (repeat per var), then
     `vercel deploy --prod`.
4. **Verify:** in the planner, tick **"Add search volume"** and Plan. A **Vol/mo** column appears.
   If it stays off, the planner shows *"Search volume is off — set KEYWORD_VOLUME_ENABLED=1 +
   DATAFORSEO_LOGIN/PASSWORD"* (both the flag and creds are required).

Endpoint used: `POST https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live`
(one batched call per plan; `lib/prospects/keywordVolume.ts` — never throws, returns `{}` on any
failure so scoring degrades cleanly).

## 4. GSC auto-connect — the one-time prerequisite

The OAuth scope was upgraded from `webmasters.readonly` to **`webmasters` (read-write) +
`siteverification`** so the app can add properties. **Existing GSC connections must re-consent
once**: go to the GSC connect entry point and reconnect (it forces the consent screen). Until
then reads work but `connectGsc` returns `no_gsc_token` / insufficient-scope.

Live-only caveats (can't be validated headless): DNS TXT propagation is async, so a buy may
report **`pending`** — click **Retry GSC** in the planner (or `POST /api/admin/prospects/gsc-connect
{domain, retry:true}`) once propagated. Requires the domain's nameservers on Vercel (true for
domains bought via the planner).

## 5. First live-test checklist

1. Reconnect GSC once (§4).
2. Planner → **Backfill map-pack data** (warms review data for already-swept cities).
3. **Plan buy-list** (premium industries + budget) → paste owned domains → uncheck matches.
4. Select **1–2** rows → **Preview buy (dry run)** → confirm domains/prices.
5. Check **"+ connect GSC"** (± "+ call tracking") → **Buy + mint campaigns**.
6. Confirm: domain registered, pitch site serves, result shows `connected` (or `pending` →
   **Retry GSC**).
7. Once the single round is clean, scale to the full budget by selecting more rows.

---

## 6. Next items (prioritized)

### P0 — validate the money path (no code; user-run)
- [ ] **Geo-engine live smoke test** end-to-end (the urgent moat-board item): one real buy →
  campaign → (optional) rent checkout. This is the true unblock for spending the full budget.
- [ ] **First GSC connect** live (§4/§5) — confirm verify + `sites.add` + rank appears in
  `/api/gsc/summary`.

### P1 — close the known gaps surfaced this session
- [ ] **`geo-rank-sync` reads bare-domain `siteUrl`** (`app/api/cron/geo-rank-sync/route.ts`
  `gscPosition`), which isn't a valid GSC property id for `sc-domain:` properties → per-campaign
  rank sync silently returns null. The reliable reader is `/api/gsc/summary` (keys by
  `normalizeGscDomain`), which the buy-list worklist already uses. Fix: resolve the campaign's
  property (`sc-domain:<domain>`) for both the token lookup and `searchanalytics.siteUrl`.
- [ ] **Cron to auto-retry `pending` GSC verifications** so operators don't have to click Retry.
  Reuse `verifyPendingGscDomain`; track pending domains (a column or a query over campaigns whose
  domain has a `gsc_tokens` row but no rank yet).
- [ ] **Backfill cost visibility**: surface Place Details / DataForSEO call counts + est. spend in
  the planner (today only counts of updated/deferred are shown).

### P2 — quality / coverage improvements
- [ ] **City-local tracking numbers**: `provisionTrackingNumber` currently uses the fallback
  number's area code; a `city → area code` map would give a local caller-ID per geo-site.
- [ ] **Page-level GSC** (RANKED_TARGETING_PLAN Phase 4): only needed once pitch sites go
  multi-page (service/city subpages).
- [ ] **Score weights are guesses** (`reviewWeight` 0.4, `reviewMidpoint` 25, `volumeWeight` 0.3,
  `saturationWeight` 0.5, demand cap 10) — tune against the first real batch's outcomes.
- [ ] **Owned-domain aliases**: `SERVICE_ALIASES` in `lib/prospects/ownedDomains.ts` covers the
  premium/mid trades; extend if you own domains in other verticals or with unusual abbreviations.
- [ ] **More metro seeds**: `METRO_CITY_SEEDS` has Seattle/Renton + Boston; add target metros.

### P3 — larger bets (separate scoping)
- [ ] **Pay-per-lead billing** on ranked geo-domains (vs flat rent) — needs call attribution.
- [ ] **Exclusivity auction / runner-up waitlist** monetization (GEO_DOMAIN_MONETIZATION §5).

---

*Tracked in `admin_tasks`: `category='domain-acquisition'` (all done) + `source='moat-review-2026-07-13'`
(the broader moat punch-list). PRs #363–#372.*
