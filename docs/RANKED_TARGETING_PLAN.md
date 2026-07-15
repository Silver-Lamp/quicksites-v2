# Ranked Targeting Plan — fold GSC rank into "next step targeting"

> Make the prospects funnel (`/admin/growth?tab=prospects`) prioritize the geo sites we've
> **already ranked** in Google Search Console — but gate outreach behind a per-site
> "refine before postcard" checkpoint, because none of the ranked pages have clients yet.
>
> Status: **Phase 1 + 2 shipped** (2026-07-12). Decisions locked: auto-blockers **+** manual
> sign-off; a new top section on the prospects page.
> - **Phase 1 (done):** `lib/prospects/rankedOpportunities.ts` (+ tests) + the "Ranked & ready"
>   worklist in `prospects-client.tsx`, built on the already-fetched `gscByDomain` map.
> - **Phase 2 (done):** migration `20260717_geo_campaign_outreach_readiness` **APPLIED**;
>   `lib/outreach/readiness.ts` (+ tests) persisted via `computeCampaignRecommendations`;
>   `POST /api/admin/prospects/geo-campaign/mark-refined`; server-side gate in the
>   `mail-postcards` + `text-prospects` routes, **flag-gated OFF** via
>   `OUTREACH_READINESS_GATE_ENABLED` (`lib/flags/outreachReadinessGate.ts`). Set that env
>   var to `1` to make the gate hard-block sends; until then the readiness UI is advisory.
> - **Phase 3 (done):** `scoreTerritories` gained an optional `rankByCampaign` (campaignId →
>   rank quality) input + `rankBoostWeight` (default +35%). A cell containing a prospect tied to
>   a ranking campaign gets `rationale.rankedHere = true` + a boosted score; the map draws those
>   cells with an emerald dashed ring, the legend + "best cell" summary flag them. `prospects.geo_campaign_id`
>   is the join. Back-compat: no rank input → behaviour unchanged. (The server narration route
>   `territory-score` still scores base-only — its discovered-prospect scope doesn't include
>   campaign-linked rows, so boosting it there is a no-op; left as-is.)
> - **Growth Coach (done, 2026-07-12):** an expandable next-best-action panel at the top of the
>   prospects page (`components/admin/growth-coach.tsx`, pure brain `lib/prospects/growthCoach.ts`)
>   — the funnel as a step checklist, each step running a real endpoint. Its address step
>   **auto-points org-branded sites at the org's service area** (`organizations.branding.address`
>   set on `/admin/org` → seeded into the pitch-site contact as "Serving City, ST" only when the
>   site has no address of its own, via `lib/outreach/{orgServiceArea,seedServiceAreaContact,pointCampaignAddress}.ts`
>   + `POST …/geo-campaign/point-address`, committed through the `commit_template` RPC; also fires
>   on the Brand/set-org action). Service-area framing (not a shared street NAP) is deliberate —
>   one address across many verticals is a local-spam footprint.
> - **Phase 4 (page-level GSC)** remains to do (only needed once sites go multi-page).

---

## 1. Problem

Rank data already lands on this page but doesn't drive anything:

- The **campaigns table** shows a per-campaign "Ranking" badge from `/api/gsc/summary`
  (`gscByDomain[normalizeGscDomain(c.domain)]` → `rankBadge`). It's read-only trivia.
- **"Where to target next"** (`scoreTerritories`, `lib/prospects/territoryScore.ts`) ranks
  cells purely by *unlockable rent* (no-website clusters × industry tier − saturation). It is
  **blind to whether we already rank there.**
- **Per-campaign "next steps"** (`geo-rank-sync` cron → `computeCampaignRecommendations`) *do*
  know rank, but they're buried in a per-row expander.
- **No readiness gate exists.** `Mail`/`Text` fire on any campaign regardless of whether the
  pitch site is still placeholder-quality.

Net: a page we rank #6 for — a warm, revenue-closest asset — is visually equal to a cell we've
never touched, and nothing stops us mailing an unrefined site.

Because each geo-campaign pitch site is a **one-page site whose apex == the page**
(`boston-towing.com` → slug `boston-towing`), **domain-level GSC rank ≈ page-level rank today**.
So Phase 1 needs *no new GSC plumbing* — it reuses the `gscByDomain` map the client already fetches.

---

## 2. Signals & sources (all already in the codebase)

