# Apex Standards + Editor Coach — Handoff Plan

> Written 2026-07-16 as a session handoff. The ask (verbatim intent from Sandon):
> individual `<city>-restaurant.com` apex sites should NOT all look the same, but a
> **set of standards/recommendations** should be enforceable across them — "template
> versioning of sorts": header/footer invariants, SEO invariants, and **always display
> the current contest winner at the top with the others below**. Surface a **"Refresh"
> button on apex sites when they are "behind"** the current standards. Also surface an
> **AI coach at the top of the apex restaurant sites AND the other restaurant sites**
> (i.e., in the template editor).

## Context you need (all shipped 2026-07-16, PRs #435–#450)

- **Location Domains cockpit**: `/admin/restaurant-domains` (`app/admin/restaurant-domains/page.tsx`,
  data via `lib/outreach/restaurantDomains.ts#getRestaurantLocationDomains`). One card per
  apex ("area"): contest state, cohort rows, candidates, per-row decorators.
- **Apex template type**: `site_type='restaurant_apex'` in `data.meta`
  (`lib/outreach/restaurantApexSite.ts` — `apexTemplateSeed`, `buildRestaurantApexSite`,
  `isRestaurantApexData`). Seed = `[hero, restaurants_directory]` + Home-only chrome.
  Auto-created + PUBLISHED via the `publish_template_demo` RPC on competition create/convert.
