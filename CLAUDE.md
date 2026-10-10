# QuickSites — Central Brain

> The single orientation doc for humans and AI agents working in this repo.
> If you read one file before touching code, read this one.
> Companion docs: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) (run it locally) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/COMMERCE_RUNBOOK.md`](docs/COMMERCE_RUNBOOK.md) · [`docs/MONETIZATION.md`](docs/MONETIZATION.md) · [`docs/PRICING_REDESIGN.md`](docs/PRICING_REDESIGN.md) · [`docs/LLM_METERING.md`](docs/LLM_METERING.md) · [`docs/POD_AUTHOR_PLAN.md`](docs/POD_AUTHOR_PLAN.md) · [`docs/SECRET_ROTATION_RUNBOOK.md`](docs/SECRET_ROTATION_RUNBOOK.md) · [`docs/REVIVAL_PLAN.md`](docs/REVIVAL_PLAN.md) · [`docs/MODEL_A_PLAN.md`](docs/MODEL_A_PLAN.md) · [`docs/COMPETITIVE_LANDSCAPE.md`](docs/COMPETITIVE_LANDSCAPE.md) · [`docs/WHITE_LABEL_PLAN.md`](docs/WHITE_LABEL_PLAN.md) · [`docs/CLAIM_VERIFICATION_PLAN.md`](docs/CLAIM_VERIFICATION_PLAN.md) · [`docs/INVENTORY_PLAN.md`](docs/INVENTORY_PLAN.md) · [`docs/CRM_PLAN.md`](docs/CRM_PLAN.md) · [`docs/RANKED_TARGETING_PLAN.md`](docs/RANKED_TARGETING_PLAN.md) · [`docs/GEO_RENTAL_RUNBOOK.md`](docs/GEO_RENTAL_RUNBOOK.md) · [`docs/BLOCKS_BACKLOG.md`](docs/BLOCKS_BACKLOG.md) · [`docs/CUSTOM_SITES.md`](docs/CUSTOM_SITES.md) · [`docs/AUDIENCE_SPLIT_PLAN.md`](docs/AUDIENCE_SPLIT_PLAN.md) · [`docs/CALL_CASCADE_PLAN.md`](docs/CALL_CASCADE_PLAN.md)

Last verified: 2026-07-15 · `tsc --noEmit` passes clean.

---

## 1. What QuickSites is

A **site generator + commerce platform for local businesses**. Two products share one codebase:

1. **Site Builder** — a schema-driven, drag-and-drop website builder. A *template* is edited in an admin UI, rendered to a public site, and published to a subdomain or programmatically-provisioned custom domain. AI assists with copy (hero, services, testimonials, FAQ).
2. **Open Commerce** — a multi-tenant commerce layer on top of the builder: merchants list catalog items (meals/products/services/digital), customers check out via Stripe, and the **platform takes a per-order fee**. A referral/affiliate system pays residual commissions to reps and partners.

The commercial thesis (see [`docs/MONETIZATION.md`](docs/MONETIZATION.md)): **near-free hosting, monetized by an e-commerce take-rate and/or white-labeling the builder+commerce to partners** who resell to their networks.

## 2. Stack at a glance

| Layer | Choice |
|---|---|
| Framework | **Next.js 15.2.9, App Router** (`app/`), React 18, TypeScript |
| Hosting | Vercel (single deploy today; cron via `vercel.json`) |
| Data / Auth | **Supabase** (Postgres + Auth + Storage), RLS on commerce tables |
| Payments | **Stripe** (+ Stripe Connect for merchant payouts), platform fees |
| AI | **OpenAI** (copy/image gen), **Qdrant** (vectors) |
| Comms | **Resend** (email), **Twilio** (SMS) |
| Domains | **Namecheap** API (register/DNS) + **Vercel** API (attach domains) |
| Observability | **Sentry** (errors). **PostHog** = product analytics (being added — see Revival Plan) |
| Tests | Playwright (e2e/visual), Jest (unit), Storybook |

Node **24.x**, npm **11.x** (see `.nvmrc` / `engines`). ⚠️ Vercel **discontinued Node 20 on 2026-10-01** and builds hard-fail, not warn — a deploy that errors in 12s with no app output is this. `@` path alias = repo root.

## 3. Run it locally

> Full setup, env, and gotchas: **[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)**. Quick version:

```bash
nvm use                       # Node 24
npm install
cp .env.example .env.local    # minimum to boot: Supabase URL + anon + service-role keys
npm run dev                   # http://localhost:3000
```
If `npm run build` fails on `canvas.node … NODE_MODULE_VERSION`, run `npm rebuild canvas`.

Health/quality gates:
```bash
npm run typecheck             # tsc --noEmit  (currently green)
npm run lint                  # eslint
npm run test                  # playwright e2e
npm run build                 # next build (heavier; run before shipping infra changes)
```

**Minimum env to boot:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Commerce additionally needs `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`. AI features need `OPENAI_API_KEY`. Full list in `.env.example` (60+ vars, grouped).

## 4. Repo map (where things live)

```
app/                 # Next App Router: pages + API routes (`git ls-files 'app/api/**/route.ts' | wc -l`)
  api/               # the entire backend lives here today (see ARCHITECTURE.md for the split plan)
  admin/             # the builder/admin UI (templates editor, dashboards)
  sites/             # public rendered sites (catch-all by slug/domain)
  merchant/ chef(s)/ meals/ cart/ checkout/ orders/   # commerce surfaces
  merchant/customers/ merchant/campaigns/             # customer CRM + email campaigns
  orgs/              # per-tenant (org) landing/routing
components/          # React components (admin/, sites/, ui/, cart/, ...)
lib/                 # data access, integrations, business logic
  supabase/          # client factories (server/admin/browser/middleware)
  commerce/ payments/ stripe/    # money path
  crm/               # customer identity + segments/campaigns/attribution/activity
  domains/ namecheap/            # domain provisioning
  ai/                # OpenAI wrappers + cost logging
  org/ request/ auth/ guards/    # tenancy, auth, request context