| Signal | Source | Notes |
|---|---|---|
| Domain rank (pos/impr/clicks, 28d) | `GET /api/gsc/summary` → `gscByDomain` | Already fetched in `prospects-client.tsx`. Keyed by `normalizeGscDomain(domain)`. |
| Rank status bucket | `deriveRankStatus(pos, impr)` (`lib/outreach/geoPricing.ts`) | `page1` (pos 1–10) · `ranking` (pos>0 or impr>0) · `unranked`. |
| Unlockable rent | `priceTier(industryKey)` (`lib/outreach/geoPricing.ts`) | Industry → monthly rent tier in cents. |
| Competing businesses per (city×industry) | `buildCompetitionGroups()` (in `prospects-client.tsx`) | Extract to lib for reuse. |
| On-page quality | `analyzeOnPage(template.data)` (`lib/outreach/onPage.ts`) | pageCount, schema, NAP, click-to-call, hours, title len. |
| Rank trend | `geo_rank_history` + `computeRankTrend` | Optional tiebreaker. |

---

## 3. The opportunity score (pure, testable)

```
opportunityScore = rankQuality × unlockableRentCents
```

- **rankQuality** — `page1: 1.0 · ranking(pos 11–20): 0.6 · ranking(impr only): 0.35 · unranked: 0.1`.
  (Unranked isn't zero — a fresh geo-domain with no clients is still worth working; rank just
  *reprioritizes* the queue toward proven ground.)
- **unlockableRentCents** — `priceTier(industry).monthlyCents × min(competingBusinesses, cap)`
  (the same "$/mo unlockable" already surfaced by the territory heat).

**Readiness does NOT reduce the score** — a ranked-but-unrefined site is still high opportunity;
readiness only changes the *next action* (Refine vs Mail) and the hard gate. This keeps the hottest
assets at the top of the list precisely so you refine them first.

Sort the worklist by `opportunityScore` desc; break ties by rank trend, then newest.

---

## 4. New UI — "Ranked & Ready" top section

A prioritized worklist above the map / competition cards. One row per geo-campaign, fusing
rank + rent + readiness into a single "do this next":