- **`restaurants_directory` block** (PR #443): schema in `admin/lib/zod/blockSchema.ts`,
  renderer `components/admin/templates/render-blocks/restaurants-directory.tsx` — content
  carries `campaign_id` (live-hydrates cohort, **winner featured first**) + snapshot
  `entries`; the "powered by delivered.menu" unlinked footer note renders inside the block.
  Legacy apexes without the block get the directory appended by
  `app/sites/[slug]/[[...rest]]/page.tsx` (the `hasDirectoryBlock` check skips the append
  when the block exists).
- **The pattern to copy — restaurant draft "Refresh UX"** (PRs #447 + #450):
  - Pure, idempotent, **edit-respecting** transform: `lib/builder/restaurantUxRefresh.ts`
    (`applyRestaurantUxRefresh(data/header/footer) → {data, headerBlock, footerBlock, changed, applied[]}`).
    Each step fires ONLY when the draft still carries the old default it upgrades.
  - Server wrapper `refreshRestaurantUx` in `restaurantDomains.ts`: guards (restaurant
    industry, refuses `published`), commits via `lib/templates/commitTemplatePatch.ts`
    (direct template UPDATEs are trigger-blocked), re-persists readiness
    (`lib/seo/persistReadiness.ts`).
  - **Awareness**: the overview DRY-RUNS the transform per row server-side and ships
    `ux_pending: string[]` → the button renders `Refresh UX (N)` or a quiet `UX ✓`.
    Deep template data (`data, header_block, footer_block`) is fetched in ONE query only
    for rows that need it. See the `needDeep` block in `getRestaurantLocationDomains`.
- **Editor SEO coach** (existing): `components/admin/templates/readiness-coach.tsx`,
  mounted from `app/admin/templates/[[...slug]]/page.tsx`, props `{ industryKey, ... }`,
  reads template from editor context, has a "Run steps" pipeline
  (`lib/seo/runReadinessPipeline.ts`) + the readiness-actions registry
  (`lib/seo/readinessActions.ts`).

## Part A — Apex standards ("template versioning of sorts")

**New file `lib/outreach/apexStandards.ts`** (mirror `restaurantUxRefresh.ts` exactly in shape):

```ts
export const APEX_STANDARDS_VERSION = 1; // bump when standards change

export function applyApexStandards(input: {
  data: any; headerBlock?: any|null; footerBlock?: any|null; campaignId: string;
}): { data, headerBlock, footerBlock, changed, applied: string[] }
```

Steps (idempotent; every step only fixes a missing/stale invariant — NEVER touch hero
copy/theme/images, that's what keeps the sites individual):
1. `directory_block` — ensure a `restaurants_directory` block exists with
   `content.campaign_id = campaignId`; insert after the hero if missing (use
   `createDefaultBlock('restaurants_directory')`; keep `content_blocks` legacy array in
   sync like `restaurantUxRefresh` does). This IS the "winner at top, others below"
   guarantee — the block renders winner-first.
2. `directory_campaign_id` — block exists but campaign_id empty/wrong → set it.
3. `portal_chrome` — header/footer nav → Home-only when they still carry stale page
   links (`/services`, `/contact` — same `STALE_NAV_HREFS` heuristic).
4. `site_type_stamp` — `data.meta.site_type='restaurant_apex'` + `apex_campaign_id` if
   missing (covers converted pitch sites that predate the type).
5. `seo_meta` — `data.meta.title`/`description` set to the portal defaults ONLY when
   empty/null ("Order from restaurants in {City, ST}" / the diner description used in
   `app/sites/[slug]` metadata fallback).
6. `standards_version` — stamp `data.meta.apex_standards_version = APEX_STANDARDS_VERSION`
   whenever it differs (so bumping the const marks every apex "behind" and a refresh
   re-evaluates + restamps even when other steps no-op).

**Server wrapper in `restaurantDomains.ts`**: `refreshApexSite(campaignId, actorId)`:
- resolve the campaign (must be `kind='restaurant_competition'`) + the template at the
  apex slug (the overview already builds `apexTemplatesBySlug`).
- apply the transform; commit via `commitTemplatePatch` (patch `data` + chrome columns
  when changed).
- **CRITICAL — republish**: apex sites are PUBLISHED; a commit only writes the draft.
  After a changed commit, call the `publish_template_demo` RPC again (it snapshots the
  latest version + flips published_sites) or the live apex won't change. This is the one
  step the draft Refresh UX does NOT have.
- return `{ ok, changed, applied }`.

**Overview awareness**: in `getRestaurantLocationDomains`, the apex-template lookup
(`apexSlugs` query) should also fetch `data, header_block, footer_block` for apex
templates of restaurant_competition campaigns, dry-run `applyApexStandards`, and put
`apex_ux_pending: string[] | null` on the area (null when no apex template).

**API**: `POST /api/admin/restaurant-domains/refresh-apex` `{ campaignId }` — copy
`refresh-ux/route.ts` verbatim, admin-gated.

**UI (area card header, next to "Edit apex site →")**: `Refresh apex (N)` amber/fuchsia
button when `apex_ux_pending.length > 0` (tooltip lists steps); quiet `Apex ✓` when `[]`.
Reload after. Also fine to auto-run it as part of `convertToContest` result messaging.

**Tests** (mirror `restaurantUxRefresh.test.ts`): upgrade-set on a bare hero-only apex
(expect directory_block + version stamp), idempotency (second run no-op), edit-respect
(custom nav preserved; existing directory block with correct campaign_id untouched),
version-bump-only case (all else current, version differs → applied=['standards_version']).

## Part B — Editor coach for apex + restaurant sites

Goal: a coach banner **at the top of the editor** when the open template is a
restaurant draft or an apex portal. Deterministic v1 (the "AI" is the brain pattern, not
an LLM call — same philosophy as `lib/prospects/growthCoach.ts`).

- Mount point: `app/admin/templates/[[...slug]]/page.tsx` already mounts
  `ReadinessCoach` — add a sibling `RestaurantEditorCoach` (new
  `components/admin/templates/restaurant-editor-coach.tsx`) rendered when
  `isRestaurantApexData(template.data)` OR resolved industry === 'restaurant'.
- Apex variant shows: contest state (fetch `GET /api/public/restaurant-directory?campaign=`
  for cohort/winner — already public), standards status (add a tiny admin endpoint
  `GET /api/admin/restaurant-domains/apex-status?templateId=` returning the dry-run
  `applied[]` + version, or reuse refresh-apex with a `dryRun: true` body flag), and a
  one-click **Refresh apex** button.
- Restaurant-draft variant shows: `ux_pending` dry-run (add `dryRun: true` to
  `refresh-ux` route — trivial: run transform, skip commit), menu state (menu block
  sections empty → "Fill in the menu copy"), claim state, and the existing SEO
  readiness meter link.
- Keep it collapsed-by-default like `GrowthCoach` (one-line headline + expand).

## Gotchas / invariants (learned this session)

- **NEVER run prettier --write on `components/admin/prospects-client.tsx`** (huge churn).
- Direct `UPDATE templates` is trigger-blocked → `commitTemplatePatch` only.
- Published apex changes need the **republish** RPC call (see Part A).
- `tsc --noEmit` must stay green; CI is red on Node 18 (verify locally) — merge with
  `gh pr merge --squash --delete-branch --admin`.
- Header/footer live BOTH at `data.headerBlock/footerBlock` and the `header_block/
  footer_block` columns — patch both (see `refreshRestaurantUx`).
- The block registry recipe (5 compile-required files) is in the `adding-a-block-type`
  memory; `restaurants_directory` is already wired.
- Jest lacks `crypto.randomUUID` — polyfill in tests that touch `createDefaultBlock`
  (see `restaurantApexSite.test.ts` beforeAll).
- Pre-existing unrelated test failure: `domainOfficeAddress.test.ts` (Node-20 WebSocket
  at module load) — not yours.

## Definition of done

1. `applyApexStandards` + tests green; `refreshApexSite` commits AND republishes.
2. Location Domains area cards show `Refresh apex (N)` / `Apex ✓` from a server dry-run.
3. Bumping `APEX_STANDARDS_VERSION` lights up every apex's refresh button.
4. Editor shows the restaurant/apex coach banner with working refresh actions.
5. `npm run typecheck` green; ship via the usual squash-merge flow.