supabase/migrations/ # Open Commerce schema (the canonical money model)
scripts/             # CLI/SQL/one-off tools
types/               # shared types incl. generated types/supabase.ts
middleware.ts        # host → org/site routing, ref-cookie capture
admin/               # NOTE: a second top-level dir (legacy/parallel admin tooling)
```

> ⚠️ **Counts above are deliberately absent, and that is the fix rather than an omission.** They were
> frozen numbers — `~349` API routes, `280` modules, `~100` scripts — and on 2026-08-17 they read
> **494**, **574** and **196**. Nobody was ever wrong; each was true when written, and a number in a
> file never disagrees with itself, so nothing ever flagged them. The one count in this repo that was
> still exactly right (`KNOWN_UNDECLARED`'s baseline, then 109 keys; the live figure is pinned on `/testing`) is the one with a **test pinning it** —
> which is the whole lesson: a number survives if something re-derives it, not if someone remembers it.
> Write the command, not the count. (PorchHearth found six of seven such counts stale in their own
> orientation doc the same day; the failure is structural, not local.)

> ✅ **RESOLVED 2026-08-18. The README was rewritten and `ROUTER_STRATEGY.md` was never stale.**
> Both are now accurate; read them.
>
> ⚠️ **The falsifying condition here was itself the bug, and it is the most useful thing in this
> note.** It read *"`ROUTER_STRATEGY.md` stops mentioning the Pages Router"* — a string match. But
> that file was corrected on **2026-06-30** and its opening line says the Pages Router claim *"is no
> longer true and was actively misleading."* A corrected document trips a mentions-it check **by
> explaining its own correction**. So the audit on 2026-08-05 grepped, found "Pages Router", and
> recorded "still stale" — a true measurement supporting a false conclusion, for seven weeks, about
> a file that had already been fixed.
>
> The README genuinely WAS stale, and worse than advertised: its structure diagram showed
> `pages/_app.tsx` when no `pages/` directory exists at all, it documented `npm run test:e2e` (no
> such script), claimed `npm run test` runs "unit tests and e2e" (Playwright only), said pre-commit
> runs `lint:links` (it runs gitleaks), and carried three near-duplicate sitemap sections telling
> the reader to replace a `YOUR_PROJECT` placeholder that appeared nowhere. Four of nine links were
> dead (#848). A "this is stale" banner had stood in for fixing any of it.
>
> **Lesson for the next falsifying condition written in this file: prefer a condition whose
> evidence is the code, not the prose.** "No `pages/` directory exists" is checkable and cannot be
> tripped by a document discussing it. Guarded now by `lib/repo/__tests__/publicLinks.test.ts`,
> which strips comments before matching for exactly this reason.
>
> ⚠️ **`_pages-legacy/`, `_deprecated__domains/` and `_deprecating_sites/` no longer exist.** This
> line said they were "corpses pending cleanup" long after they were deleted — checked 2026-08-05,
> all three absent. Left here as the example, because a note describing debt that is already gone is
> the cheap end of the same failure as a note describing a CI break that was already fixed.

## 5. The two core flows (read these to understand 80% of the system)

**Build & publish a site**
1. `/admin/templates/[id]` loads a template; edits run through `components/admin/templates/template-editor.tsx` + `use-template-editor-state.ts`.
2. Blocks are defined/validated in `admin/lib/zod/blockSchema.ts` (master schema map) + `lib/blockRegistry.core.ts`; rendered via `lib/renderBlockRegistry.ts`.
3. Autosave → `app/api/templates/commit`. Publish → `app/api/templates/[id]/publish`.
4. Public render: `app/sites/[slug]/[[...rest]]/page.tsx` → `components/sites/site-renderer.tsx`.
5. Custom domains: `app/api/domains/*` → `lib/domains/{vercel,namecheap,dns}.ts`.

**Take an order (the money path)**
1. Storefront → `app/api/commerce/checkout` → `lib/commerce/orders.ts#createDraftOrder` (computes `platform_fee_cents`).
2. Stripe Checkout via `lib/commerce/adapters/stripeAdapter.ts` / `lib/payments/stripe.ts` (sets Connect `application_fee_amount` + `transfer_data`).
3. Webhook `app/api/commerce/webhooks/stripe` → `markOrderPaid()` → writes `payments` + a `commission_ledger` entry for any attributed referral, and (step "3b") upserts the buyer into `customers` + links `orders.customer_id` (CRM spine, best-effort).
4. Partner/affiliate payouts: `app/api/referrals/*` (manual today; automation is a known gap).

## 5b. Newer subsystems (added 2026-06 – 07)

- **Homepage showcase** ("Built with QuickSites"): an SSR'd row of curated published sites. `app/page.tsx` is now a **server component** that calls `getShowcaseData()` (`lib/home/getShowcaseData.ts`) and passes data into the client homepage (`components/home/home-client.tsx`) + `components/home/site-showcase.tsx` (localStorage cache; admin display-mode/hide/drag-reorder). Feed: `app/api/public/showcase`; generated thumbnails: `app/api/public/showcase/[slug]/thumb`. Curated list: `lib/home/featured-sites.ts`.
- **Builder first-run chooser**: `/admin/templates/new` shows industry / duplicate-template / blank (`components/admin/templates/start/start-your-site.tsx`). Industry scaffold seeds services + theme (`lib/builder/industryScaffold.ts`); industry themes (`lib/theme/industryPresets.ts`) are wired through the public render via `lib/theme/resolveSiteTheme.ts` + `TemplateThemeWrapper`. **`color_mode` defaults to `dark` everywhere**; the editor action toolbar has a light/dark toggle (persists to the template).
  ⚠️ **A just-created site opens on the CANVAS, not the Pages tray (2026-10-01).** The tray is a
  bottom drawer that defaults to **open** (`qs:toolbar:pageMgrOpen`, whose localStorage read falls
  back to `'1'`), so the first thing anyone saw after building a site was **their hero covered by a
  file list containing one item called "Home"** — on the guest flow, i.e. the main acquisition
  funnel. Found in a recorded walkthrough, not from a bug report. The creation redirect now carries
  a flag (`lib/editor/newTemplateUrl.ts`, `?created=1`, stripped on read) which
  `TemplateActionToolbar` consumes to start the tray closed. ⚠️ **Build the URL with
  `newTemplateEditorUrl()`** — there are SIX creation→editor navigations across four files (admin
  chooser ×2, guest hero ×2, start-your-site, duplicate), a seventh will be added, and a path that
  hand-rolls the URL fails silently (a drawer over a hero on one route); `newTemplateUrl.test.ts`
  greps every creation file and fails on an inline editor URL. ⚠️ **The auto-close must NOT be
  persisted** or creating one site turns the tray off on every other site that browser opens — and
  the obvious guard is wrong: `if (autoClosedRef.current)` alone is consumed by the effect's MOUNT
  pass (state is still `true` then), so the real `true→false` write clobbers the preference anyway.
  It must match the value: `if (autoClosedRef.current && pageMgrOpen === false)`. **The source
  guard asserting the flag existed passed the entire time this was broken** — it was caught by
  reading `localStorage` in a real browser after a real guest build. Separate mechanisms, not to be
  merged: the `?walkthrough=1` DB-backed tour and the `qs:editor:coachHintDismissed` tip banner.
- **AI demo generation**: "Generate demos" admin button → `app/api/admin/demos/generate` (admin+cron) → `lib/builder/generateDemoSite.ts` (metered OpenAI copy+hero → insert → publish via `public.publish_template_demo` RPC). Random, category-diversifying spec: `lib/builder/randomDemoSpec.ts`. Nightly top-up cron `app/api/cron/demo-refresh` (OFF unless `DEMO_AUTOGEN_ENABLED=true`). Generated sites are tagged `claim_source='demo_seed'` + `data.meta.is_demo`.
- **Templates admin**: card view (`components/admin/templates/templates-card-grid.tsx`) with a Cards/Table toggle + shimmer placeholders during generation; admins see **all** templates (the list API + secure-MV gating in `app/api/admin/templates/list`).
- **Agency billing + finished take-rate (Pricing Phase 2)**: per-user + per-site tiers in `lib/billing/*` (`plans`, `agency`, `entitlements`) + `app/api/billing/*`; refund fee-reversal (`lib/commerce/refunds.ts`), agency fee-exemption + margin-aware fee in `createDraftOrder`, reconciliation `app/api/admin/commerce/reconcile`. See [`docs/PRICING_REDESIGN.md`](docs/PRICING_REDESIGN.md).
- **Print-on-demand + Author sites**: Lulu (books) + Gelato (posters/apparel) under `lib/commerce/pod/*`; fulfillment fires from `markOrderPaid` (gated by `POD_ENABLED`), records `print_orders`, syncs via `app/api/cron/print-order-sync` + `app/api/commerce/webhooks/lulu`. Catalog authoring in `components/merchant/CreateItemDrawer.tsx` (spec on `catalog_items.metadata.pod_spec`); admin view `/admin/print-orders`; `author` is a first-class industry. See [`docs/POD_AUTHOR_PLAN.md`](docs/POD_AUTHOR_PLAN.md).
- **Restaurant vertical**: converting a restaurant URL yields a menu-forward ordering site, not a brochure. Three blocks (`menu`, `location`, `order_bar` — mobile-first, in the block registries + a dedicated `menu-editor.tsx`); the food scaffold (`industryScaffold.ts` `FOOD_INDUSTRIES`) builds `[hero, menu, location, hours, faq, contact, order_bar]`. Conversion crawls menu **subpages** (`scrapeMenuPages`) and extracts a structured menu + contact + hours (`inferSiteSpec.ts`, `parseMenu/parseContact/parseHours`). Ordering: the owner **confirms prices** in the editor → `POST /api/menu/publish-catalog` creates `catalog_items` (options→variants, add-ons→`metadata.addons`, category=section) → "Add to order" rides the existing cart/checkout. Money path stays server-authoritative in `authorizeCheckoutItems` (ids only from the client; validates + reprices variants **and** add-ons). Green-path proof: `POST /api/admin/commerce/menu-demo`. See [`docs/RESTAURANT_VERTICAL.md`](docs/RESTAURANT_VERTICAL.md).
- **CedarSites no-website outreach + `delivered.menu` (2026-07)**: a pipeline to auto-build ordering sites for restaurants that have **no website**, from their public listing. Import a Google Places + Yelp listing (`lib/rebuild/importListing.ts` + `importListingYelp.ts`), OCR the menu from listing photos (`lib/rebuild/menuFromPhotos.ts`, vision), assemble a draft (`assembleDraft.ts`) stamped `claim_source='listing_import'`; batch importer `scripts/import-listings-batch.ts` (`npm run import:listings`) with a menu hit-rate tally + ready-to-print QR codes; manage the funnel at `/admin/outreach`. **`delivered.menu` is the default deliverable URL** (`lib/menu/deliveredMenu.ts`, gated by `NEXT_PUBLIC_MENU_BASE_DOMAIN`): a restaurant is reachable at **both** `<slug>.delivered.menu` and `delivered.menu/<slug>` (`middleware.ts` rewrites both → `/sites/<slug>`), the apex `/` is a live-restaurant directory (`app/delivered/page.tsx`), and the **same URL spans the lifecycle** — an unclaimed draft renders watermarked + `noindex` (with a "Claim this site" bar, `components/sites/menu-claim-bar.tsx`), a published claimed site goes live + indexable (the `x-qsites-menu-host` branch in `app/sites/[slug]/[[...rest]]/page.tsx`). Custom domains still work. Claim = operator→prospect ownership transfer (`app/api/claim-draft`, `lib/auth/siteClaimToken.ts`, `claim_operator_draft` RPC, post-login `lib/auth/claimPendingSiteDraft.ts`). See [`docs/RESTAURANT_VERTICAL.md`](docs/RESTAURANT_VERTICAL.md) §7b.
- **Demand capture on unclaimed drafts — "prove demand before signup" (2026-07-15)**: on an unclaimed `listing_import` draft on the menu host, log **order intent** (never money, never held funds — avoids the DoorDash phantom-order problem) and use the count to escalate the claim pitch. Phase 1 (flag `MENU_DEMAND_CAPTURE_ENABLED`): `demand_events` table (migrations `20260722`+`20260723`, deny-default RLS), `lib/menu/demand.ts` (`recordDemandEvent` re-checks `claim_source==='listing_import'` server-side; `getDemandCount(s)`/`getDemandSummaries`), public rate-limited route `POST /api/menu/demand/[templateId]`, `components/sites/demand-capture.tsx` (tap-to-call `sendBeacon` + an honest "order ahead" lead modal that points the visitor at the working phone rather than faking an order), and `MenuClaimBar` escalates to "N people tried to order here — claim to collect" (+ an "Order intents" stat/🔥 column on `/admin/outreach`). Phase 2 (flag `MENU_DEMAND_CAPTURE_SMS`, threshold `MENU_DEMAND_NOTIFY_THRESHOLD`): `lib/menu/demandNotify.ts` texts the restaurant **once** on threshold cross (deduped on `notified_at`, server-derived phone, tokenized claim link, sender identity, opt-out; no customer PII). **Phase 2 held OFF in prod** until Phase 1 proves out with real users. See [`docs/RESTAURANT_VERTICAL.md`](docs/RESTAURANT_VERTICAL.md) §7c.
- **City menu search + honest measurement (2026-07-29)**: the `menu_finder` block searches every dish in a city cohort (`lib/menu/cityMenuIndex.ts`). **Prices we can't date aren't quoted as fact** — `lib/menu/menuFreshness.ts` renders "call to confirm" past 90 days and treats an **undated** menu as stale; the rule is **drop the price, never the dish** (a wrong price is a claim about a business that never asked us to make it). Zero-result searches are logged (`menu_search_events`, `20260811`, deny-default RLS, **no PII by construction** — the unit is a *search*, not a searcher). ⚠️ A bare zero-result was **four facts wearing one number**, now split and persisted as `zero_reason` (`20260813`) because each diagnoses a different system: `closed_now` (hours — latent after-hours demand, and probably the commonest, since people search when kitchens close), `relaxed_tags` (**our own UI** — never count it near the demand number), `naming` (**our own index**; `lib/menu/looseMatch.ts`, `pad thai` vs "Phad Thai" — the remedy is a synonym layer, not a recipe), and `none` — **the only real unmet demand**. Logged at search time, never derived later: the index changes as menus are added, so reclassifying an old query answers a different question than the visitor asked. A `cook_intent` probe on `none` measures whether a fix is even wanted before one is built — **it asks a question, it does not promise a feature** (a door that lies measures how many people believe the door). See §7d.
- **Businesses-near-me + ranked targeting (2026-07-12)**: the geo lead-gen fan-out lives at `/admin/growth?tab=prospects` (`components/admin/prospects-client.tsx`) — sweep a city (`/api/admin/prospects/discover`, Google Places), score which area to target next (`lib/prospects/territoryScore.ts` heat map), build claimable draft sites, and launch **exact-match geo-domain campaigns** (`geo_industry_campaigns`, e.g. `boston-towing.com`) pitched to the competing no-website businesses. On top of that, **GSC rank now drives the funnel**: a **"Ranked & ready" worklist** (`lib/prospects/rankedOpportunities.ts`) prioritizes campaigns by `rankQuality × unlockable rent × local demand`, reusing the already-fetched `/api/gsc/summary` map (one-page pitch sites → domain rank ≈ page rank); the territory heat gets a **rank boost** (`scoreTerritories`' optional `rankByCampaign` → `rationale.rankedHere`, emerald-ringed cells). A **refine-before-postcard gate** (`lib/outreach/readiness.ts` → hard/soft blockers persisted by `computeCampaignRecommendations`; `POST …/geo-campaign/mark-refined` manual sign-off; `outreach_ready_at`/`outreach_reviewed_by`/`outreach_blockers` on the campaign, migration `20260717`) can hard-block `mail-postcards` + `text-prospects` — **flag-gated OFF** via `OUTREACH_READINESS_GATE_ENABLED` (advisory until on; test sends exempt). The discover form remembers recent sweeps per operator (`lib/prospects/recentLocations.ts` + `recentLocationsStore.ts` in `site_settings`). An expandable **Growth Coach** (`components/admin/growth-coach.tsx`, brain `lib/prospects/growthCoach.ts`) pins next-best-action guidance at the top — the funnel as a step checklist where each step runs a real endpoint (discover/launch/refine/mark-refined/mail/point-address). One of its steps **auto-points org-branded sites at the org's service area**: an org address in `organizations.branding.address` (set on `/admin/org`) is seeded into a campaign's pitch-site contact — as a *service area* ("Serving Renton, WA"), only when the site has no address of its own ("auto until edited"), fired on the Brand action + on demand (`lib/outreach/{orgServiceArea,seedServiceAreaContact,pointCampaignAddress}.ts`, `POST …/geo-campaign/point-address`, committed via the `commit_template` RPC). See [`docs/RANKED_TARGETING_PLAN.md`](docs/RANKED_TARGETING_PLAN.md) + [`docs/GEO_DOMAIN_MONETIZATION.md`](docs/GEO_DOMAIN_MONETIZATION.md).
- **⚠️ GOOGLE CLOUD BILLING WAS OFF AND EVERY MAPS CALL HAD FAILED FOR ELEVEN DAYS (found
  2026-10-08).** Places (New) answers `403 PERMISSION_DENIED "The caller does not have
  permission"`; the legacy Places and Geocoding endpoints say it plainly: *"You must enable
  Billing on the Google Cloud Project"*. Last successful sweep: 2026-09-27. Three things hid it:
  (1) `searchNearby` maps a 403 to `not_configured`, so the operator saw a 501 that reads like a
  MISSING key while the key is set everywhere; (2) the nightly `trade-site-pipeline` reported
  `ok, built: 0` every morning because `trade_sweep_queue` was empty — **a dead Places and an
  empty queue look identical from the cron record**; (3) `/status` has no gate that can tell a
  key that is set from a key that works (the AI-dead-8-days lesson, again). Found only because a
  Vashon sweep was attempted. **Fix is an owner action in the Google Cloud console** (enable
  billing on the Maps project); re-check with one curl of the Geocoding API using the local key.
  Blocks: every `/admin/growth` sweep, the nightly trade pipeline's sweeps, `getLatLonForCityState`,
  venue sweeps for HJ, park discovery. **Resolved the same day with a new key in a billed
  project** (the old project's billing account was the dead one; a key is bound to its project).
  ⚠️ **Two more sweep traps found the same hour.** (1) `general_contractor` is in Google's type
  table but Nearby Search answers *"Unsupported types"* (400), and one rejected type used to
  throw out of `searchNearby` and fail the WHOLE sweep — every category — reading as the same
  501. Contractor is now a text query and an unsupported type is skipped with a warning
  (`searchNearby.test.ts`). (2) **An island cannot be swept with one circle.** Vashon is 21 km
  long and 6 km wide; a 10 km circle from town reached Burien, SeaTac, Gig Harbor and Olalla
  across the water, Nearby's 20-per-type cap filled with mainland results, and **410 of 450
  rows stamped `city='Vashon'` were not on the island**. Sweep several 3 km circles down the
  spine and **drop any hit whose address lacks the island's name** — Text Search treats the
  circle as a bias, never a fence (the HJ venue-sweep lesson, again). 480 mislabelled rows
  deleted; the island itself holds ~110 businesses, 27 without a website.
- **Readiness one-click fixes + per-site pipeline (2026-07-15)**: the SEO-readiness coach (`components/admin/templates/readiness-coach.tsx`) + the templates list can **auto-fix** a pitch site instead of deep-linking into the editor. One **readiness-actions registry** is the source of truth (`lib/seo/readinessActions.ts`) — one entry per auto-fixable checklist item = `{ key, itemId, endpoint, label, icon, gating, result→toast }`; both `lib/outreach/readiness.ts#buildNextStep` (which attaches the action to a row's next step) and the list `components/admin/templates/next-step-button.tsx` read it (the old scattered maps + the `nap` special-case are gone). Server execution is the parallel `lib/seo/readinessRunners.ts` (action key → function, **compile-time 1:1** via `Record<ReadinessActionKey,…>`) so callers run the logic directly, never self-HTTP. Actions: **fill office address** from the industrial-park registry (`lib/parks/fillOfficeAddress.ts` — skips food + any site that already shows a NAP; city cleaned of service-area framing "Serving Cambridge, MA" via `lib/geo/cleanCityName.ts`; auto-discovers parks via Places on the empty state), **add LocalBusiness schema** (`lib/seo/fillLocalBusinessSchema.ts` → `meta.local_business_schema`; JSON-LD is built live from identity and **emitted on the published render** in `app/sites/[slug]/[[...rest]]/page.tsx` via `lib/seo/localBusinessSchema.ts`), and **generate a `<service> in <city>` subpage**. The **pipeline** (`lib/seo/runReadinessPipeline.ts`, `POST /api/admin/templates/run-readiness-pipeline` — one site, or a small sequential batch) runs every applicable action in registry order (idempotent; reports per-step status + before→after score via the pure `lib/seo/pipelineClassify.ts`); the coach's **"▶ Run steps"** opens a progress modal (`components/admin/templates/pipeline-progress-modal.tsx`). All server template writes go through the shared `lib/templates/commitTemplatePatch.ts` (sanctioned `commit_template` RPC). Adding a new one-click fix = one registry entry + a `{templateId}` runner. PRs #404, #406–#408. See [`docs/RANKED_TARGETING_PLAN.md`](docs/RANKED_TARGETING_PLAN.md) §10.
- **Outreach sender identity (2026-07-15)**: cold postcards/texts/claim pages now carry *who's contacting you* + *what the prospect gets*. A DB-backed **sender profile** (`lib/outreach/senderProfile.ts`, `site_settings` key `outreach_sender_profile`, per-field env fallback) — name/title/email/headshot/signature + business city/state — is edited in a modal on `/admin/growth?tab=prospects` (`components/admin/sender-profile-modal.tsx`; headshot/signature **upload-or-pick** via the `media_assets` library, `components/admin/media/sender-image-field.tsx` + `POST /api/admin/media/sender-asset`), with a prominent alert before a send when name/email are unset. The competition postcard (`lib/outreach/competitionPoster.ts`) gained 3 vertical-aware **benefit bullets**, a **"local to me"** line (same-state or a haversine radius vs. the campaign), a **human sign-off** (headshot + signature + name/title), and a **"Questions? {email}"** line; the same identity signs the **SMS** (`lib/outreach/sms/outreachSms.ts`) and shows on the **claim landing page** (`components/sites/claim-site-hero.tsx`). Reseller/branded sends **suppress** the personal sign-off (use the org's name/support email). PR #403.
- **Claim verification (2026-07, flag-gated OFF)**: when `CLAIM_VERIFICATION_ENABLED=1`, claiming a `listing_import` draft requires proving control of the business **before ownership transfers** — an SMS OTP to the phone on the public listing (server-derived from the contact/order_bar block, never claimer-supplied) or an operator manual override. `lib/auth/claimVerify.ts` (hashed single-use codes + a signed, template-bound verify-grant cookie), `POST /api/claim/verify/{send,confirm}` (rate-limited), `/claim-site/<id>/verify`, first Twilio sender `lib/sms/sendSms.ts`, `claim_verifications` deny-default table, operator "Verify by phone" on `/admin/outreach`. Off by default (legacy token-only claim unchanged); activate with the migration applied + Twilio env. See [`docs/CLAIM_VERIFICATION_PLAN.md`](docs/CLAIM_VERIFICATION_PLAN.md).
- **Domain-claim email verification (2026-07-09, flag-gated OFF)**: the parallel **email** proof-of-control flow for the legacy `domains`-table claim (`POST /api/claim-site`), distinct from the SMS listing-draft flow above. Behind `DOMAIN_CLAIM_VERIFICATION_ENABLED`: `POST /api/claim/verify/email/{send,confirm}` email a hashed 6-digit OTP + set a domain-bound verify-grant cookie (reuses `lib/auth/claimVerify.ts` with the **domain id** as the HMAC subject — no lib changes); `claim-site` then completes the claim (writes `domains.claimed_email`/`claimed_at`, race-guarded, consumes the row) **only** with a valid grant + a verified `claim_verifications` row. Reusable drop-in UI `components/claim/domain-claim-verify.tsx` (email→code→complete; **not yet wired to a page** — the domains-claim flow has no live entry point). Migration `20260709_domain_claim_verification` (adds `domains.claimed_email/claimed_at` + generalizes `claim_verifications` with a nullable `domain_id`; **pending — run `db:migrate:up`**). Green-path e2e at `app/api/claim/verify/email/__tests__/domainClaimFlow.test.ts`. See [`docs/DOMAIN_CLAIM_VERIFICATION_PLAN.md`](docs/DOMAIN_CLAIM_VERIFICATION_PLAN.md).
- **Hub override (two-tier referral, 2026-07)**: a "hub" recruits *resellers* and earns a configurable, lifetime override on their orders, funded **out of QuickSites' 20% share** (`commission_ledger` subject `order_platform_fee_override`; `parent_code`/`override_share` on `referral_codes`, clamped by `clampOverrideShare`; auto-linked on partner join via the `?hub=<code>`→`qs_hub` cookie). `markOrderPaid` writes the second ledger row; `runPayouts` pays it; `/admin/revenue` net take subtracts it (`lib/commerce/revenue.ts`). Config: `POST /api/admin/referrals/set-hub`. Full mechanics in [`docs/MONETIZATION.md`](docs/MONETIZATION.md).
- **Hand-written outreach (2026-08)**: the no-website drafts are pitched **one at a time, by a person** —
  `docs/OUTREACH_METHOD.md` is the procedure and `docs/OUTREACH_FIVE.md` the pre-registered experiment
  (10 contacted, 15 touches in `outreach_touches`). ⚠️ **The machine says who you MAY write to; a person
  decides what to say** — `npm run outreach:candidates` qualifies a list (`lib/outreach/candidates.ts`) and
  must never generate copy, because "built from their own words" is the product and templating kills it.
  Two traps it exists to stop: **11 of 26 drafts carry an INVENTED menu under a real business's name**
  (#738 — never send one), and a bare `<slug>.delivered.menu` **does not linkify on a phone** (new gTLD),
  so messages use `https://deliveredmenu.com/<slug>`, guarded by a test over the prose.
- **Auto shops — the vertical the data picked (2026-08-13)**: sweeping 9 industries for *no website*
  found the cohort is defined by **how customers find you, not by trade**: roofing 3% / fencing 0–6% (they
  are found by search, so they all have sites) vs **auto repair 66%** in Paterson, 57–64% across urban NJ,
  17–29% suburban WA/FL — **204 independents over 6 cities**, and unusually clean (2 chains in 206).
  Machinery already exists and has NEVER run (`lib/outreach/autoShopCompetition.ts`, `<city>-auto-repair.com`,
  PRs #600–#603). ⚠️ **Two blockers before any send**, both in `docs/AUTO_SHOP_VERTICAL.md`: there is **no
  menu** — the load-bearing ingredient of the restaurant pitch does not exist for a mechanic — and the
  scaffold's FAQ **invents service promises** ("we respond within the hour", "free no-obligation quote")
  under a real shop's name, which is the invented-menu class with liability attached. `MIN_MENU_ITEMS`
  eligibility also disqualifies every auto shop.
- **Auto-built trade sites — the automated loop (2026-09-07, PRIORITY)**: the seventh vertical
  (`lib/business/verticals.ts` `trade_sites`) made to run without a person wherever honesty allows.
  Map + status per step: **[`docs/TRADE_SITES_PIPELINE.md`](docs/TRADE_SITES_PIPELINE.md)**. PR 1:
  **claim now publishes** (`lib/tradeSites/activate.ts` — before it, setting `owner_id` made the
  preview URL 404 for everyone but the owner while `/welcome` said "live"), the prospect is marked
  `claimed` (declared for months, never written — the claim rate is the decisive number), and the
  post-claim page sells the **custom-domain tier** self-serve (`POST /api/trade-sites/checkout`,
  flag `TRADE_SITE_BILLING_ENABLED`, price from `TRADE_SITE_DOMAIN_PRICE_CENTS` — **never write the
  number into copy**). Stripe events ride the **geo-rental webhook endpoint** (one endpoint, one
  secret; routed by `trade_site_template_id` metadata) into `trade_site_subscriptions` (migration
  `20260838`), and payment provisions the domain via the Vercel registrar when
  `VERCEL_DOMAIN_REGISTER_ENABLED=1`, else an `admin_tasks` row. ⚠️ Binding a custom domain is
  **three writes** — `set_template_custom_domain` RPC, re-publish, and the legacy `sites` row with a
  minted `snapshots` row — because `app/host` resolves a custom host **only** through `sites.domain`
  and serves `sites.published_snapshot_id`, which no publish path writes. `payment_count > 0` is the
  only proof of money; a status word is not. Still manual by design: choosing cities (spend), mailing
  the claim link (postage — the link is a bearer credential; a postcard to the listing address is
  the Google-PIN channel, cold SMS is not), and the money flags. PR 2: **the nightly cron**
  `/api/cron/trade-site-pipeline` (06:00, flag `TRADE_PIPELINE_ENABLED`, caps
  `TRADE_PIPELINE_MAX_{SWEEPS,BUILDS}`) drains `trade_sweep_queue` (migration `20260839`, filled
  from `/admin/growth` → "Nightly trade-site pipeline", one city or a metro) and builds drafts for
  parked no-website trade prospects — the button and the cron run the **same** `runSweep` /
  `buildDraftFromListing`, and the sweep category list is one module (`lib/prospects/sweepCategories.ts`).
  A person still chooses the cities; the cron never invents one, and restaurants are refused at enqueue.
  **"Plan the queue"** (`lib/tradeSites/queuePlanner.ts`, pure) ranks city × trade from the domains we
  own (+50) and the measured no-website rate per trade (prior from `AUTO_SHOP_VERTICAL.md` until 10
  businesses are seen), skips pairs inside a 60-day cooldown, and the operator clicks to enqueue in
  that order. Two campaign industries (`roof_cleaning`, `windshield_repair`) had no sweep category at
  all until this — a test now pins every owned-domain industry to one.
  PR 3: **the claim postcard** (`lib/outreach/claimPostcard.ts` — the one surface nothing delivered
  before) mails each built, unmailed trade draft ONE card to the **listing's street address** (the
  Google-PIN channel; cold SMS stays off) with a QR to the tracked `/go/<prospectId>` link. ⚠️ **It
  is the most conservative surface we own** and a test greps the HTML for every promise it must
  never make — no ranking/Google, no 24/7 or licensing, no guarantee, **no competitor, no deadline,
  no printed price**. Three gates before postage (`TRADE_PIPELINE_MAIL_ENABLED`,
  `POSTCARD_MAIL_ENABLED` + `LOB_*`, a sender profile with name + email) and two per draft: an
  operational claim anywhere in the tree **blocks the send**, and the cron waits
  `TRADE_PIPELINE_MAIL_MIN_AGE_HOURS` (24) so a person can eyeball last night's builds first.
  **All four flags were set 2026-09-07 evening; `/status` shows every trade gate ready — the loop
  is LIVE.** The loop is drawn on `/business-plan?v=trade_sites` (`components/business-plan/trade-sites-flow.tsx`,
  pure SVG, counts from `planEvidence`, no price, one amber "operator decides" node — a test pins that
  it never claims more automation than exists).
- **Pay-per-call leads — the eighth vertical (2026-09-18, flag-gated OFF)**: the ranked geo
  site's tracking number sold **per call** instead of the domain per month. A business prepays a
  balance (`ppl_accounts`); each answered call ≥ 90 s deducts one lead price (default $85);
  under $300 the card on file reloads $1,200; at zero the line stops connecting **and says so**.
  Map: **[`docs/PPL_VERTICAL.md`](docs/PPL_VERTICAL.md)**. ⚠️ **The ledger is the truth and the
  DB enforces the two idempotency rules** — one charge per `call_sid`, one credit per
  `stripe_payment_intent_id` (partial unique indexes, migration `20260843`; `ppl_post_ledger`
  row-locks and returns NULL for "already posted", which callers read as done, never as error).
  The one place a charge posts is the **signed** `<Dial action>` callback
  `app/api/twilio/ppl/complete` (signature over the full URL *including the query string*);
  the balance gate is the `pricing_model==='ppl'` branch of `app/api/twilio/geo/[campaignId]`;
  deposits ride the **geo Stripe webhook** on `metadata.ppl_account_id`. Reload idempotency key
  = `ppl_reload_<account>_<chargeLedgerId>` — deterministic per triggering charge, never a time
  bucket. ⚠️ **The IVR copy is the honesty surface**: `FORBIDDEN_IVR_PHRASES` (`lib/ppl/ivr.ts`)
  is grepped in tests — no "licensed/insured/specialist", no "at capacity" when the real reason
  is the business's balance, and it is a *prepaid balance*, never "escrow". Adapted from a Gemini
  draft that never wired its billing step, accepted unsigned Stripe events, and could credit a
  reload twice; each is a constraint or a test here. Flag `PPL_ENABLED`; gate `ppl` on `/status`.
  ⚠️ **A FORWARD-TO CAN GO DEAD AND FOUR THINGS HID IT (2026-09-30, §11e).** `covingtontow.com`
  rang out on two real leads at the market's top-scoring business; found only because the owner
  dialled his own site. (1) `/admin/call-logs` painted **every** status `text-green-400`, so
  `Dial-No-Answer` read as success — colour now comes from `classifyDial`, pinned by a source
  guard. (2) Nothing recorded **who was dialled** (`to_number` is *our* number; `forward_to` is
  mutable), so any answer rate re-attributed the old destination's failures to the new one —
  `call_logs.forwarded_to` (`20260861`) is written at dial time and **deliberately not
  backfilled**, because filling it from the current `forward_to` is a guess about history
  presented as a record of it. (3) There was **no verb** for "send these calls elsewhere" — every
  writer changes a NUMBER and carries the forward-to along — now `setCampaignForwardTo` +
  `POST …/geo-campaign/set-forward` + a Re-point control. (4) Worst: `sendForwardNotice` returned
  `already_sent` on a bare `forward_notice_sent_at`, so the **first re-point would have rung a
  business that had been told nothing** while recording the notice as handled; it now compares
  `forward_notice_sent_to` (a legacy timestamp with no subject still counts as sent, or the fix
  itself re-texts twelve businesses). ⚠️ `forward_unresponsive` is **not** `forward_opt_outs` —
  an opt-out is their decision, "does not answer" is *our* conclusion from *our* evidence and may
  be wrong. ⚠️ **So dial the number from an ordinary phone before writing it off** — the notice
  SMS goes from `TWILIO_FROM` while calls present the tracking number, so a recipient sees only
  an unknown number and *"they screen us"* and *"they answer nobody"* look identical through our
  own bridge, however many calls we log. Only one is fixed by re-pointing. Tested for AL Ram
  2026-09-30: a direct call reached **"the Google subscriber you have dialed is not available"**,
  so our bridge was exonerated and the switch was right. The result goes in
  `forward_unresponsive.note`. ⚠️ `classifyDial` distrusts Twilio's `completed`
  (voicemail answers too): `answered` needs ≥15s, shorter is `brief`, and an **unknown** status is
  never a failure.
  ⚠️ **THE CALLER MUST BE TOLD WHO IS ABOUT TO ANSWER, AND THE RULE FOR THIS WAS ALREADY WRITTEN
  FOR THE WRONG PATH (2026-10-01).** `lib/ppl/cascade.ts` says never imply the caller reached the
  company whose site they rang — but the cascade is **flag-gated OFF**, while the single forward
  that has been live all along said only *"Thanks for calling. Please hold while I connect you."*
  After a page headed **"South Hill Towing" (42 times; no such business exists — the name is
  generated from city + trade at `buildGeoPitchSite`)**, that sentence means *holding for South
  Hill Towing*. A real member of the public dialled it, was bridged to **Too Cool Towing**, was
  honestly told she had not reached South Hill Towing, and hung up: **15 s, logged `connected`,
  and not a delivered lead.** ⚠️ **Note the deception had NO beneficiary** — she got no tow, the
  business lost a job, we burned the third genuine inbound call in the product's history. The
  honest version is strictly more profitable, so there is no trade-off to weigh here.
  Fixed by **naming the destination before dialling it** (`lib/ppl/forwardAnnounce.ts`
  `connectingAnnouncement` → *"Connecting you now with Too Cool Towing, a local towing company
  serving South Hill"*), so the business answering as itself **confirms** the announcement instead
  of contradicting it. The name is `geo_industry_campaigns.forward_to_name` (`20260867`), resolved
  from `outreach_prospects` by `setCampaignForwardTo` and written **in the same UPDATE as
  `forward_to`**, NULL when unresolved — a name surviving a re-point would announce one business
  and dial another, which is worse than announcing none (same reasoning as `call_logs.forwarded_to`).
  Unresolved falls back to *"a local towing company serving Grafton"* — vague but true, and
  **never** to the site's invented identity. ⚠️ **Resolve on the LAST TEN DIGITS** (`last10`):
  `forward_to` is E.164 (11 digits) and a directory phone is 10, so comparing full digit strings
  matches **zero** rows while reading exactly like *"we hold no names for these businesses"* — the
  first query said that about a table where **10 of 11 resolve**. 10 campaigns backfilled.
  Pinned by `lib/ppl/__tests__/forwardAnnounce.test.ts` (source guards over the route + the
  single-UPDATE invariant; **verified to fail with the old sentence restored**).
  ⚠️ **Shortened 2026-10-05** to *"Connecting you to Madrona Electric, serving Renton."* — the
  first version ran 6–7 s before any phone rang and the first real call after it hung up at 5 s
  (an autodialer, almost certainly; still, every human paid the same wait). ⚠️ **And that call
  exposed a blind spot: a hang-up BEFORE the bridge was invisible.** Only `/after-dial` wrote
  outcomes and Twilio requests it only when a Dial *finishes*, so the row stayed `ringing` for an
  hour and the alert email said "still in progress". Every tracking number now carries a
  parent-call status callback (`/api/twilio/geo/<id>/status`, set on purchase + attach, backfilled
  by the **Sync status callbacks** button on `/admin/ppl`); the pure decision
  `lib/ppl/parentCallEnd.ts` writes `abandoned`/`ended` **only over a row with no dial outcome** —
  the parent's `completed` lands a moment after the leg's outcome and must never replace it — and
  `classifyDial` counts `abandoned` **nowhere** in destination health (the business was never
  rung). ⚠️ **A rang-out call with NO message reached nobody (2026-10-07, §11g)**: the only text
  a destination ever got fired from the voicemail webhook, which Twilio requests only when a
  recording exists — so the business that missed the call and whose caller would not wait was
  told nothing, twice. Now the **status callback** texts the caller's number
  (`lib/ppl/missedCallNotice.ts`, pure decision; runs in `after()`, settles 8 s and **re-reads
  the row** so a message left mid-hang-up wins; only `unanswered`, never `abandoned`/`brief`;
  claimed on `missed_call_notified_at`, outcome in `missed_call_notify_result`, `20260876`).
  The email says *"texted them"* only on a confirmed send. Madrona Electric was re-pointed the
  same day: the owner dialled it from an ordinary phone and got voicemail, so the §11e test was
  passed before writing it off. ⚠️ Still open and
  **not** a code question: the page asserts a company that does not exist. The two honest shapes
  are a **directory** (our own dome-cohort rule: *"a directory is not a business"*) or a site that
  names its real renter — and the mismatch exists **only in the unpaid state**, since all 11
  forwarding campaigns are `status='draft'` and nobody is paying.
- **Dome builders — directory sites on `<state>domebuilders.com` with DomeSketch (2026-09-19)**:
  the first pay-per-call mass-deploy cohort (`docs/PPL_VERTICAL.md` §9). 13 state + 8 national
  exact-match domains bought after a Places sweep showed supply per state; a **directory** site
  per state (`lib/domeBuilders/buildDirectorySite.ts`, new block `builders_directory`, industry
  `dome_builder`, launcher `scripts/dome-builders-launch.mts`). ⚠️ **A directory is not a
  business**: no services, phone or "free quote" copy under a name nobody owns — the pure
  builder swaps the scaffold's blocks and a test pins the page shape; every entry renders its
  `source_url`. DomeSketch (`domesketch.ai`, a mesh peer since 2026-09-18) supplies the
  calculator CTA and, once it answers the crosstalk proposal, a directory feed.
- **Store detection ≠ store import (2026-09-16)**: the URL rebuild now decides *"was this a
  store?"* statically (`lib/rebuild/storefrontDetect.ts` — code/CDN signatures for
  Shopify/Shoptop/Shoplazza/Shopline/WooCommerce/…, product-path + cart heuristics, Product
  JSON-LD; **never a brand name in prose** — hicustom.com says "Shopify" in a form label and is
  not a store) and reads the catalog on a three-rung ladder: Shopify `/products.json` → homepage
  JSON-LD/OG → **product/collection subpages** (`lib/rebuild/importProductPages.ts`, same-origin,
  8 pages, 4-wide, beside the AI call). A store detected but unreadable (FOYTEA on Shoptop is
  client-rendered — the first partner rebuild ever, and it came out as a brochure) now gets an
  **empty Shop block + `meta.ecom.import_status='no_readable_products'`**, and `/rebuild` says so
  in the summary. ⚠️ `products_grid` **renders NOTHING in public when empty** — "No products found
  for this merchant." had been SSR'd to visitors of every unwired grid since the block existed;
  guarded by `editorHintsStayInEditor.test.ts`. **Rung 4 (same day): a browser-rendered read**
  (`lib/rebuild/renderedCatalog.ts`, reusing the headless Chromium `lib/verify/render.ts` already
  runs on Vercel via `renderEvaluate`) finds product CARDS by shape — a product-ish link inside a
  container with an image and a price — on the homepage, then up to two listing pages; hicustom.com
  yields 8 products this way (titles + "从 ¥21.01 起" from-prices; its own `<img src="undefined/">`
  imports as *no image*, never a guessed one). ⚠️ **Currency is part of the price**: `catalog_items`
  are minor units against the merchant's currency (USD), so products in any other currency are
  NOT provisioned — they stay a **display-only snapshot** on the grid (`import_status='display_only'`,
  `display_only_reason='currency:CNY'`), which `products_grid` renders as a **product gallery**
  (own-currency prices via `Intl`, "from" honoured, no cart) whenever no ids are wired. Opt-out
  `REBUILD_BROWSER_CATALOG_ENABLED=0`; route `maxDuration` 120. A render failure is logged as a
  failure, never read as "no products". FOYTEA remains empty after rendering: it lists no products.
  China-facing sellers (buyer / merchant / partner are three different Stripe problems):
  [`docs/CHINA_PAYMENTS_PLAN.md`](docs/CHINA_PAYMENTS_PLAN.md).
- **Owner-run render workers — the Mac minis (2026-09-16)**: headless-browser work can run on
  machines the owner runs at home instead of Vercel serverless Chromium. **An optimisation with a
  hard fallback, never a dependency**: `lib/jobs/renderQueue.ts#renderViaQueue` inserts a
  `render_jobs` row only when `RENDER_WORKERS_ENABLED=1` **and** a `render_workers` heartbeat is
  <30s old; not claimed in 6s → expired + local; worker failure or deadline → local. Workers
  (`scripts/render-worker.ts`, `npm run render:worker`) claim with `claim_render_job()`
  (`SKIP LOCKED`), run a **fixed script chosen by `kind`** (`catalog` / `verify` — the row carries
  a URL and options, never JavaScript) through the SAME `assertPublicHttpUrl()` SSRF guard, so a
  row cannot run code on the mini or browse its LAN. Migration `20260842` (applied; both tables
  service-role only). Admin: `GET /api/admin/render-workers`; `/status` gate `render_workers`.
  Proven locally: a worker on this Mac took a HiCustom catalog job in 0.6s and finished in 17s.
  ⚠️ **Scripts on Node 20 need the `ws` polyfill BEFORE the admin client is imported** — without
  it `createClient` throws "without native WebSocket support" and the queue reads as
  `workers_unreadable` (a fallback that looks like "no worker"). Setup, launchd, and what NOT to
  move (Postgres, public hosting): [`docs/RENDER_WORKERS.md`](docs/RENDER_WORKERS.md).
- **Venue sweep for HiveJournal (2026-09-16)**: `POST /api/tools/venue-sweep` — live-music venues
  near a city from our Places seam (`lib/venues/venueSweep.ts`), consumed by HJ's Cornerstone
  Display "Live music" panel; contract **`crosstalk/contracts/venue-sweep.md`** (single source of
  truth — link, never fork). Public + 20/hr/IP, optional `QS_TOOLS_TOKEN` bearer gate. ⚠️ **Places
  text search treats the radius as a bias, not a fence** — the first Laguna Beach sweep led with
  House of Blues Anaheim (40 km); results outside 1.25× the radius are dropped on coordinates.
  A listing is not a schedule; the `note` field says so. Same call a QS venue vertical would use.
- **Per-site redirects + a real 404 on public sites (2026-09-17)**: both public routes used to
  take the first path segment as a page slug and **fall back to the home page with a 200** when
  nothing matched — every `/anything` on every live site rendered home under a self-canonical
  URL (Google indexed `decatur-towing.com/gigs`), and a WordPress migration could not honour
  "redirect the old URLs". Now `lib/sites/redirects.ts#resolvePublicPath` decides
  **redirect → page → reserved app path → 404** from `data.meta.redirects`
  (`[{from,to,permanent?}]`, normalised paths, 308 default), used by `app/host/[[...rest]]` and
  `app/sites/[slug]/[[...rest]]`. Reserved first segments (`cart`, `checkout`, `p`, …) keep their
  old behaviour on purpose. Admin: `GET/PUT /api/admin/templates/[id]/redirects` (commits via the
  RPC; **republish** for the map to reach the served snapshot). Migration recipe in
  [`docs/CUSTOM_SITES.md`](docs/CUSTOM_SITES.md) §9.
- **⚠️ EVERY CUSTOM-DOMAIN SITE WAS THREE SELF-CANONICAL ORIGINALS (fixed 2026-10-07).** Search
  Console mailed *"Duplicate, Google chose different canonical than user"* for bremerton-towing.com.
  The site answers at `www.<domain>`, `<slug>.quicksites.ai` and `/sites/<slug>`, and the renderer
  is self-referencing by design unless `data.meta.canonical_origin` nominates a host — which 54 of
  55 published campaign sites had never done. Google saw three originals and picked one.
  `scripts/nominate-custom-domain-canonicals.mjs` (dry-run default, `--apply`) nominates the
  domain for every published custom-domain site **after a per-row preflight at write time**: the
  domain must answer 200 (following its own apex→www / http→https hops, same registrable domain)
  with the same `<title>` as the platform copy; the nominated origin is the chain's FINAL host.
  63 of 63 set and read back from the served copy. ⚠️ Two things it refused, both real: (1)
  `arlington-hvac.com` serves **someone else's** site (DNS → GitHub Pages, Lakeville Heating &
  Cooling; RDAP: Spaceship registrar, Cloudflare NS, registered 2026-07-15 — not a Vercel
  registration, so not ours) while our campaign row still says `attached` (owner task). (2) Seven
  live, published, 7-page towing sites carried `archived = true` (set 2026-10-02) and were hidden
  from every admin list while serving on their domains — unarchived via the documented bypass. A
  flag on a live site is still a flag; the served HTML is the fact.
  ⚠️ **Do not parse the Search Console emails** — they carry only the property and a reason
  label. **The indexing sweep** (`/api/cron/gsc-url-inspect`, 05:20, read-only at Google, no
  flag; knobs `GSC_INSPECT_MAX` / `GSC_INSPECT_FRESH_DAYS`) asks the URL Inspection API about
  every page of every published site on a connected property, stores the latest answer per URL in
  `gsc_url_inspections` (migration `20260874`) with OUR triage from the pure
  `lib/gsc/indexingTriage.ts` — **fixable by us** (canonical mismatch, 404, robots, 5xx) ·
  **needs a person** (Google's quality verdicts: crawled/discovered-not-indexed, soft 404 —
  "not a setting") · **expected** (our own redirects and proper canonicals, and a duplicate whose
  Google canonical is the one we now nominate) · indexed · unknown (never silently "expected").
  `/admin/seo/indexing` groups by that meaning, not Google's label; the sweep opens one
  `admin_tasks` row per (property, reason) for the two actionable buckets and emails ONE digest
  only when something new appeared. The URLs inspected are the site's pages on its NOMINATED
  origin, never the platform copy. Tests: `lib/gsc/__tests__/indexingTriage.test.ts`.
  ⚠️ **What the first two sweeps found, and what each taught (2026-10-07).** (1) Where BOTH apex
  and www answer 200 with no redirect between them, Google picks www; the nominate script's
  redirect chain ended on the apex, so it now follows the Google canonical the sweep recorded
  when that host serves the same page (6 sites re-set). (2) Google's coverage state is from its
  LAST crawl: a "Not found (404)" two months old on a page serving 200 today is **awaiting
  recrawl**, so the cron HEADs any reported fetch failure live first. (3) **Eleven towing sites
  had a page slug `auto-wrecking-&-flatbed` that 404'd from its own nav** — the segment reaches
  the resolver percent-encoded (`%26`) and the raw compare failed. `lib/sites/redirects.ts#pageUrlKey`
  is the one URL-safe spelling: the resolver matches on it and 308s every other spelling to it,
  `sitePagePath` emits it (sitemap + canonical), the editor seeds nav hrefs with it. (4) A site
  whose nominated host changes leaves its old URL's row behind forever "fixable" — the sweep
  prunes rows for URLs a site no longer lists, and **auto-closes** its own `admin_tasks` when a
  (property, reason) no longer appears in an actionable bucket, which is the question the emails
  could never answer: did it clear? (5) Stop on a TIME budget (230 s), not a count: the first
  run was gateway-504'd mid-loop.
  ⚠️ **"Merchant listings: missing field image" (2026-10-08) was the OTHER half of an inspection,
  on the ONE property the sweep never asked about.** `/sites/starter-auto-dealer` is indexed
  fine; its `vehicles_grid` emitted a `Vehicle` (a `Product`) with an `Offer` and
  `image_url: ''` on all three placeholder cars, and an offer makes Google validate the object
  as a merchant listing, which **requires** `image`. Rule now in `lib/seo/vehicleJsonLd.ts`:
  **no photo, no offer** — the card still shows the price, only the machine-readable listing
  waits for an absolute image URL. The sweep (1) reads `richResultsResult` ERROR issues into
  `facts.richResultErrors` and files an indexed-but-rejected page as *fixable by us*, (2)
  fetches the page and runs the pure `lib/seo/merchantListingGaps.ts` so a fixed emitter reads
  *awaiting recrawl* instead of a task that never clears, and (3) **inspects published
  platform-only sites** (`platformTargetsFor`, ~100 sites, home URL **without** a trailing slash
  or every one files as "Page with redirect") under `https://www.quicksites.ai/` — the domain
  matcher could never reach the property with the most pages on it.
- **Niche discovery — "can an organic result win this page at all?" (2026-09-22)**: two
  measurements behind **[`docs/NICHE_DISCOVERY.md`](docs/NICHE_DISCOVERY.md)**. (1) The **GSC
  query harvest** — every GSC call here asked for `dimensions: ['page']` or none, so we stored
  totals and never learned a word anyone typed; `lib/gsc/queryHarvest.ts` + cron
  `/api/cron/gsc-query-harvest` (07:40, no flag — read-only at Google, unlike `gsc-backfill` it
  writes no DNS) + `gsc_queries` (migration `20260846`, service-role only) + the on-demand
  `scripts/gsc-query-harvest.mts`. **Striking distance** = position 11–40, ≥10 impressions,
  self-lookups excluded. ⚠️ **An average position is not a rank** (GSC averages over impressions;
  `MIN_IMPRESSIONS` is why a 3-impression row is dropped), and a domain ranking for its own name
  is us being looked up, not winnable demand. (2) The **supply-density probe**
  (`lib/niches/{candidates,score}.ts`, `scripts/niche-probe.mts`) — Places supply per metro for
  unusual STRUCTURES, scored against bands anchored to our own cohorts. ⚠️ **Density is a proxy
  for local-pack strength, nobody has read a SERP**, so every verdict says "go read ten searches",
  never "buy". Two controls (towing = known loss, decks = dense but we own the tool) must behave
  or the probe is wrong. **The finding that motivated it:** 92 domains, 2,903 impressions, **18
  clicks**; `towing service near me` sits at position 10.9 with 69 impressions and **zero** clicks
  — the pack is full before our result appears. Hence the rule: **search for the structure, not
  the trade.**
- **SERP checks — is the page winnable, not where do we rank (2026-09-22)**: `lib/serp/*` +
  `scripts/serp-check.mts` + monthly cron `/api/cron/serp-recheck` (flag `SERP_RECHECK_ENABLED`,
  cap `SERP_RECHECK_MAX`) record what sits ABOVE the first organic result into
  `serp_observations` (migration `20260847`). Provider is **DataForSEO** (the credentials
  `lib/prospects/keywordVolume.ts` already uses). ⚠️ **We do not browse Google and must not** —
  automated querying is against its terms, and routing it through HJ's personas would be evasion
  rather than compliance; the personas earn their keep on the NEXT question ("is the page
  currently winning any good?"), a public non-Google page inside their contract. ⚠️
  `MIXED_MAX_BLOCKS` stands in for "did you have to scroll", which an API cannot see —
  `WORKSHEET_CHECKS` is the **calibration fixture** against a person's hand-scored run
  (`docs/SERP_CHECK_WORKSHEET.md`), and the towing control must read `skip` or the classifier is
  broken. ⚠️ A `local_pack` arrives as one block OR as consecutive siblings; uncollapsed it reads
  as pack-of-1 AND 3 blocks above organic, flipping a skip into a best case — both halves wrong,
  toward spending money.
- **Fleet scope — exclude at READ, never at write (2026-09-22)**: `lib/gsc/fleetScope.ts`. One
  personal page was **21% of every impression across 92 domains** and had been setting the fleet's
  average position invisibly. Aggregates now drop `NON_COMMERCIAL_PAGES` and **say what they
  dropped**; the rows are still harvested and stored. Matched on the PAGE, never the query — a
  rule guessing which searches "look personal" is wrong in both directions. Needs the `page`
  dimension (`20260848`; `page` is NOT NULL DEFAULT `''` per `20260850` because PostgREST upserts
  name conflict COLUMNS and cannot match an **expression** index — `coalesce(page,'')` failed
  every write).
- **⚠️ `gsc_tokens.expiry` was timezone-naive and it only broke off-Vercel (fixed `20260849`)**:
  Postgres returned a zone-less string, `new Date()` read it as LOCAL time, so on a UTC-7 machine
  an expired token looked valid for seven more hours, the refresh never fired, and every Search
  Console call returned "invalid authentication credentials". **Vercel runs UTC, so local == UTC
  and production masked it** — which is why it survived; it bites the scripts. `parseExpiry()`
  now treats a zone-less timestamp as UTC regardless of the column.
- **⚠️ The owner's three personal pages are deliberate — never "consolidate" them**
  ([`docs/PERSONAL_SEARCH_FOOTPRINT.md`](docs/PERSONAL_SEARCH_FOOTPRINT.md)): three pages on three
  properties rank **simultaneously for the same queries** (HJ 3.5 · QS 7.8 · the personal domain
  7.2) — three of ten first-page slots, held on purpose to push court records down. The ordinary
  instinct ("near-duplicates split authority, merge them") is the wrong rule for a goal measured
  in SLOTS OCCUPIED, and the proof it does not apply is that all three already rank at once. A
  session recommended consolidating, shipped a 301 and reverted it the same day. They stay
  excluded from fleet aggregates (`lib/gsc/fleetScope.ts`) because the traffic is an automated
  monitoring script, not demand — measurement hygiene, never suppression.
- **⚠️ A BLOCK CAN EXIST AND BE UNREACHABLE — check usage before building a new one (2026-10-02).**
  Asked to close the design gap against Framer-class templates, the first instinct was "we need a
  gallery block". We already had one: schema, renderer, a dedicated editor, and a scaffold line —
  and it appeared on **0 of ~2,800 templates**, because the scaffold gated it on
  `industryKey === 'photography'` and the fleet has **zero** photography sites. Built, polished,
  unreachable. ⚠️ **Then, once reachable, it was still invisible**: an empty gallery returned
  `null` unconditionally, so a seeded one showed nothing in the BUILDER either and no owner would
  ever discover it. The products_grid rule is two-sided — the hint belongs in the editor, and
  there must *be* a hint (`isEditorContext`, `lib/editor/isEditorContext.ts`). Now seeded for
  nine visual trades (`GALLERY_INDUSTRIES`), empty, inventing nothing; a pricing table or process
  list seeded the same way WOULD invent claims, which is why those stay owner-added.
  ⚠️ **Before adding a block, run the usage query** — `select b->>'type', count(*) from templates
  t, jsonb_array_elements(t.data->'pages') pg, jsonb_array_elements(pg->'blocks') b group by 1` —
  the fleet's real recipe is hero/contact/services/faq/cta and little else, so the plainness is
  usually a reachability problem rather than a missing feature.
  ⚠️ **32 of 67 block types are used on ZERO sites** (2026-10-02). Among them `video`, `image`,
  `audio`, `reviews` and `gallery` — precisely what authors/photographers/creatives need.
  ⚠️ **And four of those were unsafe to seed**: `video` rendered `<video controls><source>` with
  no source, `image` an `<img>` with no src, `audio` an empty 80px `<iframe>` — broken furniture
  on a live site for anyone who added one from the palette before filling it in. `gallery` and
  `reviews` had the opposite fault, returning `null` even in the editor, which is why nobody
  ever filled them. All five now follow the two-sided rule via `isEditorContext`, pinned by
  `unconfiguredBlocksStaySilent.test.ts`. ⚠️ **`reviews`' default content had NEVER validated** —
  it carried one placeholder row at `rating: 0` against a schema requiring `min(1)`, invisible
  because the block was seeded nowhere; the same two-contradicting-decisions shape as the
  testimonial `.min(1)` bug (#1084), caught the same way by the scaffold sweep. Now `[]`.
  **New block `selected_work` (2026-10-02)** — a NAMED index of work (title · meta · blurb ·
  image · optional link), seeded for `personal`, `photography` and `author`. ⚠️ **It is not the
  gallery and does not replace it**: a gallery answers "what does your work look like", this
  answers "what have you done, and for whom" — the credit line a grid of untitled images cannot
  carry (benchmarked on louver.framer.website, whose middle is seven titled entries). A row
  without a TITLE is dropped: an image-only entry belongs in the gallery. ⚠️ Anchored above the
  **marketing tail** (`services|faq|cta|contact_form`) — omitting `cta` from that list put it
  after the call to action on `personal`, which has no services or faq: asking for the click
  before showing the work.
  **A display scale, replacing 48px everywhere (2026-10-02, `lib/theme/typeScale.ts`)**: the
  hero headline was `text-4xl md:text-5xl` **hard-coded for the whole fleet**, independent of
  industry, theme or content, against benchmarks at 72–220px. Ceilings now: editorial 96 ·
  bold 76 · elegant 68 · friendly/modern 64 · technical 56, all fluid, **minimums held at
  today's mobile size** because the measured gap was a *desktop* gap and doubling a phone
  headline turns one wrapped line into four. Trades included (owner).
  ⚠️ **Driven by the INDUSTRY, and both of the obvious alternatives were wrong.** The plan said
  `ThemeCategory` — stamped on **zero** of 1,929 templates, so it would have applied to nothing
  and looked finished. The pairing's `mood` was the next guess and shipped: it put
  `starter-photography` (carrying `space-inter`, **technical**) at 56px, the HVAC ceiling, on a
  photographer — because `pickCuratedTheme` assigns a pairing at creation and knows nothing
  about mood. The scale answers *how loudly may this business speak* (the trade); the pairing
  answers *in what typeface*. Caught only by measuring a live page after merging.
  ⚠️ **Applied in CSS scoped to `[data-qs-themed]`, NEVER as an inline style.** An inline
  `font-size: var(--qs-display)` on an unthemed site is **invalid at computed-value time** and
  resolves to `unset`, so the h1 would inherit BODY size instead of falling back to its
  Tailwind class — silent and fleet-wide. The descendant selector also out-specifies a single
  utility, so it wins without `!important` (the `SectionShell` lesson, #665).
  ⚠️ **`resolveSiteTheme` used to abandon the whole theme on an unrecognised accent** —
  `if (!accentHsl) return null`, thirty lines above where the pairing is read — so **170 paired
  sites** had a typeface that produced no `--font-heading` and no font. Accent and typeface are
  independent; one missing must not discard the other. It now returns null only when there is
  no identity at all.
  ⚠️ **A SITE IS SERVED FROM TWO SNAPSHOTS AND A REPUBLISH CAN FIX ONLY ONE.**
  `published_sites → template_versions` serves a platform slug; the legacy
  `sites.published_snapshot_id → snapshots` serves a **custom domain** (`app/host` reads
  `snapshots.data`). `scripts/lib/republishTemplate.mjs` mints the second by **cloning the
  pinned snapshot and applying the `transform` argument** — it does *not* copy the draft — so a
  no-op transform re-pins a fresh copy of the STALE content and still reports `+domain
  snapshot`. `graftontowing.com` was republished, logged ✓, and served no font.
  `scripts/republish-font-backfill.mjs` checks **both** and copies the theme only (a draft can
  hold unreviewed edits; shipping those under cover of a font change is a second, unasked-for
  deploy). 38 published sites carried out 2026-10-02 with owner approval.
  **Design parity is a PRESENTATION problem, not a block problem** —
  [`docs/DESIGN_PARITY_PLAN.md`](docs/DESIGN_PARITY_PLAN.md), measured 2026-10-02 against four
  Framer templates. ⚠️ **2,452 of 3,231 templates (76%) have no `fontPair`** and render in
  `ui-sans-serif`: the pairing system (`lib/theme/fontPairings.ts`) exists and does not reach
  them — the same reachability failure as the dead blocks, and the cheapest win available.
  ⚠️ **Our h1 is 48px on every site measured**; theirs is 72–220px. ⚠️ **We animate nothing**;
  they carry 200+ entry-animated elements. ⚠️ **But `jonas.framer.website` is 2k px with ONE
  image and still reads premium — the same height as our sites** — so the variable is type,
  space and motion, NOT page length or photo count. Do not pad pages to compete; it costs
  performance and closes nothing.
  ⚠️ **1,199 templates have ZERO pages** — duplicate/version artifacts (1,188 carry the builder's
  `-xxxx` random suffix), owned by 4 operator accounts, **0 published, 0 real custom domains, 0
  referenced** by `geo_industry_campaigns` or `published_sites`. `scripts/archive-empty-templates.mts`
  flags them `archived` (the column exists and `/api/admin/templates/list` already filters it) —
  **archive, never delete**: a flag survives discovering that some other query forgot to filter
  `archived`, and 1,199 deleted rows do not. It re-checks every safety condition **per row at
  write time**, because a survey is a snapshot and a bulk job that trusts its own earlier count
  is how a live site gets archived. ⚠️ `custom_domain` was `''` on 368 of them — `is not null`
  is not `is not empty`, and the first count read those as real domains. ⚠️ `archived` is NOT
  content, so `commit_template` is the wrong tool; the documented
  `set_config('app.bypass_template_guard','on', true)` inside a txn is the path (verified a
  direct UPDATE raises, and the bypass works, both in a rolled-back transaction).
  **Pin a typeface to an industry from the editor (2026-10-02)**: the theme panel's footer lets
  an admin make the pairing they are looking at the default for that industry
  (`POST /api/admin/theme/industry-font-pin` → `site_settings.industry_font_pairs`,
  `lib/theme/industryFontOverrides.ts`). Taste lives with the person looking at a real site, not
  in a TypeScript table behind a deploy. ⚠️ **A pin beats the mood table outright with NO seed
  spreading** — the point is that every site in the trade matches. ⚠️ **Pins are validated on
  READ**: a pairing renamed in code leaves a pin naming nothing, and serving that resolves to no
  font — the system-stack bug all of this exists to fix. ⚠️ **It changes NEW sites only**; the
  control says so, because "make this the default" reads like "apply everywhere".
  ⚠️ **Two bugs worth remembering from building it.** (1) The button would have LIED: a new
  site's face comes from `pickCuratedTheme(...).fontPair` and nothing consulted the pins, so
  `buildIndustryStarter` gained a `fontPair` override and the create route passes it. (2) Passing
  `fontPairForIndustry()`'s answer unconditionally would override the CURATED THEME's pairing on
  every new site — it answers for every industry, so only an explicit pool may override.
  ⚠️ **A pin is a POOL, not one face** (owner, 2026-10-02): one typeface per industry makes every
  towing site in a town identical — the "obviously a template" tell. The control reads *Add X to
  <industry> pool*, shows the pool as chips, and flips to Remove; sites spread across it by the
  same deterministic seed, so a visitor sees variety and we can reproduce any site's face. A pool
  of one behaves like a hard pin. ⚠️ `sanitizePins` still accepts the **legacy single-string**
  shape, because the 1:1 version shipped first and those rows would otherwise resolve to no font.
- **Admin dashboards**: AI spend `/admin/ai-costs`, cron health `/admin/cron`, print orders `/admin/print-orders` (links in the admin nav).
  ⚠️ **The sidebar used to jump to the top on every navigation (fixed 2026-10-05).** Route-driven
  selection in `AdminNavSections` took the FIRST row whose href was a prefix of the path — a short
  early row like the dashboard matches almost any admin path — then scrolled it into view, so
  clicking a Platform Inbox child reset `aside.scrollTop` 2426→0 on the same mounted element.
  Now the most specific href wins and only an arrow-key move scrolls; the quick-find search is
  `sticky` inside the aside. ⚠️ A second, deliberate jump lived in `toggleMenu`: opening a folder
  called a scroll-to-top helper "so the folder and its children land in view" — for any folder
  below the first screen that is the folder you just tapped vanishing upward. Removed; opening
  now only keeps the tapped row in view (`scrollIntoView nearest`, a no-op when visible). Pinned
  by `components/admin/__tests__/sidebarScroll.test.ts`.
  ⚠️ **`/admin/users` columns were misaligned because a `<div>` wrapped each `<TableRow>` inside
  `<tbody>` (fixed 2026-10-02).** A div is not a permitted child of tbody, so the HTML parser
  **foster-parents it out of the table** and the column structure collapses — it presents as a
  CSS problem that no CSS can fix, and `tsc` cannot see it. Group rows with a fragment, never an
  element. Pinned by `components/admin/users/__tests__/usersTableStructure.test.ts`, which also
  asserts header-cell count == body-cell count so a column added to one and not the other fails.
  **Signed up from** shows coarse first-touch geo (`user_signup_geo`, `20260872`): Vercel's edge
  headers, country/region/city, **never the IP** — that would create a PII store needing
  retention and deletion for a question nobody asked. ⚠️ **First touch wins** (`ignoreDuplicates`),
  so it means "signed up from", not "currently in". ⚠️ **It is NOT backfillable and "—" means we
  never looked** — nothing captured these headers before 2026-10-02, and the only other IP trail
  (`ratelimit_events.key`) is an abuse-control log not tied to a user id; correlating it by
  timestamp would be an inference presented as a record.
- **Global settings**: `public.site_settings` (key/value jsonb, **service-role only**, RLS-denied) holds showcase mode/hidden/order. Helpers: `lib/settings/siteSettings.ts`.
- **New crons** (`vercel.json`): `agency-site-sync`, `demo-refresh`, `print-order-sync` (all cron-secret auth'd; the latter two are flag-gated).
- **Secrets**: a leaked service-role key was removed + a gitleaks scan added (CI `.github/workflows/secret-scan.yml` + pre-commit). Rotated 2026-06-30 — see [`docs/SECRET_ROTATION_RUNBOOK.md`](docs/SECRET_ROTATION_RUNBOOK.md).
- **White-label / agency branding (Tier 1.5)**: reseller orgs (`organizations_public.billing_mode === 'reseller'`) rebrand the client-facing surface. Brand data = `organizations_public` (a **view** over `organizations`; exposes `name`/`logo_url`/`dark_logo_url`/`theme_json`/`email_from`), resolved host→org by `lib/org/resolveOrg.ts` and served to the client via `OrgProvider`/`useOrg()`/`useBrand()` (`app/providers.tsx`) and `GET /api/org/branding` (`lib/org/branding.ts`, reseller-gated → 404 else). Branded surfaces: login/join pages, admin chrome wordmark+logo (`components/admin/admin-chrome.tsx`, `AppHeader/app-header.tsx`), transactional emails (`orgEmailBrand()` in `lib/email.ts` → per-org `email_from` sender + display-name/footer; **inert until a Resend domain is verified**), and `theme_json` accents (`lib/org/theme.ts#pickAccentColor`, validated hex). **Self-serve activation (2026-09-15, slice 4):** a partner gets their reseller org from a checklist on `/partners/dashboard` (brand → domain → email domain → payouts → share; routes `app/api/partners/brand/*`, scoped through `requirePartner()` to the partner's OWN org, never a client org id), and **middleware looks unknown hosts up in `org_domains`** (`lookupOrgHost`, Edge fetch + cache) so a partner's `app.theirbrand.com` is an app host without a code change — before this, org hosts were a static map and a reseller needed a deploy. Zero reseller orgs had ever existed when the first partner asked. See [`docs/WHITE_LABEL_PLAN.md`](docs/WHITE_LABEL_PLAN.md).
- **Money-funnel instrumentation (Model A / A7)**: all 8 funnel steps + partner commission events emit server-side via `captureServer` at their authoritative transitions (`signup`→`platform_fee_collected`, `commission_accrued`/`_paid`). Event constants: `lib/analytics/events.ts`; signup heuristic: `lib/analytics/funnel.ts`. See [`docs/MODEL_A_PLAN.md`](docs/MODEL_A_PLAN.md).
  - ⚠️ **AND NONE OF IT HAS EVER RECORDED ANYTHING IN PRODUCTION (found 2026-09-25).** `vercel env ls production` returns **zero** PostHog entries, and `captureServer` returns early when `POSTHOG_KEY` is unset — so all **33 call sites across 24 files** have written to nothing for the life of the feature: the whole money funnel, the commission events, the CRM events, `TRADE_CARD_LINK_VISITED`, `GUEST_SIGNUP_CONFIRMED`. The code is correct and its tests pass; `captureServer` no-ops *by design* so callers need no guards, and that graceful degradation is exactly what hid it. **An analytics layer that is absent and one where nothing happened look identical from the inside.** A `posthog` gate now exists in `lib/config/health.ts` so `/status` says so; setting the key is an owner action. ⚠️ **Until it is set, never cite a PostHog-only event as evidence** — "no `site_published` events" means the key is missing, not that nobody published. Anything that must be countable goes in a table (`guest_upgrade_events`, `claim_funnel_events`), with PostHog as a mirror.
- **Claim + guest funnels are DB-backed on purpose (2026-09-25)**: the two acquisition paths both end at *create an account*, and that step had converted **0 of 21** guest builders and **0 of 4** postcard scanners. Pre-submit steps now persist — `guest_upgrade_events` via `POST /api/guest/funnel` (`lib/analytics/guestFunnel.ts`, #1035) and `claim_funnel_events` via `lib/analytics/claimFunnel.ts` (migration `20260853`, deny-default RLS, service-role only; wired into `/claim-site/[id]`, `/api/claim-draft/[id]` and `claimPendingSiteDraft`). ⚠️ `claim_completed` is recorded **inside the `transferred === true` branch** — the `claim_operator_draft` RPC no-ops on an already-claimed draft, so counting the call would turn one leaked link opened twice into two claims. ⚠️ `bad_token` and `not_claimable` stay **distinct**: the first means *our own link* failed someone who tried, the second that the draft is genuinely gone. ⚠️ **Never hit `/go/<prospectId>` to test** — it increments `claim_link_visits`, the only response data the outreach programme has.
- **Green-path money-path proofs** (admin-gated, in-app, no real Stripe): `POST /api/admin/commerce/e2e-demo` (seed merchant → order → paid → platform fee + partner residual, asserts the numbers) and `POST /api/admin/commerce/pod-demo` (author/POD flagship: Lulu book + Gelato poster, asserts the fee is taken on **margin** with the printer base cost carved out + a print job is queued). Both idempotent; `{cleanup:true}` tears down.
- **Sales tax**: when `QS_STRIPE_TAX_ENABLED=true`, Stripe `automatic_tax` runs at checkout and `markOrderPaid` records the computed tax to `orders.tax_cents` + reconciles `total_cents` (`parseStripeTaxTotals` in `lib/commerce/fees.ts`). Tax is **excluded from the platform-fee basis** (fee is locked at draft on the pre-tax subtotal); surfaced on the receipt.
- **Customer CRM + email campaigns (2026-07, CRM Phase 0→3)**: a buyer identity spine + the surfaces on top. `markOrderPaid` step "3b" upserts the buyer into `customers` (per-merchant, deduped by normalized email; `upsert_customer_from_order` RPC) and links `orders.customer_id`/`customer_email` (`lib/commerce/customers.ts`). Merchant surfaces: `/merchant/customers` (searchable list with segments/filters/sort + tags), the profile (LTV + a unified **activity timeline** merging orders + campaign receipts; editable notes/tags/`marketing_consent` via owner-gated `PATCH /api/merchant/customers/[id]`), and `/merchant/campaigns` — consent-gated email blasts to a segment (`crm_campaigns`/`crm_campaign_sends`, one-click unsubscribe `/api/crm/unsubscribe` w/ signed token + `List-Unsubscribe`, 250/send cap) with last-touch 7-day **order attribution** (revenue per campaign). Logic in `lib/crm/*` (`segments`, `campaigns`, `attribution`, `activity`, `unsubToken`); tables via `20260707_{customers_identity_spine,orders_customer_id,customers_notes,crm_campaigns}.sql` (all applied). Historical backfill: `npm run backfill:customers`. Deny-default RLS + owner read; service-role writes. **Not plan-gated** (free for every merchant). Buyer/campaign PostHog events emit via `captureServer` (`customer_created`/`repeat_purchase`/`campaign_sent`/`campaign_order_attributed`/`customer_unsubscribed`, distinctId = the customer). See [`docs/CRM_PLAN.md`](docs/CRM_PLAN.md).
- **Brand motif (2026-07)**: a neon-steampunk loading video (`components/brand/BrandLoader.tsx` → `public/brand/qs-loader.mp4`, used by `AsyncGifOverlay` + the guest "Building your site…" wait) and a homepage hero character (`public/brand/qs-character.jpg`, shown only on the default brand via `billingMode !== 'reseller'`). Also: homepage/workspace decorative backgrounds (`components/home/section-backdrop.tsx`, `components/admin/work-surface-background.tsx` — per-user localStorage, picker in the profile) with the homepage glow **off by default** + a glow-opacity slider in the color lab; editor toolbar tooltips now show their keyboard shortcuts (t/s/p).
- **Partner audio provisioning — owner-voice audio via HiveJournal (2026-07-25, PR #537, merged; ⏸️ INERT until an env gate is set)**: QS generates owner-voice audio (spoken welcome / narrated review) for a site owner by calling HJ's owner-scoped endpoints **on the owner's behalf**, so nobody hand-copies ids between dashboards. Spec: **`crosstalk/contracts/partner-provisioning.md`** (the single source of truth — never fork it here). Auth is a three-header grant model (`X-Partner-Id` / `X-Partner-Key` / `X-Partner-Grant`): the owner mints a scoped, revocable token in *their* HJ dashboard, pastes it once into `/merchant/audio`, and we store it **encrypted at rest** (AES-256-GCM). Code: `lib/partners/audioProvisioning/*` (`config` = flag + fail-closed check, `crypto`, `grants` store, `provisionClient`, `usageFeed` = HJ's B2 rollup → ledger, `attachEmbedToSite` = the last mile). Routes: `POST/GET/DELETE /api/partner/audio/connect`, `POST …/generate`, `POST …/attach`, nightly cron `/api/cron/partner-audio-usage-sync`. Tables `partner_audio_grants` + `partner_audio_usage` (migration `20260806`, applied; **deny-default RLS — service-role only**, grant tokens are per-owner bearer secrets). Two things to know before touching it: (1) **consent v2 is load-bearing, not decoration** — `usage.voice_basis` says which voice actually spoke (`self` = the owner's own clone, `narrator` = standard), **testimonials are narrator-always**, and a partner grant can *never* render a third-party voice (HJ 403s; we surface it as `voice_third_party`). Never label a clip "in the owner's voice" unless HJ reported `self` — an unreported basis must read as unknown. (2) **`billing_mode` defaults to `owner`** (HJ meters the owner's own plan); `partner`-mode accrual is deferred HJ-side, so don't front a paid audio CTA yet. **To activate**: set `PARTNER_AUDIO_PROVISIONING_ENABLED=1`, `PARTNER_GRANT_ENC_KEY` (32 bytes, hex/base64) and `PARTNER_QUICKSITES_SECRET` — that last one is a **shared secret that must hold the same value in HJ's env and ours**, which is the only remaining step and an owner action.
- **Verbatim — résumé → About-Me page (2026-07-31)**: a **named QuickSites feature, not a brand** (no domain, no separate surface). Paste a résumé + one paragraph → `lib/rebuild/importResume.ts#profileFromResume` produces the **same `ProfileSpec`** `importProfile` builds from a URL → `rebuildSpecFromProfile` → `buildRebuildTemplate` → the `personal` scaffold. Skills map to `services`, roles to `story` panels, so **no new block types**; the URL path is unchanged (the fields are optional). Route `POST /api/rebuild/resume` (guest-friendly like `/build`, per-IP draft limit, **no AI gate because there is no AI call**), UI at `/verbatim`. ⚠️ **Deliberately deterministic** — a CV is a factual claim about someone's employment, and a model that "tidies" a job history invents one; the parser only recognises and rearranges text the person supplied. `buildResumeSite` returns **`gaps`** (what the résumé did *not* yield) and the UI shows them — a parser reporting only what it found lets someone publish a page missing their own name. `headline` is always a gap unless typed (a job title is a claim about a person); never a generated photo (rule 9); **no assigned voice** — unlike the persona builder, this is a real person, so any voice must be their own consented clone. Named for the **mechanism, not the virtue**: "verbatim" is a fidelity claim about the *text*, which survives the (unbuilt) own-voice layer because voice ≠ words. The gap-reporting is deliberately **not** in the name — it would read as a tool that nags you about what you're missing. See PR #659.
- **Verbatim job-seeker workspace (2026-08-11)**: `/verbatim/workspace` (auth, noindex) stores the
  postings someone is chasing beside their résumé pages, with a per-posting **"Practice this
  interview"** deep-link into HiveJournal's stateless rehearsal room. Owner direction: QS holds the
  documents, HJ holds the engine. Table `job_postings` (migration `20260823`), logic in
  `lib/jobs/postings.ts`, contract in **`crosstalk/contracts/interview-workspace.md`** (single
  source of truth — link it, never fork it).
  ⚠️ **THIS IS THE MOST SENSITIVE TABLE IN THE PRODUCT AND IT DOES NOT LOOK LIKE ONE.** Everything
  else we store is content someone chose to publish. A row here says *a named person is applying to
  a named company right now* — the fact most job seekers hide from their current employer. Hence:
  **owner-scoped RLS with NO admin bypass**, queries that run as the **caller's session rather than
  the service role** (against §6's norm — service-role + route auth makes every query *capable* of
  reading anyone's search; RLS as the guarantee means a forgotten filter returns nothing instead of
  everything), `on delete cascade` from `auth.users`, and **no server-side fetching of postings**
  (paste is a choice, fetch is a decision made for them).
  ⚠️ **TWO INVARIANTS THAT BIND FUTURE SESSIONS, ONE PER SIDE.** (1) **Adding an operator/admin view
  of `job_postings` breaks the guarantee** — it belongs in the contract before it belongs in code,
  and "support needs to see it" is exactly the reasoning the schema exists to refuse. (2) HJ
  persists no interview content, and **QS's workspace footer says so in QS's voice** — if HJ ever
  retains content that sentence becomes false the same day; HJ has anchored the reciprocal
  invariant in their own index (HJ #1940) so a future HJ session adding prompt-logging sees it.
  The handoff carries **company/role/stage only, never the posting body** — a job description in a
  query string is copied into browser history, referrer headers and the receiving server's access
  logs. Stage values are HJ's (`recruiter_screen`/`hiring_manager`/`exec`/`technical`/`onsite`) —
  ⚠️ we shipped `founder_exec`, they aliased it so our link kept working, and that alias would have
  made the wrong value permanent; it is retired and `exec` is canonical.
- **Résumé version library — many tailored versions, one of them public (2026-08-18)**: a private
  library of résumé files (`resume_versions`, migration `20260824`, `lib/resumes/versions.ts`, UI in
  `app/verbatim/workspace/resume-library.tsx`), each labelled with the job it was tailored for
  (`job_postings.resume_version_id` records which one an application went out with), and **exactly
  one** marked public — enforced by a **partial unique index**, not app code, because two public rows
  make "which résumé does the world see" depend on row order.
  ⚠️ **THE LABEL AND THE DOCUMENT ARE DIFFERENT PRIVACY CLASSES, AND CONFLATING THEM IS THE BUG THE
  DESIGN EXISTS TO PREVENT.** The document may be published; the label ("Indeed — Distinguished
  Engineer, AI") is the `job_postings` disclosure one indirection removed. The obvious build — drop
  the tailored PDFs into the existing **public** `resumes` bucket under their own names — makes the
  *filename* the disclosure, world-readable to anyone who has or guesses the URL, and it cannot be
  walked back. So: files live in a **private** bucket (`resume-versions`) at **server-derived opaque
  paths** (`<owner>/<version>/resume.<ext>`; the client sends bytes and a format, never a name), and
  nothing is served straight from storage. **`GET /api/resume/<slug>/<format>` streams** (never
  redirects, never a signed or public storage URL) so the outgoing `Content-Disposition` filename is
  ours: a recruiter saves `Sandon-Jurowski-Resume.pdf`, never `…-Indeed-….pdf` — **a résumé is
  forwarded, so a filename naming the wrong employer is the leak arriving by hand.** The public URL
  names a site and a format, never a version, so switching is one DB update and every link already in
  the wild keeps working. Owner-scoped RLS, **no admin bypass**, caller session rather than service
  role (the public route is the one unavoidable service-role caller, and is written narrow —
  `.eq('is_public', true)` in the same statement). Pinned by `lib/resumes/__tests__/versions.test.ts`,
  which includes **source guards**: a unit test cannot catch a deleted `.eq('is_public', true)`,
  reading the file can. ⚠️ Switching **does not un-publish** what someone already downloaded; the UI
  says so rather than implying a recall.
  ⚠️ **"PUBLIC" IS SCOPED TO A SITE, NOT TO AN OWNER (`public_site_id`, migration `20260830`), and
  the first cut got this wrong in a way every test pointed at the right site would have missed.**
  Resolving `slug → owner → that owner's public version` reads as obviously fine — an owner has one
  résumé — but this product's owners are **agencies with client sites**: the account in question owns
  **2,227 templates**, so all of them served the résumé, and because the outgoing filename is built
  from the *requested* site's business name, `/api/resume/starter-personal/pdf` returned one person's
  résumé under another person's name (`Alex-Rivera-Resume.pdf`). **"The sites you own" is not "the
  site that is about you"** — the same class as §8's `base_slug` bug, where a rule that held for the
  case in front of you silently generalised to the whole fleet. Found only by requesting a site the
  feature was *not* built for; a check constraint now forbids `is_public` without a site, and a test
  asserts the route never filters on `owner_id`. **Never add a "fall back to the owner's site"
  convenience** — that is this bug, restored.
  ⚠️ **The workspace deliberately stays on the APP host and is not served from `<slug>.quicksites.ai`.**
  Asked to "merge" the two, the answer is to merge the *content* (the site serves what the workspace
  publishes) and invert the navigation (the workspace shows the live site), **not** to move the private
  board onto the tenant host. Every path on a platform subdomain is rewritten to `/sites/<slug>`
  (`middleware.ts`; only `/api`, `/host`, `/_domains`, `/sites`, `/login` escape), so a private surface
  there needs either a second login — session cookies set **no `domain`**, so they are host-only — or a
  cookie widened to `.quicksites.ai`, **which would send the platform session to every tenant site**
  (2,826 slugs). A middleware carve-out is also fleet-wide, not per-site: it would give *every*
  customer site a `/workspace` path. Repointing the public block is `scripts/repoint-resume-downloads.mjs`,
  which **preflights the live URL and refuses to write unless it already answers 200** — the route does
  not exist until deploy, and repointing early swaps three working links for three 404s on a live page,
  a failure invisible from the editor. Verified 2026-08-18: `sandon.<host>/verbatim/workspace` today
  rewrites to `/sites/sandon/verbatim/workspace` and renders the **site** with a 200 (the catch-all
  answers 200 for any path), so the workspace is simply unreachable there rather than protected there.
- **Public marketing surfaces**: `/partners` (reseller landing), `/partners/calculator` (interactive GMV earnings vs flat-markup), and `/compare` (features-vs-Duda/GoHighLevel chart with sourced pricing + an honest "where they lead" section — the CRM/marketing row now reads `partial`, not out-of-scope). Positioning source: [`docs/COMPETITIVE_LANDSCAPE.md`](docs/COMPETITIVE_LANDSCAPE.md). **The Gemini case study on `/compare` (2026-09-18)**: the hub gained the *agency-economics* axis the feature grid lacked — `components/compare/case-study-callout.tsx` renders Gemini's margin figures as stat tiles labelled "unverified by us" **with the three correcting slides beside them** (never behind a click), and `/compare/10web` + `/compare/framer` carry a per-vendor aside. Every figure is READ from `lib/caseStudies/geminiAgencyEconomics.ts` (`caseStudyFiguresFor` / `caseStudyCorrections`); a test greps the compare surfaces for the deck's literal numbers and fails on any. ⚠️ **10Web and Framer joined `lib/compare/competitors.ts` with pricing we read on their own pages, not lifted from the analysis** — the deck itself warns against that shortcut, and `competitors.test.ts` pins that every case-study vendor is a full registry entry with vendor-domain sources. A later addition carries its own `pricesVerified` (`pricesVerifiedFor(c)`), so the July sweep date is not stamped on a September read.
- **Recorded product demos — real footage, several per feature, dated (2026-10-01)**: prospects
  asked to *see* a site being made. `scripts/record-demo.mts` (#1085) drives the real product in
  headless Chromium and records it (Playwright `recordVideo` needs **no xvfb**), writing
  `demo-videos/<name>-<YYYY-MM-DD>.mp4`; `scripts/upload-demo-videos.mts` (dry-run by default,
  `--apply`) uploads to the `videos` bucket and attaches each clip to the feature it demonstrates.
  ⚠️ **Storage paths are DATED (`demos/<YYYY-MM-DD>/<name>.mp4`) and the date comes from the
  FILENAME, never from today's clock** — the product changes underneath a walkthrough, so a stable
  path silently turns the clip a customer was sent last month into a different video, and a
  re-run would otherwise mint a second copy of the same take under a new date. An undated filename
  is refused rather than dated for you. Which feature a clip belongs to is **declared** in the
  script's `CLIPS` map and every slug is checked against the DB before any byte uploads — a clip
  on the wrong feature is a wrong claim about the product, and a typo'd slug would otherwise
  upload fine and attach nothing. ⚠️ **The column is `features.demo_clips`
  (`20260868`), NOT `features.gallery`** — that one is the portfolio IMAGE gallery, gated behind
  `portfolioMode` + `media_type='gallery'` and counted to the operator as "N images". ⚠️ `gallery`
  had also been **stored and never rendered**: `/features` only ever read `video_url`, so anything
  put there was invisible while looking saved. The two decisions that are easy to get wrong are
  pure in `lib/demos/planDemoClips.ts` with tests, **because both were wrong on the first real
  run and neither failed a build**: (1) repointing the headline player only when it already holds
  one of our own `/demos/` URLs — `!videoUrl` alone left the editor's player on the stale undated
  cut and silently defeated dated paths, while overwriting unconditionally would clobber a
  hand-set YouTube link; (2) an old URL is kept as an "Earlier take" **unless it shares a basename
  with a clip just uploaded**, since that is the same recording migrating — the first run filed
  byte-identical files (845,278 each) as two takes and the page would have shown one clip twice.
  Both found by reading the rows the script wrote, not from its exit code, and both verified to
  fail with the original logic restored.
  **Shown as a ROW OF SMALL CLIP CARDS** (`components/features/demo-clip-row.tsx`) — poster,
  label, one-line blurb, duration pill, click to open full size — not inline players. Full
  procedure + what to record next: **[`docs/DEMO_VIDEOS.md`](docs/DEMO_VIDEOS.md)**.
  ⚠️ **A clip card MUST stop the click**: on `/features` the whole feature card is wrapped in a
  `<Link>`, so the inline players this replaced could not actually be played — pressing play
  navigated to the detail page. ⚠️ **Posters are load-bearing, and the TIMESTAMP is declared per
  clip, not chosen by a filter**: the recordings open on a loading page so a poster-less `<video>`
  shows a WHITE first frame, and ffmpeg's `thumbnail` filter (most *distinctive* frame) picked the
  colourful loading animation for `editor-tour` — a poster reading "Building your site …" under a
  card labelled "Editing blocks, theme and publish". The filter worked; the result was wrong, and
  only looking at the frames showed it. Duration is ffprobe-measured and an unmeasured clip renders
  **no** pill (a `0:00` badge is a measurement nobody took). ⚠️ **List `demo_clips` BEFORE the bare
  `video_url` fallback** — `usableClips` keeps the first entry per src, and reversed, the
  poster-less stub beats the rich row and the primary renders as the one grey placeholder among
  real thumbnails (it shipped to a screenshot that way).
- **Demo narration — read the script against the footage (2026-10-01)**: `/admin/demo-narration`
  (admin-only, in the nav) records the owner's voice **one scripted line at a time**, plays each
  take at its cue, and mixes them into one soundtrack. ⚠️ **The cues come from the recorder's
  manifest and nowhere else** — `record-demo.mts` now writes `<clip>-<date>.json` with each line's
  offset on the FINISHED timeline, measured from the encoded segments, because flagged steps are
  sped up 8× and a raw wall-clock timestamp lands minutes late. Those numbers exist only inside
  that process; a clip with no manifest has **no cues**, and the studio says so rather than
  spacing lines evenly (plausible, and wrong after the first timelapse). ⚠️ **The mix runs in the
  BROWSER** (`OfflineAudioContext` → WAV): ffmpeg lives only in `scripts/`, never in `app/`/`lib/`,
  so there is none on Vercel. ⚠️ **An unrecorded line is SILENCE, never TTS** — the track is
  presented as the owner's voice and a machine voice inside it is the mislabelling
  `crosstalk/contracts/audio-honesty-standard.md` forbids; gaps are reported. ⚠️ **Takes are keyed
  `<clip>@<recordedOn>`** (`demo_narration_takes`, `20260869`, deny-default, private bucket,
  signed URLs) because re-recording shifts every cue — narration timed to the old cut must not be
  *found* for the new one. ⚠️ **The recorder's date stamp is LOCAL, not `toISOString()`**: UTC
  rolls at 5pm Pacific, so an evening session stamped tomorrow, told viewers the wrong day, and —
  since the date is in the storage path — published a SECOND copy instead of replacing one.
  **Narration plays on the PUBLIC page too (2026-10-01)**: the studio's **Publish to /features**
  mixes the takes and uploads ONE public track (`POST /api/admin/demo-narration/publish` →
  `demo_clips[].narration`), and `DemoClipRow` shows a speaker toggle. ⚠️ **The takes themselves
  can never be served publicly** — they are unreleased recordings of a named person mid-sentence,
  private bucket, signed URLs; only the deliberate MIX goes out. ⚠️ **Default OFF, user-initiated,
  `preload="none"`** (audio-honesty standard, and ~1.5 MB nobody who ignores it should pay for).
  ⚠️ **The track FOLLOWS the video** — `audio.currentTime = video.currentTime` on play/seek/pause;
  starting both and hoping drifts within seconds and narrates the wrong thing. ⚠️ **A partial
  reading says so** ("3 of 6 lines"), or the silences read as the product being quiet. ⚠️ **A
  re-record DROPS the narration** — a same-day re-record reuses the same dated path, so carrying
  it over would play a voice against footage it was never timed to; `planDemoClips` keeps it only
  when `duration_seconds` is unchanged, the fingerprint that always moves on a re-record. ⚠️ **The
  mix pulls its peak back to −1 dBFS only when it would clip** — the first real mix measured
  `max_volume -0.0 dB`, which is distortion, not loudness; measured, so a quiet mix is untouched.
  **Two narration sources, owner picks (2026-10-01)**: each line can exist twice — `recorded`
  (he read it) and `tts` (synthesised in his consented HJ voice clone via
  `POST /api/admin/demo-narration/tts` → `generateWelcome`). `demo_narration_takes` is keyed
  `(clip_key, line_index, source)` (`20260871`) so they coexist; the studio switches between
  them and publishes whichever is selected. ⚠️ **ONLY `voice_basis === 'self'` MAY BE PUBLISHED
  AS HIS VOICE** — `narrator` is the house voice and an absent basis is UNKNOWN, never
  optimistically self. The publish route **refuses** (`voice_basis_not_self`, 409) before any
  write, because the admin warning is a UI affordance and a direct POST bypasses it. ⚠️ HJ's
  error codes are surfaced verbatim — `voice_third_party` is the consent bright line and an
  operator needs that word, not "failed". ⚠️ **`welcome` is specified as a ONE-SHOT greeting**
  and we call it once per line; it bills per call, so the route caps at `MAX_LINES` and HJ were
  asked whether the usage is acceptable. ⚠️ **Blocked on a GRANT, not on env**: all three
  partner-audio vars have been set in production for 2+ months, but `partner_audio_grants` has
  **zero rows** — the owner mints a token in HJ's dashboard (`/dashboard/about-that` → the
  embed's card → `🔌 Connect QuickSites` → *Generate connection token*) and pastes it into
  `/merchant/audio`.
  ⚠️ **NEVER ASK WHICH EMBED — A GRANT IS MINTED PER EMBED AND THE SET OF RIGHT ANSWERS IS
  ENUMERABLE (2026-10-02).** The studio used to `window.prompt` for an embed id, which offers a
  value that is **wrong by default**: an owner has several embeds and types the one he has read
  most recently. On the first real run the grant was on *"Cornerstone — in Sandon's voice"*
  (`27eb5896…`) and the id typed was the homepage **In Your Voice** player (`4f90e68e…`, from
  `components/home/in-your-voice.tsx`) — same owner, same consented clone, different embed, so
  HJ returned `grant_embed_mismatch` and nothing synthesised. **`GET /api/partner/audio/connect`
  already lists exactly the embeds we hold active grants for**, so the studio resolves from it:
  none → say go mint one, one → use it silently, several → choose *from that list*. An id we
  hold no grant for is refused locally rather than round-tripped to a certain failure. Pinned by
  `app/admin/demo-narration/__tests__/grantEmbedSource.test.ts` — a **source guard**, because
  the defect is a UI offering a free-text field, not a wrong return value (verified to fail with
  the prompt restored).
  ⚠️ **READING THE EMBED FROM OUR OWN TABLE WAS NOT ENOUGH, AND BELIEVING IT WAS IS THE SAME
  BUG ONE LAYER DOWN.** `hj_embed_id` is **typed by hand when the token is pasted**, so our
  record can disagree with the embed HJ minted it on — and did: `partner_audio_grants` held one
  active row for `4f90e68e…` carrying a token minted on `27eb5896…`, so resolving "from the
  grants we hold" returned the wrong id *with full confidence* and failed identically on every
  run. **A stored value is only as good as the step that captured it.** So a grant error is now
  **fixable where it is reported**: the studio shows the connected embeds, takes a re-pasted
  token **beside** its embed id (the two are entered together or they can disagree from the
  start), and removes a wrong row. `GRANT_FIXABLE` opens that panel for *every* grant-class code
  — `grant_embed_mismatch` was missing from the old two-code check, i.e. the failure most likely
  to need a re-paste was the one offering no way to do it, and a page refresh clears the message
  but not the cause. ⚠️ It says **"Stored a grant"**, never "connected": storing a token proves
  nothing about whether HJ accepts it for that embed. ⚠️ Removing a row **does not revoke the
  token at HiveJournal** and the UI says so — a stale token left live there is still a bearer
  secret. ⚠️ Connecting here passes `attachToSite: false`; putting a player on a customer's site
  is a visible change to a live page, not a side effect of fixing narration.
- **⚠️ A VOICEMAIL IS TRANSCRIBED BEFORE ANYONE IS TOLD TO RELAY IT (2026-10-07).** A fax
  machine dialled covingtontow.com at 04:29, got the greeting, and left 21 s of CNG tone (0.5 s
  beep / 3 s silence × 6); the operator email said *"New lead … Relay it to a local business"*.
  `lib/ppl/voicemailSpeech.ts` runs the recording through Whisper via the meter (pricing row
  `openai:whisper:audio_stt`, ~$0.002 per voicemail) and the pure `classifyVoicemailSpeech`
  says `speech` / `no_speech` / `unknown` — pinned on the fax (music glyphs) and on Whisper's
  other no-speech tell (a leading prompt echoed back N times; so **no prompt is passed**).
  Result on `call_logs.voicemail_speech/_transcript` (`20260875`). ⚠️ **The route answers Twilio
  FIRST**: the claim is synchronous, transcription + notification run in Next's `after()`, so
  the caller is never left in silence waiting on a model. `no_speech` → the operator email says
  so and drops the "relay it" ask, the business is **not** texted "someone called"; `speech` →
  the email and the call-alert digest quote what they said; `unknown` keeps the "listen"
  wording — a failed transcription must never read as "nothing there". ⚠️ The parent-call status
  callback (above) proved itself on that same call: `ended`, 35 s, not `ringing`.
- **Inbound-call email alerts (2026-10-01)**: `/api/cron/call-alert` every 5 min emails
  `ADMIN_EMAILS` when a call lands in `call_logs`, so a real lead cannot sit unseen in a dashboard
  nobody opened (two did, on 2026-09-30). ⚠️ **Deliberately NOT in the Twilio webhook**: that
  handler must return TwiML fast enough to connect a human, and it fires on `ringing` before any
  outcome exists. ⚠️ **Three guards**: `alerted_at IS NULL` (dedupe lives in the row, `20260870`),
  a **lookback window** (the column was not backfilled, so without it the first run emails all 48
  historical calls), and a settle delay. ⚠️ **`alerted_at` is written only AFTER the send
  resolves** — marking first turns one transient Resend failure into a lead nobody hears about.
  ⚠️ **The email never says "answered"**: outcomes are `connected`/`brief`/`unanswered`, and a
  **voicemail-first call shows NO outcome line at all** — it never dials, so its status stays
  `ringing` and the classifier honestly reported "still in progress" on day-old calls,
  contradicting the "Sent to voicemail" line beneath it. `/status` gate: `call_alert`.
- **Guest build (unauthenticated draft sites)** — **LIVE in prod** (anonymous sign-ins enabled in Supabase; `NEXT_PUBLIC_GUEST_BUILD_ENABLED=1` set in Vercel production + preview). Env-gated by that flag (`lib/flags/guestBuild.ts`). Entry points: the homepage hero (`components/home/guest-start.tsx`) and `/build`. A logged-out visitor mints a Supabase **anonymous** session (`ensureGuestSession`), builds a draft template stamped `owner_id=<anon uid>` + `claim_source='guest_build'` (`app/api/templates/create|duplicate`) **seeded with a real industry starter** (hero / services / faq / contact + services + theme via `buildIndustryStarter` — the same scaffold as `/admin/templates/new`, so the editor opens a working site rather than empty/typeless placeholder blocks), and **auto-claims on sign-up** (the anon user upgrades in place, same uid → `owner_id` still matches). It **can't reach the homepage**: anon users are blocked from publishing (`app/api/templates/[id]/publish` → `needs_signup`), the showcase requires `published=true`, and `getShowcaseData` additionally drops any still-anon-owned row (`anonymous_user_ids` RPC). `middleware.ts` confines anon users to the template editor. **Abuse guards** (the load-bearing part): per-guest AI call cap (`enforceGuestAiLimit`, `GUEST_AI_CALL_LIMIT`) — on **every** AI route; per-IP guest-draft rate limit (`lib/rateLimit.ts` on `ratelimit_events`, `GUEST_DRAFT_HOURLY_LIMIT_PER_IP`); the dollar budget guard (`meterLLMCall`, keyed on `ai_usage_events.occurred_at`); and the `/api/cron/ai-cost-alert` watchdog (every 15 min) that emails `ADMIN_EMAILS` + raises a Sentry warning when rolling AI spend crosses `AI_ALERT_{HOURLY,DAILY}_USD` (with an anon breakdown via `ai_spend_report`). Note: image-gen routes (`/api/hero/generate-image`, `favicon`, `icon`) set `maxDuration = 60` — gpt-image-1 is slow (~20s at `quality:'medium'`) and would otherwise hit the default serverless timeout.
- **New-site email + "where they left off" (2026-10-05, owner)**: `/api/cron/site-created-alert`
  (every 15 min) emails `ADMIN_EMAILS` about each site a PERSON created ~30 min earlier, with the
  analysis from **one pure function, `lib/sites/siteProgress.ts#analyzeSiteProgress`**, which the
  Sites column on `/admin/users` renders as the same sentence (`↳ Built with AI (5 calls), no
  edits saved; saw the sign-up prompt, never opened it. Last activity 2 min after creation.`) —
  the inbox and the page cannot disagree. ⚠️ **Two axes, not one ladder**: WORK (created →
  generated → edited → published) and SIGN-UP (none → prompted → opened → submitted → email sent →
  account); folding them hides that 21 of 21 builders edited nothing AND never typed an email —
  two drop-offs, two fixes. ⚠️ **Counters, not observation**: `save_count` / `template_versions`
  are the only edit evidence (the version `diff` column is NULL on every recent row); the copy says
  "no edits saved", never "did nothing". ⚠️ **The owner is never emailed about himself**:
  `testTrafficReason` marks the operator, `+alias` test accounts of any admin email (18 of the
  last 18 signed-in creations were `sandonjurowski+tester2@`), and the demo recorder (by the name
  it types, `lib/demos/recorderIdentity.ts`, shared with `record-demo.mts` and pinned) — recorded
  in `site_creation_alerts` with a `skipped_reason`, shown as an amber chip on `/admin/users`.
  Dedupe lives in that table (migration `20260873`; a column on `templates` is blocked by the
  guard trigger and is not content anyway), marked AFTER the send. Machine sources
  (`listing_import`, `demo_seed`, `directory`, `operator_draft`, `persona_build`) are never
  candidates. `/status` gate `site_created_alert`. Tests: `lib/sites/__tests__/siteProgress.test.ts`.
- **⚠️ THE HERO BUTTON ON 109 PUBLISHED SITES RELOADED THE HOME PAGE (fixed 2026-10-10).** The
  scaffold's hero default was `cta_link: '/'` in THREE places (`defaultBlockContent.ts`, the zod
  normaliser and the zod schema default in `blockSchema.ts`), and the renderer read it as "go to
  page /" — so "Call Now" on vashon-electrical.com navigated to the page the visitor was already
  on. Older sites carried a `tel:` link and worked, which is why it read as per-site. Found by
  the owner clicking, in desktop Chrome; nothing errors when a button goes nowhere. The decision
  is now pure in `lib/sites/heroCta.ts`: `/` or empty → contact form; a contact jump whose label
  says "call" dials the resolved phone (hero `cta_phone`, else `phoneFromSite` — the geo sites'
  tracking number); a call with no number falls back to the form rather than hiding the button;
  ⚠️ **It took two PRs, and the second is the lesson (#1140).** #1139 read the phone from
  `templates.phone`, a COLUMN, and the public render serves a SNAPSHOT (`published_sites` →
  `template_versions.data`, or `snapshots.data` on a custom domain) which has no columns — so
  after it deployed, the live "Call Now" still went to `#contact` while the editor, which hands
  the hero the draft ROW, showed it dialling. `phoneFromSite` reads the column when present, else
  `data.meta.contact.phone` (where `pushTrackingNumberToSite` writes the number) and the other
  contact paths push walks. **Verify a renderer change on the served page, never in the editor.**
  author anchors, `tel:` links, real pages and explicit `cta_action` unchanged. Fixed in the
  renderer so every served site changed without a republish; defaults now seed `#contact`.
  Pinned by `lib/sites/__tests__/heroCta.test.ts` with source guards over all three defaults.
- **Rep pages, the starter kit, and the rep's one-click build (2026-10-08, built for Abdou on
  Vashon)**: a rep gets an unlisted `/for-<name>` page (pattern: `/for-angela`) whose
  no-website table is LIVE from `outreach_prospects` and carries **"Build their site"** per row
  (`components/for-rep/no-site-table.tsx` → `POST /api/rep/build-draft`), plus a printable
  **starter kit** at `/starter-kit/<code>` (`lib/starterKit/starterKit.ts`: cards 10-up, flyer,
  one "your website is ready" sheet per built draft in the city). ⚠️ **The build route is
  public but SIGNED, not admin-gated**: the rep usually has no account, so the page mints a
  30-day HMAC grant naming the code (`lib/rep/repActionToken.ts`); the route verifies it,
  requires the code to be active, throttles the IP, caps the code at `REP_BUILDS_PER_DAY`, and
  builds **only a parked prospect by id** with the prospect's own industry (never a name or
  URL the rep typed). ⚠️ **Every link it hands back carries `?ref=<code>`** (`lib/rep/repBuild.ts`)
  — middleware sets `qs_ref` from `ref` on any path, so attribution survives the preview and
  the `/go/` claim link; without it the rep does the work and is never paid. The prefilled SMS
  and every printed sentence are held to the claim-postcard forbidden list by test.
  **`/compare/toast` (2026-10-10)** — the island's restaurants mostly HAVE sites; the question is
  whether they take orders online and through whom (8 of ~35 on Toast, 4 on Square, ~15 none; a
  dated homepage read in `lib/vashon/restaurantOrdering.ts`, shown on `/for-abdou` in three groups:
  call / offer-a-site-only / leave alone). The comparison lives OUTSIDE the `[slug]` builder matrix
  because Toast is a POS, and its claim is a **break-even by volume, never "cheaper"**; vendor-read
  and third-party figures are separate objects on purpose (`lib/compare/toast.ts`, pinned by
  `toast.test.ts`, which also fails on any typed `$`/`%` in the page). See `docs/RESTAURANT_VERTICAL.md`.
- **Sign-in methods + the header's account corner (2026-10-03)**: `/login` is the ONE auth route
  (`lib/auth/authLinks.ts` — `signInHref()` / `signUpHref()`, never a literal) and offers
  **email+password** (LIVE; proven on prod with a throwaway confirmed user: wrong password → honest
  error, right one → `/api/auth/set-session` cookies → dashboard), **Google**, and magic link. The
  public `SiteHeader` now shows Sign in / Sign up (desktop + mobile sheet) and Dashboard / Sign out
  for a member; an anonymous guest is a visitor (their draft is upgraded in the editor's box, not
  from a marketing page). ⚠️ **"Continue with Google" is gated on the LIVE Supabase provider list**
  (`lib/auth/authProviders.ts` reads `/auth/v1/settings`, 5-min cache; public `/api/auth/providers`
  for client trees; `useAuthProviders()`), **not a build-time flag** — the flag it replaced had to
  be set AFTER the dashboard config and before a redeploy, three independent steps, and in eleven
  weeks none happened. `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` is only a kill switch (`0`). Fails CLOSED:
  an unreadable settings endpoint hides Google (a button that 400s is worse than none) and keeps the
  password form. **Still an OWNER action**: enable the Google provider in Supabase (runbook in
  `lib/flags/googleAuth.ts` + `docs/GUEST_SIGNUP_PLAN.md`; the dashboard cannot be driven headless).
  Pinned by `lib/auth/__tests__/authProviders.test.ts` + `components/site/__tests__/headerAuthLinks.test.ts`.
- **Anonymous-token security hardening (2026-07, PRs #102–#122)**: shipping guest build (an anon token is a *real authenticated user*) prompted an audit of everything an anon/authenticated token could reach, and a staged remediation. Shared auth gates now live in `lib/auth/requireUser.ts`; dozens of mutating routes were gated (including an unauthenticated `spawn`-RCE dev route, unauth Stripe-refund execution, an org-domain hijack, and a critical unauthenticated arbitrary-file-read). A privilege-escalation via self-written `user_profiles.role` was closed. Every RLS-disabled anon-writable table from the audit was locked — **deny-default** for service-role-only/sensitive tables, **scoped policies** for browser-written ones (`domains` public-read, `remix_events` owner-insert, `user_action_logs` authed append-only, `dashboard_layouts` authed), and **`public.sites` gained an `owner_id` column + owner-scoped RLS**. Webhooks verify signatures (Twilio added; Stripe/Lulu already did); public email/claim endpoints are per-IP rate-limited. The residual **redesign** follow-ups were closed 2026-07-09 (PRs #268–#274): `send-contact-email` now derives the recipient from `site_slug` server-side (#268, closes an open relay); the Lulu webhook **fails closed** in prod when its secret is unset (#269); `templates/base-name` writes are **owner-scoped** (#270); the public claim endpoints were hardened so no unverified body-derived privileged writes happen — `claim-site` (which had no callers) performs none, `claim/lead` validates email + template existence (#271); and the **domain-claim** path gained a full **email proof-of-control** flow behind `DOMAIN_CLAIM_VERIFICATION_ENABLED` (#272–#274 — see the *Domain-claim email verification* bullet above). The SMS **outreach site-claim** path already had verification behind `CLAIM_VERIFICATION_ENABLED` (see [`docs/CLAIM_VERIFICATION_PLAN.md`](docs/CLAIM_VERIFICATION_PLAN.md)).

- **Owner-voice narration — "In Your Voice" + "Hear this page" (2026-07-22)**: HiveJournal's **About That** narrated audio, positioned as **"In Your Voice"** (the owner's own consented voice = the moat). Two surfaces. **(1) In Your Voice** (PR #595): the `about_that` block is labeled "In Your Voice" in the builder (editor hype in `about-that-editor.tsx`), a **silent** copy is seeded into general/storefront/food scaffolds after the hero (`industryScaffold.ts`; renders nothing on the published site until an embed is set), and the homepage has a live tappable section (`components/home/in-your-voice.tsx`, default brand only) narrating the homepage via a dedicated consented-clone embed. **(2) Hear this page** (PRs #596–#598, **LIVE in prod**): a platform-default launcher on every public surface (`components/hear-this-page.tsx`, mounted once in `app/layout.tsx`), **house narrator, short-version (`summary`) only**, that **defers to** an owner In Your Voice player when one is already on the page. Master switch + billing gate = `NEXT_PUBLIC_HEAR_THIS_PAGE_ENABLED` (**flipping it on = QS-billed TTS renders**; house embed `1cda57cc` baked in; per-`(embed,content_hash)` cache + daily render cap). Super-admin per-surface config at `/admin/hear-this-page` (`lib/hearThisPage/*`, `site_settings.hear_this_page`), using HJ's `data-kinds` allowlist (**narrows-never-widens**, `AboutThatEmbed` `kinds` prop). A **mesh-wide standard** (PorchHearth rentals-first, DeckSketch `/compare`+landing, HJ own surfaces). **Honesty bright line:** the house narrator is always labeled as such; an owner/host's own voice is used only via a **consented clone**. See [`docs/HEAR_THIS_PAGE_PLAN.md`](docs/HEAR_THIS_PAGE_PLAN.md) + the `crosstalk/contracts/about-that-embed.md` contract.

- **Config health — rules 7/7a/7b of the adopted config standard (2026-07-27)**: **`lib/config/health.ts`** declares a `CONFIG_GATES` entry per feature whose behaviour depends on complete config — `{ key, enabledBy?, requires[], requiresAnyOf[][], breaks, degradeOnly }`. `instrumentation.ts` (Next's boot hook) evaluates them at startup and logs loudly when a feature is **enabled but incompletely configured** — the failure that keeps happening here (partner audio inert 5 days on 1 of 3 vars; a captcha silently off on an env-name mismatch). **Never throws** (a boot loop is worse than the report) and **reports presence, never values**, so it's safe to log and safe to serve. `breaks` must be prose readable at 3am — a boot log nobody can act on is a quieter silence. **`GET /status`** (rule 7b) answers "is it actually live?" from the running process: build SHA + `env_scope` resolved from the RUNTIME (never the DB) + per-feature ready/off/incomplete. **Coarse in public — never missing-key NAMES** (that's recon); `?detail=1` adds them for an admin session. No synchronous dependency probes on that route: a public endpoint pinging paid APIs is a cost/DoS amplifier — cron-cache them if added. **Rule 7a** is a *test* (`lib/config/__tests__/declarations.test.ts`), not a boot check, because it's a property of the source: every env key `app/lib/components` reads must be declared (`.env.example` or a gate) or excused in `INTENTIONALLY_UNCHECKED` **with a real reason** (placeholder reasons are rejected). It carries a **`KNOWN_UNDECLARED` debt baseline** (the count is pinned on `/testing` by `testingPageFigures.test.ts`, not written here — it shrinks whenever a key gets declared, e.g. 107→106 on 2026-10-03) — frozen, *not* an allowlist, with a "baseline only shrinks" test so it can't rot into one. Adding a feature that reads env? Add a gate. Standard: `crosstalk/contracts/config-registry.md` (ADOPTED).
- **Persona testing — HiveJournal personas as exploratory testers (2026-07-28, LIVE)**: HJ's backstoried, cost-capped browsing personas visit **public** QS surfaces with a first-time-visitor goal and report what they actually hit. Targets the *merged-looked-correct-silently-wasn't* class Playwright misses (it asserts what you told it to check). Receiver: `POST /api/persona-findings` (shared secret `PERSONA_FINDINGS_SECRET`, constant-time, **fail-closed 503**, 60/hr even when authenticated). **Three load-bearing rules:** (1) findings file at **`status:'triage'`, never `'open'`** — a persona finding is a CLAIM until a human agrees, enforced twice (the route hard-codes it *and* `admin_tasks_status_check` allows it via migration `20260808`); a body sending `status:'open'` is ignored. (2) Attribution is in the record — `source='persona-browse:<persona_id>'`, not a UI badge. (3) The **`honesty_note` is rendered verbatim** and never stripped: these are AI-persona observations, and the pitch is *"browse as real people **would**"*, never *"with real people"* — the same label-AI-at-creation standard as `voice_basis` and rule 9. Issues carry **`evidence`**: `searched_not_found` (an absence looked for) renders tagged `_(searched for, not found)_` because *"I couldn't find X"* is indistinguishable from *"I didn't look"*; `encountered` renders unmarked. Review at `/admin/tasks` — triage sorts **below** confirmed work so an unverified claim never outranks real work. **Our vantage is blind to a wrong secret** (the rate limiter runs *after* auth, so a 403 leaves no trace at all) — QS silence is not evidence; only HJ's `persona_qs_testing_tick` heartbeat `posted` flag catches a failed POST. Contract: `crosstalk/contracts/persona-testing.md`. First confirmed finding (`c130316f`) is why the homepage has an industries section.
- **Site backdrops — new sites are never flat (2026-07-26)**: every site gets a background layer instead of one flat color. **`lib/theme/backdrops.ts`** is the source of truth — a `style` + adjustable `intensity` persisted at `data.meta.backdrop`, rendered by the one chokepoint every site passes through (`components/theme/template-theme-wrapper.tsx`). Seven of the eight styles (`wash`/`mesh`/`aurora`/`grid`/`dots`/`paper`, plus `none`) are **pure CSS built from the site's own theme vars** (`--primary`/`--foreground`), so they cost nothing, render at first paint, and track the accent + light/dark automatically — **never hardcode a color in a backdrop** (CLAUDE.md §7 trap; the test suite fails on hex/rgb). New sites are stamped a per-industry default by `industryScaffold.ts` (`personal`/`author`→`paper`, trades→`grid`, food→`mesh`, …). Existing sites: the **free, bulk-safe** upgrade `lib/theme/applyBackdropUpgrade.ts` → `POST /api/admin/templates/apply-backdrop` (`{all:true}` supported *because* it's CSS-only; it never overwrites an owner's pick or a paid painterly one). **The 8th style, `painterly`, is the only one that spends** (~$0.04, gpt-image-1) — `lib/images/paintBackdrop.ts`, per-site `POST …/paint-backdrop` (no batch flag, deliberately). A lazily-filled per-industry **pool** (`lib/theme/backdropPool.ts`, target 25 ≈ $1/industry, storage-as-registry, no table) lets sites share paintings for free; **site creation only ever READS the pool** — filling is the `backdrop-pool-fill` cron, because gpt-image-1 takes ~20s and nobody may wait on it. Pool is **flag-gated OFF** (`BACKDROP_POOL_ENABLED`) and is a *declared* divergence from painterly-backdrop rule 2, bounded by the hard 25-cap. A missing/ungenerated backdrop renders **no layer at all** (rule 7). ⚠️ **The page surface is painted by `TemplateThemeWrapper`, NOT by anything inside it, and that is load-bearing.** The backdrop is an absolutely-positioned layer at `z-index:0` with content above it at `z-index:1`, so *any* opaque `bg-background` on the content side hides it completely. That shipped for weeks: `SiteRenderer` painted it **and** both public routes passed `className="bg-background text-foreground"` in on top (the served markup read the class twice), so **every site's backdrop rendered, cost its CSS, and reached no pixel** — a bug whose only symptom is the absence of decoration, which is exactly what a site with no backdrop is supposed to look like. Fixed 2026-08-13 + pinned by `components/sites/__tests__/siteSurfacePaint.test.ts`, which fails if any `SiteRenderer` call site passes a background fill. Note it took **three** edits, not one: fixing only `/sites/[slug]` would have left the custom-domain route (`app/host/[[...rest]]`) — most of the live fleet — still occluded.
- **⚠️ No generated people — network standard (2026-07-26)**: every AI-generated image in this repo must exclude people. Import the constants from **`lib/images/noPeople.ts`** (`NO_PEOPLE_INSTRUCTION` / `NO_PEOPLE_NEGATIVES` / `NO_PEOPLE_CLAUSE`) — **don't hand-write a "no people" string**, that's how the rule rots. Wired into all four image call sites: `app/api/hero/generate-image` (the `include_people` opt-in + its editor toggle were **removed**; a body still sending the flag is ignored, not rejected), `lib/rebuild/generateHero.ts`, `lib/builder/generateDemoSite.ts`, `app/api/dev/seed/_lib/heroHydrate.ts`. Why it's load-bearing and not taste: the listing-import pipeline auto-builds sites for **real, named businesses**, so a generated photo of staff/diners asserts people who don't exist on a page presenting as that business's own — the same class of dishonesty as mislabeling a narrator clip as the owner's voice. This is rule 9 of the mesh painterly-backdrop standard (`crosstalk/contracts/painterly-backdrop.md`, owner-adopted network-wide); the sibling rule for audio is `crosstalk/contracts/audio-honesty-standard.md`.
- **⚠️ NO MINOR'S VOICE, EVER — recorded or synthetic (2026-08-17)**: no owner-voice audio, no
  kid-recorded welcome, no cloned child voice, on any surface where a minor is the subject —
  `lemonyum.com` / `/lemonade-stands` above all. **A minor cannot give the consent a voice artifact
  requires**, so there is no consent chain to improvise: the person whose voice it is is not a
  person who can consent to its distribution. ⚠️ **This binds the REAL child's recording too, not
  just a clone** — the obvious "let the kid record the welcome" is a minor's likeness on a
  distributed, co-branded commercial artifact, and it is already over the line; a cloned child voice
  is merely worse. And the product does not need it: **a lemonade stand is a live, in-person moment
  and the child's actual voice is already there** — synthetic or recorded child audio adds nothing
  the moment doesn't provide while risking exactly the goodwill the channel runs on. Keep the
  child's voice at the stand, in person, never in the software. Symmetric with HiveJournal, who
  hold the same line everywhere minors touch a surface (Family Wall photo layer counsel-gated,
  child-facing products 18+, family little-ones never emailed) and asked for it in writing on both
  sides so neither can drift. Sibling rules: no generated people (above), and
  `crosstalk/contracts/audio-honesty-standard.md`.
- **Audio honesty (2026-07-26)**: no subliminal/inaudible/covert audio, ever — all audio is perceptible, attributed (house narrator always labeled; an owner's voice only via a consented clone with a reported `voice_basis`), and user-initiated. Canonical: **`crosstalk/contracts/audio-honesty-standard.md`** (shared-owned; link it, never fork it). Copy rule: never describe our audio as reaching someone "subconsciously" / "below awareness" / "while you sleep."

## 6. Architecture facts that will surprise you

- **The backend = Next API routes.** Nearly 500 `route.ts` files; most business logic is *inline in routes*, not in a service layer. A thin service layer exists only for commerce (`lib/commerce/*`, `lib/payments/*`). Extracting a standalone backend is the planned north star — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). **When writing new logic, put it in `lib/<domain>/` as a pure function and call it from the route** — this is how we incrementally earn the split.
- **Multi-tenant by org.** `middleware.ts` resolves host → org (`lib/org/resolveOrg.ts`), sets `x-qsites-org-*` headers, and rewrites platform/custom domains to `/sites/*` or `/orgs/*`. Default org via `DEFAULT_ORG_SLUG`.
- **Auth is Supabase SSR.** Clients are created in `lib/supabase/{server,admin,browser,middleware}.ts`. Platform-admin is resolved from `ADMIN_EMAILS` + the `admin_users` table (`getAdminUser()`); **`user_profiles.role` is no longer trusted for admin** — a self-writable-role privilege-escalation was closed, so `public.is_platform_admin()` now trusts only `admin_users`. There is no centralized auth middleware — routes gate themselves via the shared helpers in `lib/auth/requireUser.ts` (`requireAdmin` / `requireUser` / `requireMerchantOwner` / `requireOrgAdmin` / `requireCompanyMember`) + `requireTemplateOwner`. **Anonymous (guest) sessions are real authenticated users** (`getUser()` returns them) — `requireUser()` rejects them unless `{ allowAnonymous: true }`. Gate every new non-public route.
- **RLS is real on commerce tables** (see `supabase/migrations/20250827_open_commerce.sql`) and a 2026-07 hardening sweep locked the remaining anon-writable public tables (money/report/`site_merchants`/`sites`/`domains`/`user_action_logs`/… — deny-default or owner-scoped policies). But most app queries use the **service-role key** server-side and bypass RLS, so **route-level authorization is still load-bearing** — don't assume RLS protects you in an API route. Per-IP abuse throttle for public endpoints: `lib/api/rateLimitGuard.ts#rateLimitOr429`.
- **Secrets are read ad-hoc** via `process.env.*` with string-default fallbacks; there's no validated env loader yet (a planned cleanup).
- **AI/LLM calls are metered** via `lib/ai/meter.ts` (`meterLLMCall`): budget guard + cost logging + PostHog mirror. Rollout is **complete** as of 2026-07-04 — every OpenAI inference call-site (chat/image/embeddings) routes through the wrapper, incl. the shared embedder (`lib/useVectorDB.ts#embedText`) and the admin dev-seed tooling. See [`docs/LLM_METERING.md`](docs/LLM_METERING.md). Don't call OpenAI raw in new code; use the wrapper.

## 7. Conventions

- **TypeScript, no `any` in new code.** `tsc --noEmit` is green — keep it green.
- **API routes**: `runtime = 'nodejs'`, `dynamic = 'force-dynamic'` is the norm (Supabase service role needs Node). Use the response helpers in `lib/api/json.ts` and prefer the Zod validation wrappers in `lib/api/withInputOutputValidation.ts` for new endpoints.
- **New business logic → `lib/<domain>/`** (pure, testable), thin route on top.
- **Money in integer cents**, never floats. Match the schema (`*_cents`).
- **Cron** endpoints live under `app/api/cron/*`, registered in `vercel.json`, auth'd by `isCronAuthorized` (`x-cron-secret`/`CRON_SECRET` or Vercel's `Authorization: Bearer`). Wrap the body in `runCron(job, …)` for `cron_runs` logging.
- **DB migrations are tracked** in `public.schema_migrations` via `scripts/db-migrate.mjs`. ⚠️ **Applying DDL is not the same as the API serving it** — Supabase's PostgREST layer caches the schema and the JS client talks to THAT, not to Postgres. A migration can report `done`, the index can be visibly present in `pg_indexes`, and the very next `.upsert(…, { onConflict })` still fails with *"there is no unique or exclusion constraint matching the ON CONFLICT specification"*, naming a constraint that exists. It cost a real recording on 2026-10-01. `db:migrate:up` now issues `notify pgrst, 'reload schema'` after a successful run (best-effort — a migration that applied is applied either way; on failure it prints the command). Reach for it by hand after any out-of-band DDL. Add a `supabase/migrations/<ts>_name.sql` file (idempotent DDL: `if [not] exists`), then `npm run db:migrate:status` to see pending and `npm run db:migrate:up` to apply (each runs in one transaction and is recorded on success — never hand-apply with `psql -f` or the ledger drifts). `status` also flags checksum drift + orphaned records. Needs `SUPABASE_DB_URL`.
- **New sites/templates default to `color_mode: 'dark'`.** Creation + render fallbacks all default dark; set `color_mode: 'light'` explicitly to override.
- **⚠️ The app chrome is ALWAYS DARK — never hard-code light colors on a new page.** `app/providers.tsx` wraps every page in `<ThemeScope mode="dark">`, which puts `.dark` on `<html>` **and** `data-theme="dark"` on a wrapper div. A page styled with literal light utilities (`text-zinc-900`, `bg-white`, `border-zinc-200`, `bg-zinc-50`) therefore renders **dark-on-dark text and white cards on a near-black page** — a bug that never shows up in `tsc`, only in a screenshot. This has bitten `/walker` + `/gigs` + `/gigs/[id]` (fixed) and `/tools/route-planner` (#553). ⚠️ **And once in the opposite direction, from a SHARED COMPONENT rather than a page** (#665): `SectionShell` — the wrapper nearly every rendered block sits in — defaulted to a hard-coded `text-white`, and **all eleven call sites relied on that default; none passed the prop**. So every block painted white text regardless of the *tenant site's* theme, which is invisible while sites are dark and makes the whole block disappear on a light one. Found on a published résumé page showing 40 bullet points with no text beside them — the skills were all in the DOM and `innerText` returned them. Two lessons: a tenant site is **not** always dark (only the admin chrome is), and the fix was to emit **no** colour rather than a different one, because `text-white` and `text-card-foreground` have equal specificity so the winner is decided by Tailwind's compiled order, not the class attribute. Rules:
  - **Use the semantic tokens** from `styles/globals.css` — `text-foreground` / `text-muted-foreground` / `bg-card` + `text-card-foreground` / `border-border` / `bg-muted` / `bg-background`. They key off the `[data-theme]` wrapper, so they're correct **at SSR / first paint**.
  - **Prefer alpha tints for colored accents** (`bg-emerald-500/10`, `border-indigo-500/30`) over 50/100-weight fills (`bg-emerald-50`) — a tint reads on either theme.
  - **Tailwind `dark:` variants work, but only after hydration** (`darkMode: ['class']` → the `.dark` class is added in a `useEffect`), so use them for shade *refinement* (`text-emerald-700 dark:text-emerald-300`), never as the only thing keeping text legible.
  - A page with its **own** light/dark toggle must use explicit `t(light, dark)` concrete-class ternaries, **not** `dark:` utilities — the global `.dark` would pin them on and defeat the toggle (see the comment at the top of `app/tools/route-planner/route-planner-client.tsx`).
  - **Check before shipping a new page**: `grep -nE 'text-zinc-(700|800|900)|bg-white(\b[^/-]|$)|border-zinc-(200|300)|bg-(zinc|slate|gray)-(50|100)(\b[^/-]|$)' <file>` should come back empty, and eyeball it in the browser — dark is what every real visitor sees. ⚠️ **The `[^/-]` guards are load-bearing — they make it mean OPAQUE.** The original version used a plain `\b`, which flags `bg-white/90` and `hover:bg-white/20` because `/` is a word boundary — i.e. it cried wolf on the *alpha tints the rule immediately above recommends*. Two correct block renderers failed it (a slider divider, some editor hover states) the first time it was run repo-wide. A check that fires on correct code is worse than no check: it trains you to skip the output, which is the same silence-looks-like-success failure as a permanently-red CI row. Enforced as a test over every block renderer in `components/ui/__tests__/sectionShellColor.test.ts` (which also asserts it scans a non-empty file set, since a sweep matching nothing reports success).
- **Local assets are CI-checked.** `npm run verify:assets` (blocking in CI) fails the build when a component references a file missing from `public/`, or one absurdly large for where it renders. A missing image never throws — Next renders alt text or nothing — so **graceful degradation and silent failure are the same mechanism seen from two sides**; its first run found six assets 404ing in production, including the **default OG image**. It fails if it matches *zero* references (a scan that silently matches nothing reports success), and `--selftest` spawns the script against fixtures and asserts its **exit code**, so a guard that is defined but never wired in fails the build instead of being blessed by the check it was meant to strengthen.
- **Conventional commits** (`npm run commit` / commitlint). NOTE: current history is squashed to `📦 g` placeholders — start writing real messages.
- **`main` is ruleset-protected** (added 2026-08-04, when the repo went from one writer to two — see [`docs/contributing/`](docs/contributing/)): PR required with **1 approval**, plus no force-push, no deletion, no merge commits. As the solo owner-admin you **will be blocked** by the approval rule, and the bypass is deliberately not silent — merge with **`gh pr merge --squash --admin`**, which exercises it explicitly and records that rules were bypassed. A `write` contributor has no bypass and genuinely needs a review. ⚠️ **`GET /branches/main/protection` returns 404 even so** — that endpoint cannot see rulesets, and reading its 404 as "unprotected" is a mistake this repo has already made once. Check **`GET /rulesets`**.

## 8. Known debt / traps (don't trip on these)

- Duplicate/legacy files were purged (2026-07-04): `lib/create-default-block-RESOLVE-DUP.ts`, `lib/blocks/_likely-remove_*`, `vercel.json.bak`, `page-v0.tsx`, and the dead `app/examples/blocks-demo` page (rendered a retired-vertical block through a removed renderer) are gone. If you see a reference to any of them, it's stale.
- `app/api/deploy-webhook/route.ts` is effectively disabled (commented).
- **`templates.base_slug` / `is_version` are trigger-maintained, not generated (fixed 2026-07-29, migrations `20260809`+`20260810`).** They *were* generated columns keyed on `'(-[A-Za-z0-9]{2,12})+$'` — "a trailing `-token` means this row is a variant" — which cannot tell a random suffix from a real word and stripped **every** trailing token. So `renton-plumbing` and `renton-restaurant` both based to `renton`, and 2427 of 2531 rows were `is_version=true` including every canonical. Effects: the admin list collapsed all of a city's industries into one family (opening a site gave an editor titled with a different business), and `app/api/templates/[id]/publish`'s canonical lookup (`base_slug` + `is_version=false`) could resolve **zero** rows for any geo site. Now: `public.base_slug_of()` strips **one** trailing token of **4–5** `[a-z0-9]` chars — the shape the app's own `Math.random().toString(36).slice(2,7)` suffix produces — and `trg_templates_set_base_slug` maintains both columns on write. **`is_version` is deliberately three-state**: `NULL` for a slug-less row (it can't be canonical — there's no URL to be canonical at), `true` for a version, `false` for the canonical. Setting it `false` for slug-less rows gave families up to 10 canonicals and broke `.maybeSingle()`. ✅ **Residual FIXED 2026-08-28 (`20260834`)**: a 4–5 char real word was indistinguishable from a random suffix, so `<city>-hvac` based to `<city>` and the trigger filed it as a *version of a family with no canonical* — which made the publish lookup `(base_slug, is_version=false)` resolve **zero** rows. **19 of 95 geo sites were unpublishable through the UI**, failing with "Canonical not found". `base_slug_of()` now carries a derived allowlist (`hvac, glass, goods` observed in the fleet + the remaining 4–5 char tails `INDUSTRY_DOMAIN_WORD` can emit). 24 rows backfilled; all 95 geo templates are canonical again. ⚠️ **`demo` is deliberately NOT allowlisted** — every `<name>-demo` shares its `template_name` with an existing canonical, so it really *is* a variant; a first pass allowlisted it and `templates_template_name_canonical_uniq` refused the backfill. **Three kinds of trailing token look identical to a regex: a random suffix, a real word, and a deliberate variant marker — only the middle one is a bug.** Pinned by `lib/templates/__tests__/baseSlugRealWords.test.ts`. Adding an industry whose domain word ends in a 4–5 char segment? Add it to the allowlist too. The columns were converted with `ALTER COLUMN … DROP EXPRESSION` (in place) precisely so the 5 dependent indexes and 4 dependent views survived untouched.
- **Direct `UPDATE`s to `templates` are blocked** by the `app.guard_templates_update` trigger ("Use app.commit_template()") — **including the publish pointer**, verified 2026-08-19. Go through the sanctioned RPCs (`app.commit_template`, `app.set_template_slug`, or **`public.publish_template_demo`**), or `set_config('app.bypass_template_guard','on', true)` inside a txn for one-off SECURITY DEFINER work. INSERTs are fine.
  - ⚠️ **`publish_site` IS BROKEN — do not reach for it.** It exists in *both* the `public` and `app`
    schemas and appears in no tracked migration, so it looks like the intended path; calling it
    raises **`relation "app.snapshots" does not exist`**. A callable RPC that throws on a missing
    table is worse than an absent one, because its presence reads as sanctioned. This line used to
    recommend it. **The working publish is `public.publish_template_demo(uuid)`** — a misnomer: it
    is the generic helper (fresh `template_versions` snapshot → upsert `published_sites` → set the
    bypass → flip `published`), stamps nothing demo-specific, and is granted to `service_role`.
  - ⚠️ **The admin Publish button WORKS — verified by a real click 2026-08-28.** `Save & Publish`
    calls **`/api/admin/sites/publish`**, which upserts `published_sites` (what the renderer serves);
    the site goes live. The long-standing suspicion that it was broken was **wrong**, and the check
    that "confirmed" it was pointed at the wrong route — a §9 wrong-instance failure that read
    exactly like an all-clear. The tell was in the data: the snapshot a real click produced had
    `commit_message: null`, which neither publish function writes.
    The one real gap was that this path never set `templates.published` — read by the showcase,
    three paths in `site-routing`, `countBillableSites` and the SEO coach — so a site could be live
    to visitors and invisible to us. Fixed (#866) via the RPC below. **Scope was 3 of 141**, not
    systemic; the "17 of 439" figure is NOT explained by this and that guess should not be repeated.
  - ✅ **`app/api/templates/[id]/publish` was genuinely broken AND has ZERO callers (dead route).**
    It performed exactly the write the guard rejects; running
    that statement in a rolled-back transaction raises
    `Direct updates to templates are blocked. Use app.commit_template().` It was **not** silent —
    the route returns `upErr.message` as a 400 — so the button failed loudly with a raw Postgres
    string, and every published site in the fleet got there via `publish_template_demo` from a
    script. It took three days to check because "the button is broken" reads as implausible.
    The fix is **`public.publish_template(p_template_id, p_version_id, p_actor)`**
    (migration `20260833`, service-role only), which the route now calls.
    ⚠️ **Flipping `templates.published` would NOT have been enough on its own.** The public render
    serves the snapshot in `published_sites`, so a route that only set the flag yields a site marked
    published with nothing to serve — a *worse* failure than the 400, because it looks like success.
    The RPC mints (or validates) the snapshot, upserts `published_sites`, then flips the pointer
    inside the bypass. A caller-supplied `p_version_id` is checked to belong to that template:
    publishing another template's snapshot would serve one site's content at another site's address.
    Pinned by `app/api/templates/__tests__/publishGuard.test.ts`, which fails if the route ever goes
    back to a direct `.update()` — invisible in TypeScript, since only the database objects.
- **⚠️ NEVER EDIT TEMPLATE `data` BY PATH — the same content lives in three places.**
  `.pages[].content_blocks[].content` · `.pages[].blocks[].content` · `.pages[].blocks[].props`.
  A path-specific edit updates one copy, reports success, and leaves the renderer possibly reading
  another. `b7ac93c1` fixed this for the résumé repoint script; the geo publish script hit it a week
  later anyway — its first pass reported "16 promises reworded" while **15 of 29 templates still
  carried them**, and going structural revealed the true counts were roughly double (26 blocks, 70
  strings). The lesson is not "remember the second array": **walk the whole tree** (see
  `scripts/publish-geo-campaigns.mjs#walkStrings` / `stripTestimonialBlocks`), so a fourth copy
  appearing later cannot defeat the sweep.
- **Live-claim hygiene (2026-09-07): three scripts, three buckets, zero real claims.** Auto-built
  sites used to assert facts only an owner knows (24/7, "licensed & insured", 30-minute ETAs,
  guarantees) under names of businesses we never spoke to. `scripts/audit-live-claims.mjs` (read-only)
  reports **three buckets, not one number** — real claims / pricing *invitations* in marketing copy
  ("Get a free quote", kept by #906's decision because it is the CTA button beside it) / reader advice
  the regex cannot tell from a claim ("Battery Age Over 3 Years"), excused by name with a reason in
  `lib/rebuild/liveClaimRewrites.ts` — and prints three of the strings each bucket counted. Fixes:
  `scrub-live-claims.mjs` (#906) REPLACES FAQ answers and trims subheadlines; `rename-live-claims.mjs`
  applies the hand-read rewrite map for what a filter cannot do — service names, headings, blog prose,
  the scaffold's "Why choose us" bullets (**the scaffold itself emitted "Licensed & insured" for every
  split-layout site**; fixed at source + 24 `starter-*` seeds), and a literal `[Your Company Name]`
  that shipped inside blog posts on three live custom domains (filled only for slugs with a known name;
  the script refuses to guess). Both write through `scripts/lib/republishTemplate.mjs`, which carries
  the legacy `sites` snapshot repoint without which a custom domain never changes. ⚠️ Two traps: a
  rewrite target must stop at a **tag boundary** — `for <strong>24/7 towing…` never contains
  `for 24/7 towing…`, and the first apply missed 20 strings on 2 sites that only the re-audit caught;
  and the script lists every map entry with its match count, because an entry that matches nothing is
  a silent no-op. Re-derive, never remember: `npx tsx scripts/audit-live-claims.mjs`.
- **⚠️ A `geo_industry_campaigns` row is NOT a domain we own (found 2026-09-08).** `domain_status
  = 'attached'` means attached to the Vercel project — which needs no purchase — and **60 of the 100
  campaign domains had never been registered** (RDAP: no record). The plan said "100 geo domains",
  the operator panel "Domains held 100", and the queue planner ranked ten cities on "+50 we own
  belmont-towing.com", a domain that does not exist. Now: the nightly `gsc-backfill` classifies
  every Vercel domain (registered through Vercel, or delegated to nameservers → real) and writes
  `domain_status='unregistered'` back; `planEvidence.geoDomainsOwned` counts only
  `registered`/`attached`; the planner's ownership bonus needs the same. Before trusting "we own
  X": `curl -sL https://rdap.org/domain/X` — a 404 means nobody does. The same afternoon found
  the GSC backfill had **five** things wrong on our side, each of which read as "the owner's
  re-consent didn't work": the callback 404'd (and discarded) a grant from an account with no
  properties; the operator token was picked by freshest *expiry*, which the daily rank reads bump
  on every old read-only row, so a new grant lost the tie twice; and "in Vercel's domain list" was
  taken for "has a DNS zone". `app/api/gsc/__tests__/oauthCallback.test.ts` and
  `lib/gsc/__tests__/backfillZones.test.ts` pin all of it.
- Stripe Connect onboarding is consolidated on `payment_accounts` (fee config = `platform_fee_percent`/`collect_platform_fee`/`platform_fee_min_cents`). The legacy `merchant_payment_accounts` table + bps fee columns (`merchants.default_platform_fee_bps`, `sites.platform_fee_bps`) were retired in `supabase/migrations/20260701_retire_legacy_connect_bps.sql`. See [`docs/MONETIZATION.md`](docs/MONETIZATION.md).
- Large artifacts (`quicksites-export.zip`, `get-pip.py`, `.tsbuildinfo`, lint reports) and dead dirs (`_pages-legacy/`, `_deprecated__domains/`, `_deprecating_sites/`) were removed from git in the cleanup milestone — the tree is clean of them today.
- Two `admin/` locations: `app/admin/` (UI) and a top-level `admin/` (libs/tooling, incl. the master block schema). Don't confuse them.
- **`public.sites` is a legacy/secondary table** — the live content model is `templates`. Most `sites` rows are orphaned (131 rows, ~105 with no `owner_id`); it gained an `owner_id` column + owner-scoped RLS in 2026-07 (public read, writes scoped to owner/admin). Build new features on `templates`, not `sites`. Its old write routes (`/api/sites/save`, `/api/sites/create`) referenced columns that never existed and were effectively dead until repaired during the RLS work.
- **`types/supabase.ts` was regenerated** (commit `2c8dd6c`, "align @supabase versions + regenerate full DB types") — the old "88-table, commerce-absent, ~1000-`never`-errors" trap is **resolved**. The `@supabase/*` versions are now aligned (`supabase-js` 2.108, CLI 2.109), so the CLI output no longer resolves to `never`; `tsc --noEmit` is green. The file now types **164 of the 168 live public base tables** (+ views), commerce included. Still missing (added after that regen): `print_orders`, `site_settings`, `stock_reservations`, `schema_migrations`, and the CRM tables `customers` / `crm_campaigns` / `crm_campaign_sends` (+ the new `orders.customer_id` / `customers.notes` columns) — verified against the live DB 2026-07-07. Their absence is low-impact: the routes touching them use the **service-role `createClient(...)` untyped** (no `<Database>` generic), so they don't consume these types anyway. To finish the last few: `supabase gen types typescript --schema public` — needs either Docker (for `--db-url`) or a `SUPABASE_ACCESS_TOKEN` (for `--project-id`); neither is available in a headless session, so it's a "run it locally" chore. When a service-role query's columns matter, verify against the live DB (`psql "$SUPABASE_DB_URL"`), not this file.

## 8b. Crosstalk (the mesh session mailbox)

Cross-product coordination with sibling Claude sessions runs through the file
mailbox at `~/Desktop/_SilverLamp/crosstalk/` (protocol: its `README.md`). This is
**one of four coordinated sessions**: **QuickSites** (this repo) · **HiveJournal**
(`../hivejournal-2026`) · **DeckSketch AI** (`../deck-builder`) · **PorchHearth**
(`../deliveredmenu` — the *product* delivered.menu/PorchHearth; note `delivered.menu`
the *domain* is our own restaurant deliverable, a different thing with a similar name).
Our inbox: `crosstalk/inbox/quicksites/`.

**Set your identity every session:** `export CROSSTALK_SELF=quicksites` before any
`bin/crosstalk send` (or pass `--from quicksites`). The helper's legacy sender-guess
only resolves the original HJ↔QS pair, so without this a 4-way send is **mis-stamped
as from hivejournal**. Send: `CROSSTALK_SELF=quicksites crosstalk/bin/crosstalk send
<peer> "<subject>" -f <file>`. **Ack, never delete, AFTER acting** (`bin/crosstalk ack
<path>`) — the inbox is a live to-do list, not a read log. When doing cross-product
work, arm the persistent inbox Monitor from the README loop.

- **Cross-product API specs live ONLY in `crosstalk/contracts/*.md`** — the single
  source of truth; repo docs link there, never fork a copy (that's how drift starts).
- **Common owner/task deep links** are indexed in `crosstalk/deep-links.md` (a shared
  per-product registry) — look there before hand-writing a "navigate to X → click Y".
- **Write only this repo + the crosstalk folder.** Sibling repos are **read-only** —
  read them freely (answering an API question from their source beats a round-trip),
  but a change you want on their side is a **message, never an edit.**

**Standing sanction (owner, 2026-07-16; extended to DeckSketch 2026-07-17, PorchHearth
2026-07):** the owner runs 100% of the code and calls all product shots across the mesh
— so the sessions share one standing pre-approval. Scope/sequencing agreed through
crosstalk is pre-approved, and sessions may co-develop new ideas incl. brand-new product
offerings without pausing for permission. Still surface to the user first (universal
carve-outs): spending real money, deleting data, publishing externally — these matter
doubly on DeckSketch, which has other equity holders even though the owner directs the
work. (Operational authority, not equity split, governs what a session may act on.)

## 9. For AI agents specifically

- Prefer editing `lib/<domain>/` pure functions over inflating route handlers.
- Before adding an integration, check §2 — it's probably already a dependency.
- The authoritative data model is **`supabase/migrations/*` + `types/supabase.ts`**, not any prose doc.
- When unsure whether code is live, check for the legacy markers in §8 and grep for imports before assuming.
- Keep `tsc --noEmit` green; run `npm run typecheck` after non-trivial changes.
- **⚠️ Say which half you checked.** The most repeated failure across this repo and the mesh is *a true observation plus an unverified inference, reported as one thing* — arriving with identical confidence, because the checked half really was checked. Five instances across three products in two days, e.g. *"we flatten the ingredient structure"* (read the source ✓) *"so fixing it unblocks the shopping list"* (never checked — that consumer reads a different table). So mark it, in PR bodies, messages and comments:

  > **Verified:** `parts.join(' ')` discards the structure (read the source).
  > **Assumed:** that `shopping-list` consumes it — I did not check.

  Four things make it work:

  1. **`Assumed:` carries the value.** A wrong *observation* fails loudly — whoever owns that code corrects it. A wrong *inference* fails silently, because it doesn't look like a claim, it looks like the conclusion, and it gets built on.
  2. **`Verified:` must state SCOPE, not just that checking happened** — that's where over-claiming hides. *"I grepped rather than remembered"* can be perfectly true and still be a single-directory search reported as a repo-wide conclusion. `Verified: X` invites trust; `Verified: X (grepped lib/ only)` invites the correction. The checked half only fails loudly if the reader can see how far the check reached.
  2b. **State WHICH INSTANCES the check covered, not just how far it reached — a clean result only clears what you actually sampled.** This is a distinct species from the scope failure below, and it is worse because nothing about it feels like a guess. On 2026-08-02, told to check whether QuickSites pages server-render, I checked the marketing pages, got `h1=1 a=83`, and nearly reported "clean — hypothesis doesn't apply." Every part of that was **verified and true**. It was true about the pages nobody was asking about: the ranking claim was about the sites we build for *customers*, and those were serving `h1=0 a=0 p=0` — an empty shell to every crawler. A verified check, pointed at the wrong instance, reads exactly like an all-clear. PorchHearth made the identical error the same week (they sampled the pages they happened to be editing) and named the generalisation: **the sample is chosen before you know the answer, usually by convenience** — "the URL I type most often", "the file I have open". That is the wrong selection rule for any claim about a population. So: name the instances, and ask which instance the CLAIM is about before choosing them. `Verified: renders SSR (marketing pages only — tenant sites untested)` would have caught it in one line.
  3. **Be strictest about other people's code.** Across a repo boundary, verifying costs most exactly where your priors are worst, which is why most instances cross one.
  4. **Label the inference that supports your conclusion.** Every instance ran toward "and therefore my point stands," never toward "and therefore I'm wrong." That asymmetry is **locally rational, not lazy** — checking an inference that would undercut you has a clear payoff, while checking one that supports you either teaches you nothing or costs you the point. Incentives produce it, so it needs a structural habit rather than more diligence.

  ⚠️ It does not work retroactively, and the tempting version of a wrong claim is usually the one that makes the point more sharply. When a check would change what you'd report, run it *before* reporting — including against the live surface, not just the DB row (the renderer serves the published snapshot, not `templates.data`).
- **⚠️ An "ignore X" note must name the condition that would make it false.** A standing
  instruction not to look is the most expensive thing this file can contain, because ignoring it
  becomes the *diligent* act — you are following the runbook. On 2026-08-05 a memory reading
  *"CI runs Node 18, verify locally, not from CI"* outlived its condition by weeks: CI had been
  fixed, `build-and-test` was reporting a **real** failure (an undeclared `AGREEMENT_TOKEN_SECRET`),
  and five PRs were merged straight through it with `--admin`. It was found by accident.
  A *remembered* "that's always red" still costs a flicker of judgement each time; a *written* one
  removes even that, and nothing re-checks a document against the world.
  So: state the falsifying condition, or you are not recording a fact — you are installing a blind
  spot with a citation on it. (Convergent with PorchHearth's §12; crosstalk 2026-08-05.)
  Audited the same day: the three "corpse" directories above were already gone; the purged-files
  list in §8 is still accurate. ⚠️ That same audit also recorded "`ROUTER_STRATEGY.md` is still
  stale" — **which was wrong**, and wrong in the way this very section warns about: the file had
  been correct since 2026-06-30, and the grep matched the sentence in it that *disavows* the old
  claim. Corrected 2026-08-18; see §4. An audit that re-runs a badly-chosen check re-confirms the
  original error and stamps a fresh date on it.
- **Keep docs + public surfaces in sync in the same commit** (a mesh-wide rule — HJ + DeckSketch codify it too): when you change a feature, update its doc/this file/the relevant `crosstalk/contracts/*` in the *same* PR. A stale doc is worse than a missing one. When you notice a doc contradicting the code, fix or delete it rather than working around it.