```
RANKED & READY — work the warmest assets first
┌──────────────────────────────────────────────────────────────────────────────┐
│ ● boston-towing.com     Page 1 · #6   ▲2   $299/mo · 5 competitors            │
│   Refine this site — 3 blockers: placeholder hero · no logo · no phone   [Refine →] │
├──────────────────────────────────────────────────────────────────────────────┤
│ ● quincy-plumbing.com   Page 2 · #14        $199/mo · 4 competitors           │
│   Ready ✓ — reviewed 2d ago                                    [Mail 4 →] [Text] │
├──────────────────────────────────────────────────────────────────────────────┤
│ ● malden-dental.com     Indexed             $349/mo · 3 competitors           │
│   Refine this site — 2 blockers: unconfirmed prices · default theme     [Refine →] │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Row shows: rank badge (reuse `rankBadge`), trend arrow, `$/mo · N competitors`, readiness line.
- Action flips: **Refine →** (links to `/admin/templates/[id]`) when not ready; **Mail / Text**
  (the existing handlers) only when ready. Mail/Text render **disabled with a tooltip** otherwise.
- Empty state when no campaign has GSC data yet: a hint to connect the domains in GSC.

---

## 5. Readiness gate — refine before postcard

**Decision: auto-blockers AND manual sign-off — both must pass before Mail/Text unlock.**

### 5a. Schema (new migration `<ts>_geo_campaign_outreach_readiness.sql`)

Add to `public.geo_industry_campaigns` (idempotent `add column if not exists`):

- `outreach_ready_at timestamptz` — set when an operator signs off.
- `outreach_reviewed_by uuid` — who signed off.
- `outreach_blockers jsonb` — last auto-computed blocker list (cached for the gate + UI).

### 5b. Auto-blockers — `lib/outreach/readiness.ts` (NEW, pure)

`analyzeReadiness(templateData, industryKey, campaign) → { blockers: Blocker[], hardBlocked: boolean }`,
built on the existing `analyzeOnPage()` + template `data` inspection. Each blocker:
`{ id, severity: 'hard' | 'soft', label }`.

| Blocker | Severity | Derived from |
|---|---|---|
| Missing phone / NAP | hard | `!onPage.hasNap` / `!onPage.hasClickToCall` |
| Placeholder / default hero copy | hard | hero text empty or matches `industryScaffold` defaults |
| Unconfirmed prices (food verticals) | hard | no published `catalog_items` / menu not confirmed |
| No services / thin content | hard | services block empty |
| No logo / default branding | soft | `!meta.logo_url` |
| No LocalBusiness schema | soft | `!onPage.hasLocalBusinessSchema` |
| Single page (no city/service pages) | soft | `onPage.pageCount <= 1` |
| Weak `<title>` | soft | `onPage.titleLen` out of 15–60 |

`hardBlocked = blockers.some(b => b.severity === 'hard')`. Compute + persist to
`outreach_blockers` inside `computeCampaignRecommendations` (so the `geo-rank-sync` cron keeps it
fresh) and on demand from the "Recompute recommendations" button.

### 5c. Manual sign-off — `POST /api/admin/prospects/geo-campaign/mark-refined`

Admin-gated (`getAdminUser`). Body `{ campaignId, ready: boolean }` → sets/clears
`outreach_ready_at` + `outreach_reviewed_by`. Refuse to set `ready:true` while `hardBlocked` (return
the blockers so the UI can list what's left).

### 5d. The gate (server-authoritative + UI)

- **Server (load-bearing):** in `mail-postcards` (preview + send) and `text-prospects` routes,
  reject when `outreach_ready_at` is null → `{ error: 'Campaign not marked ready for outreach' }`.
  This matters because RLS doesn't protect these service-role routes (per CLAUDE.md §6).
- **UI:** disable Mail/Text with a tooltip ("Refine this site first — N blockers"); show a
  **"Mark refined"** button that enables once `hardBlocked` is false.

---

## 6. Territory heat — rank boost (Phase 3)

Thread a rank signal into `scoreTerritories`:

- New optional input `rankedCells?: Map<cellKey, rankQuality>` (or fold campaigns in).
- A cell containing a well-ranked page gets a **score multiplier** and `rationale.rankedHere = true`.
- Map (`components/admin/prospects-map.tsx`) + legend get an "Already ranking" badge, and the
  "Target next ✨" LLM brief (`territory-score` route) is told which cells we already rank so its
  narration says "double down where you already rank" instead of pure greenfield.

Keep `scoreTerritories` pure and back-compatible (rank input optional) so the existing test stays green.

---

## 7. Page-level GSC (Phase 4, only if sites go multi-page)

Today one-page sites make domain rank ≈ page rank. Once campaigns grow service/city **subpages**,
add `GET /api/admin/prospects/ranked-pages` pulling GSC `dimensions:['page']` (mirror
`performance/all`'s scoping + `gsc_cache`), map each URL → campaign by slug, and show per-URL rank
("your `/tow-truck` page ranks #4; the home doesn't"). Not needed for Phases 1–3.

---

## 8. Phasing & files

**Phase 1 — rank-aware worklist (no schema).** Ships value immediately on existing GSC data.
- NEW `lib/prospects/rankedOpportunities.ts` (pure): campaigns + `gscByDomain` + competition groups
  → sorted `RankedOpportunity[]`. Reuses `normalizeGscDomain`, `deriveRankStatus`, `priceTier`.
- NEW `lib/prospects/__tests__/rankedOpportunities.test.ts`.
- Extract `buildCompetitionGroups` out of `prospects-client.tsx` into the lib for reuse.
- EDIT `prospects-client.tsx`: render the "Ranked & Ready" section (data already fetched).

**Phase 2 — readiness gate.**
- NEW migration `<ts>_geo_campaign_outreach_readiness.sql`.
- NEW `lib/outreach/readiness.ts` (+ test).
- EDIT `lib/outreach/computeRecommendations.ts` (persist `outreach_blockers`).
- EDIT `lib/outreach/geoCampaigns.ts` (`GeoCampaign` type + select the 3 new columns).
- NEW `app/api/admin/prospects/geo-campaign/mark-refined/route.ts`.
- EDIT `mail-postcards` (preview + send) + `text-prospects` routes: server-side gate.
- EDIT `prospects-client.tsx`: "Mark refined" action + disable Mail/Text when not ready.

**Phase 3 — territory rank boost.**
- EDIT `lib/prospects/territoryScore.ts` (optional rank input + multiplier; keep pure/back-compat).
- EDIT `prospects-map.tsx` + legend + `territory-score` route narration.

**Phase 4 — page-level GSC (optional).**
- NEW `app/api/admin/prospects/ranked-pages/route.ts` + slug→campaign mapping.

---

## 9. Risks / open questions

- **GSC connection coverage.** Rank only exists for domains present in `gsc_tokens`. Campaign
  domains must be individually connected (the `geo-rank-sync` cron already assumes this). Worklist
  should clearly mark "not connected to GSC yet" vs "ranked" so a missing badge isn't read as "no rank."
- **Blocker false-positives.** `analyzeOnPage` is heuristic; the manual sign-off is the safety valve
  (operator can proceed once hard blockers clear). Tune the "placeholder hero" match against
  `industryScaffold` defaults to avoid nagging on legitimately-short copy.
- **Score weights** (rankQuality buckets, competitor cap) are guesses — expose as constants and tune
  after the first real batch.
- Keep every new lib function pure + tested (repo convention, CLAUDE.md §6/§9); keep `tsc --noEmit`
  green.

## 10. Readiness one-click fixes + per-site pipeline (shipped 2026-07-15, PRs #404, #406–#408)

The readiness checklist evolved from "explain how to fix" into "fix it in one click", then into "run every fix for a site". This is the substrate for a future cross-site sweep.

**One registry, two surfaces.** `lib/seo/readinessActions.ts` is the single source of truth: one entry per auto-fixable checklist item — `{ key, itemId, endpoint, label, icon, requiresGeoSite, appliesToIndustry, result→toast }`. Both consumers read it, so there are no drifting maps:
- `lib/outreach/readiness.ts#buildNextStep(item, industryKey)` → `readinessActionForItem(itemId, industryKey)?.key` attaches the action (and its industry gating) to a row's next step.
- `components/admin/templates/next-step-button.tsx` (list card + table) runs it: endpoint, label, icon, gating, and toast all come from the registry.

**Server execution is separate + pure-of-React.** `lib/seo/readinessRunners.ts` maps each action key → a server function, typed `Record<ReadinessActionKey, …>` so the mapping is **complete at compile time**. Keeping runners out of the (client-bundled) registry is deliberate. Runners:
- `fill_office_address` → `lib/parks/fillOfficeAddress.ts` — resolve a real industrial-park building (+ synthetic suite) from the parks registry and commit it. **Idempotent + pipeline-safe**: skips food industries and any site that already shows a NAP (never overwrites a real address). City is normalized of service-area framing ("Serving Cambridge, MA" → "Cambridge") by `lib/geo/cleanCityName.ts` — a polluted city was why the Places sweep returned empty; the picker also auto-discovers parks on the empty state.
- `fill_local_business_schema` → `lib/seo/fillLocalBusinessSchema.ts` — flip `meta.local_business_schema` on. The JSON-LD is built **live** from identity by `lib/seo/localBusinessSchema.ts` (industry → schema.org subtype) and **emitted on the published render** (`app/sites/[slug]/[[...rest]]/page.tsx`) — the item was previously a no-op with nothing emitting schema.
- `generate_city_page` → `getGeoCampaignByTemplateId` + `lib/seo/localPagesServer#addCityServicePage`.

**The pipeline.** `lib/seo/runReadinessPipeline.ts` runs every applicable action for one site in registry order — gated by geo/industry, each runner idempotent — and returns per-step status (`ran` / `satisfied` / `skipped` / `noop` / `error`, classified by the pure `lib/seo/pipelineClassify.ts`) + a before→after score, then re-persists the score. Endpoint `POST /api/admin/templates/run-readiness-pipeline` takes `{ templateId }` (one site) or `{ templateIds:[…] }` (small sequential batch, capped). The coach's **"▶ Run steps"** button opens a progress modal (`components/admin/templates/pipeline-progress-modal.tsx`).

**Shared commit.** All server-side template writes route through `lib/templates/commitTemplatePatch.ts` (the sanctioned `commit_template_http` / `app.commit_template` RPC — direct UPDATEs are trigger-blocked, CLAUDE.md §8), replacing the copy-pasted payload in each route.

**Extending it.** A new one-click fix = one registry entry (declares gating + toast) + one `{templateId}` runner function. A cross-site sweep = loop the single-site endpoint per site (each isolated + retryable), or a Workflow fan-out.

