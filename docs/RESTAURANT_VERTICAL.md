# QuickSites — Restaurant Vertical

> How a restaurant goes from a pasted URL to a working online-ordering site that competes with Toast / ChowNow / DoorDash storefronts — and how the money path stays tamper-proof.
> Companion to [`../CLAUDE.md`](../CLAUDE.md) (§5b, §6), [`RESELLER_GTM.md`](RESELLER_GTM.md), [`MONETIZATION.md`](MONETIZATION.md).
> Built 2026-07-05 (PRs #164–#176). Last verified: `tsc --noEmit` + `next build` + full unit suite green.

---

## 1. What it is

Paste a restaurant's existing website URL into the [AI rebuild tool](RESELLER_GTM.md) and QuickSites produces a **menu-forward ordering site**, not a brochure. The full funnel:

**Convert → real menu (photos · sizes/options · add-ons · tags) → confirm prices → catalog products → Connect Stripe → Add to order → cart → checkout → platform take-rate.**

Plus the mobile essentials a diner expects: tap-to-call, directions, an embedded map, real hours, and a sticky mobile order bar.

The wedge (see [`MONETIZATION.md`](MONETIZATION.md)): every order runs the platform fee — the model neither Toast nor a flat-fee site builder monetizes the same way.

## 2. The three restaurant blocks

All three are full block types, wired through every registration point (`admin/lib/zod/blockSchema.ts` schema map + `types/blocks.ts` `BLOCK_CATEGORY` + `lib/blocks/defaultBlockContent.ts` + `lib/createDefaultBlock.ts` + both render registries `lib/renderBlockRegistry.ts` / `lib/blockRegistry.tsx`).

| Block | Renderer | What it does |
|---|---|---|
| `menu` | `components/admin/templates/render-blocks/menu.tsx` | Mobile-first menu: sticky category chip-bar (jump-to-section), sections of items with price rows, photos, tags, **choose-one option selector**, **multi-select add-on checkboxes**, and "Add to order" (variant + add-on aware). |
| `location` | `render-blocks/location.tsx` | Address, big **tap-to-call** phone (`tel:`), **Get Directions** (maps link), optional keyless Google Maps embed. |
| `order_bar` | `render-blocks/order-bar.tsx` | Mobile-only sticky bottom bar (Call + View Menu → smooth-scroll to the menu). Self-hides when nothing is actionable. |

The `menu` block has a dedicated editor: `components/admin/templates/block-editors/menu-editor.tsx` (registered in `block-editors/index.ts`). It authors sections/items/photos/options/add-ons/tags and hosts the **Enable ordering** flow.

## 3. The food scaffold

`lib/builder/industryScaffold.ts` — `FOOD_INDUSTRIES = { restaurant }` builds `[hero, menu, location, hours, faq, contact, order_bar]` (hero CTA → "View Menu") instead of the generic services brochure. Non-food industries are unchanged.

## 4. Conversion — how the real menu gets extracted

The rebuild pipeline (`lib/rebuild/*`, driven by `POST /api/rebuild`):

1. **Scrape** (`scrapeSite.ts`) — the homepage, capturing all in-page links.
2. **Follow menu subpages** (`scrapeMenuPages`) — a restaurant's menu almost always lives on `/menus/breakfast`, `/menus/lunch`, … not the homepage. Follows up to 6 **same-origin, menu-like** links (`menu|breakfast|lunch|dinner|drinks|…`), SSRF-guarded + capped, returning their text.
3. **Infer** (`inferSiteSpec.ts`) — one metered AI call turns the scraped text + menu pages into a structured spec: business/industry/copy **plus** `menu` (sections → items → name/description/price), `contact` (phone/address/email), and `hours`. Cleaned by `parseMenu` / `parseContact` / `parseHours` (drop-empty, validate email + `HH:MM`, dedupe days) so a half-hallucinated result never reaches a block.
4. **Assemble** (`assembleDraft.ts`) — injects the extracted menu into the `menu` block, contact into `location` + `order_bar`, and hours into the `hours` block.

**Verified live** against `jayberryscafe.com`: follows 5 menu pages → Breakfast/Lunch/Dinner/Drinks sections, real phone/address → map + directions, Mon–Sun hours.

**Smoke test**: `npm run smoke:rebuild -- <url>` (`scripts/rebuild-smoke.ts`) prints every stage incl. the extracted menu, no DB write. See [`REBUILD_SMOKE_TEST.md`](REBUILD_SMOKE_TEST.md).

## 4b. No-website ingestion (listing import / CedarSites)

Many target restaurants have **no website** — only a Google/Yelp listing (surfaced by "no website" lead tools). They can't be converted from a URL, but the *rest* of the pipeline is identical: only the ingestion source changes.

- **Listing → spec** (`lib/rebuild/importListing.ts`): `fetchGooglePlace(placeId)` (Google Places Details, gated behind `GOOGLE_PLACES_API_KEY`) → name/phone/address/hours/categories/photos; `mapPlacesHours` converts `opening_hours.periods` (0 = Sunday) to our `HoursDaySpec`; `buildSpecFromListing` maps it (+ menu) into the same `RebuildSpec`. Accepts a **pasted listing JSON** when no key is configured. **Do not scrape Yelp/Google HTML** (Cloudflare + ToS) — use the API.
- **Menu from photos** (`lib/rebuild/menuFromPhotos.ts`): a **vision** model (`gpt-4o`, metered) reads the menu-board / menu-page photos diners upload to the listing into the same `parseMenu` shape. This replaces the menu-subpage crawl for no-website businesses. Prices are OCR **guesses** → the owner still confirms them in "Enable ordering."
- **Route**: `POST /api/import-listing` (operator/admin-gated) — resolve listing → `menuFromPhotos` → `buildSpecFromListing` → `assembleDraft` → a **claimable** draft (`claim_source='listing_import'`). The business claims it on sign-up. Ideal cold-outreach engine: auto-assemble a real site from a listing, then pitch "it's already built — claim it" under the CedarSites reseller brand.
- **Batch engine**: `npm run import:listings -- leads.json` (`scripts/import-listings-batch.ts`) turns a list of leads (a `query` like "Hawkers Bar & Grill, Auburn WA", a `placeId`, or a pasted `listing`, each with optional menu `photoUrls`) into claimable drafts, and writes `<leads>-results.json` with each draft's **preview URL** (`/preview/<slug>`) + **claim URL** for outreach. `findPlace()` resolves a name → Place ID (Text Search). Owner via `CEDARSITES_OPERATOR_ID` (optional).
- **Claim flow** (prospect → owner): the claim URL is `/claim-site/<id>?token=<t>` — a signed, expiring [site-claim token](../lib/auth/siteClaimToken.ts) binding that one template. The public page (`app/claim-site/[id]/page.tsx`) previews the site + "Claim it free"; `GET /api/claim-draft/[id]` arms the cookie → sign-up → `claimPendingSiteDraft` (in the auth callback) calls the **`claim_operator_draft`** RPC, transferring `owner_id` to the new account. The RPC only moves a still-`listing_import` row (idempotent; a leaked link no-ops after the first claim) and is service-role-only. Needs migration `20260705_claim_operator_draft.sql` applied.
- **Smoke**: `npm run smoke:menu-photo -- <menu-image-url>` prints the extracted menu (no DB write). Verified live against a real menu-board photo (3 sections, 23 items, exact prices).

## 5. Ordering — "Enable ordering" (owner-confirmed prices)

Conversion produces a **display** menu with approximate prices. You can't charge customers off AI-guessed prices, so ordering routes through an explicit **owner price-confirmation gate**:

1. In the menu editor, **Enable ordering** opens a confirm panel listing every priced thing — item prices, each **option** price, each **add-on** price — as editable exact-dollar fields. Only priced items are sold.
2. Confirm → `POST /api/menu/publish-catalog` (`app/api/menu/publish-catalog/route.ts`, `requireUser`): derives the caller's **own** merchant (ensure-or-create by `owner_id` — no cross-tenant `merchantId` input), then creates/updates `catalog_items` (`type: meal`, `metadata.category = section`), **idempotent** by `(merchant_id, slug)`.
   - **Options** (Small/Large) → catalog **variants** via the shared `normalizeVariants` (base price = cheapest).
   - **Add-ons** (extra cheese) → `metadata.addons = [{id, label, price_cents}]`.
   - **Photos** → the item's `images`.
3. The response mapping is applied back onto the menu block (`applyCatalogLinks` in `lib/commerce/menuCatalog.ts`) — each item gets its `catalog_item_id`, each option its `variant_id`, each add-on its stable `id` — and the merchant is written to `template.data.meta.ecom.merchant_id`. The menu's "Add to order" buttons light up.
4. **Connect Stripe** — a real button in the editor (`POST /api/connect/onboard`) starts Stripe Connect onboarding so the merchant can capture payment.

Pure helpers: `lib/commerce/menuPrice.ts` (`parsePriceToCents` handles `$14`/ranges/`MP`→null) + `lib/commerce/menuCatalog.ts` (`buildCatalogRowsFromMenu`, `applyCatalogLinks`).

## 6. The money path (why it's tamper-proof)

Ordering rides the **existing** commerce stack — the `menu` block dispatches the same `qs:cart:add` event as `products_grid`; the cart (`components/cart/*`) and `POST /api/commerce/checkout` are unchanged in spirit.

**The load-bearing guarantee** (`lib/commerce/checkoutItems.ts#authorizeCheckoutItems`): the client sends **ids only** (catalog id, variant id, add-on ids) — never prices. The server reprices every line from `catalog_items`:
- Base or **selected variant** `price_cents` (a variant item ordered without a choice is rejected).
- **Plus validated add-ons**: each requested `addonId` must exist in the item's own `metadata.addons`; unknown ids are rejected; their server-side prices are summed on.

So a tampered `unitAmount`, a fabricated add-on price, or a cross-store item id all fail. **Cart line identity** is composite (`<item>::<variant>::<sortedAddonIds>`) so "burger + cheese" and "burger + bacon" are distinct lines with correct prices; plain/variant-only lines keep their exact prior ids (no churn to existing carts).

## 7. Proof + tests

- **Green-path proof route** (admin-gated, no real Stripe): `POST /api/admin/commerce/menu-demo` — builds a menu with a plain item + a choose-one item → `buildCatalogRowsFromMenu` + `normalizeVariants` → `catalog_items` → orders the plain item **and the Large variant** through the real `authorizeCheckoutItems` → `createDraftOrder` → `markOrderPaid`, and **asserts** the Large variant repriced to $12 (not the $8 base) and the platform fee is taken on the real prices. `{cleanup:true}` tears down. Mirrors `e2e-demo` / `pod-demo`.
- **CI unit tests** (all pure): `checkoutItems.test.ts` (variant + add-on repricing, tamper/unknown-id rejects — 27 cases), `menuCatalog.test.ts` (rows/variants/add-ons/links — 14), `menuOrderChain.test.ts` (the reprice assertion without a DB), `menuPrice` (via menuCatalog), `restaurant-menu.test.ts` (scaffold), `scrapeSite`/`parseMenu` (conversion).

## 7b. The `delivered.menu` surface (default deliverable URL)

A restaurant's zero-setup home is **`delivered.menu`**, reachable two ways that both resolve to the same site (`/sites/<slug>`):
- **Subdomain:** `hawkers.delivered.menu` (the form the outreach/QR links use).
- **Path:** `delivered.menu/hawkers`.

Restaurants may still attach their **own custom domain** (unchanged `domain` column + the generic custom-domain path in `middleware.ts`); delivered.menu is just the default.

The **same URL spans the lifecycle**: an unclaimed outreach draft renders with the "not published yet" watermark and `robots: noindex`; once the owner claims + publishes, it becomes the live, indexable ordering site and the watermark drops automatically (keyed on `published_snapshot_id`). Mechanics:
- `middleware.ts` (menu branch) rewrites both host forms to `/sites/<slug>` and sets an `x-qsites-menu-host` request header; bare apex `/` → `/delivered` (a directory of live restaurants, `app/delivered/page.tsx`); reserved app paths (`/api`, `/admin`, `/claim-site`, `/preview`, …) pass through so ordering + claim work on the branded host.
- `app/sites/[slug]/[[...rest]]/page.tsx` reads that header: with no published snapshot it serves the **public** draft (watermark + noindex) instead of 404'ing; published sites are unaffected. An unclaimed `listing_import` draft also gets a **"Claim this site" bar** (`components/sites/menu-claim-bar.tsx`) linking to the token-gated `/claim-site/<id>` flow.
- Helpers: `lib/menu/deliveredMenu.ts` (`menuSubdomainSlug` / `menuPathSlug` / `menuSiteUrl`). Outreach dashboard + `scripts/import-listings-batch.ts` emit `menuSiteUrl(slug)`.
- **Flag:** `NEXT_PUBLIC_MENU_BASE_DOMAIN` (blank = dormant). Set to `delivered.menu` **after** the apex + `www` + a `*.delivered.menu` wildcard are pointed at this Vercel project.

## 7c. Demand capture on unclaimed drafts ("prove demand before signup")

The strongest claim pitch isn't "we built you a site" — it's "**people already tried to order and you're leaving money on the table.**" On an unclaimed `listing_import` draft on the menu host, we log **order intent** and use the count to escalate the claim bar (and, once we turn it on, to text the owner). Deliberately **no money and no held funds** pre-claim — that's the DoorDash "phantom order" problem (and the laws it triggered); this is a demand *signal* only.

**Phase 1 — count + escalate** (flag `MENU_DEMAND_CAPTURE_ENABLED`):
- `demand_events` table (`20260722` + `20260723` migrations; deny-default RLS, service-role only). `kind` `call` | `order_ahead`, plus `contact_name`/`contact_phone`/`items` (free **text**) for an order-ahead lead, and `notified_at` (Phase 2).
- `lib/menu/demand.ts` — `recordDemandEvent` (server **re-checks** `claim_source==='listing_import'`, so intent can't be logged against a claimed/arbitrary site), `getDemandCount`, `getDemandCounts`, `getDemandSummaries`.
- Public route `POST /api/menu/demand/[templateId]` — flag-gated, per-IP rate-limited (`menu_demand`, 20/hr), Zod-validated; an `order_ahead` requires a phone.
- `components/sites/demand-capture.tsx` — a delegated `tel:` listener fires a `sendBeacon` (`kind:'call'`) on tap-to-call, plus an **honest** "order ahead" modal. Online checkout isn't live on a draft, so it doesn't fake an order: it captures the lead and points the visitor at the working phone. Rendered by `app/sites/[slug]/[[...rest]]/page.tsx` when `showClaimBar && MENU_DEMAND_CAPTURE_ENABLED`.
- `MenuClaimBar` escalates from "Is this your restaurant?" to "**N people tried to order here** — claim to turn on online orders and start collecting." Operator visibility: `/admin/outreach` gains an "Order intents" stat + a per-row 🔥 count (`loadOutreachDrafts` → `getDemandSummaries`).

**Phase 2 — notify the owner** (flag `MENU_DEMAND_CAPTURE_SMS`, threshold `MENU_DEMAND_NOTIFY_THRESHOLD`, default 3): `lib/menu/demandNotify.ts#maybeNotifyRestaurant` fires from the capture route after each event; once demand ≥ threshold it texts the restaurant **once** (deduped on `notified_at`), using the **server-derived** listing phone (`resolveListingPhone`, blocks only — same convention as the claim-verify route), a tokenized `claimUrlFor` link, the outreach sender identity, and an opt-out line. **No customer PII in the message** — a visitor left their number expecting a demand signal, not a handoff; the leads become the owner's only after they claim. `/admin/outreach` shows a "✓ texted" pill.

**Rollout:** Phase 1 is safe to run on its own. Phase 2's SMS is held **OFF in prod** until Phase 1 proves out with real people (and cold B2B SMS is A2P 10DLC/TCPA territory — registration/consent is the operator's responsibility). **Phase 3 (not built):** actual pre-claim checkout (auth-not-capture + auto-refund on no-claim) — a separate compliance project.

**Pricing for this funnel** (`lib/commerce/pricingPolicy.ts`): a claimed menu-ordering site launches on **8% + 60¢/order, no monthly** — a single-digit take that beats DoorDash, with a per-order floor so a small ticket still clears Stripe's fixed $0.30. Chosen by vertical, not funnel: `resolveMerchantFeeDefault(merchantId)` seeds the fee at Connect onboarding (`/api/connect/onboard`) — a site with a `menu` block (`hasMenuBlock`) gets restaurant terms, everything else keeps the general **5% / no-floor** default, so no other vertical is touched. The concrete rate is stated on the claim page ("you keep 92%, no monthly" — `components/sites/claim-site-hero.tsx`, menu sites only). All numbers env-overridable + clamped to the partner cap. **Deferred:** a subscription *buy-down* (a monthly that lowers the %) once real order volume shows where merchants land — the Shopify model; `lib/billing/*` already has the tier machinery.

## 8. Env flags

- `NEXT_PUBLIC_MENU_BASE_DOMAIN` — the restaurant "menu" base domain (e.g. `delivered.menu`); blank keeps the surface + links dormant. See §7b.
- `MENU_DEMAND_CAPTURE_ENABLED` — Phase 1 demand capture on unclaimed drafts (counter + claim-bar escalation). Off by default. See §7c.
- `MENU_DEMAND_CAPTURE_SMS` + `MENU_DEMAND_NOTIFY_THRESHOLD` — Phase 2 owner SMS on threshold cross (default threshold 3). Needs the same Twilio env as claim verification. Off by default; held off in prod until Phase 1 proves out. See §7c.
- `QS_RESTAURANT_PLATFORM_FEE_PERCENT` (default `0.08`) + `QS_RESTAURANT_PLATFORM_FEE_MIN_CENTS` (default `60`) — the menu-ordering take-rate seeded at Connect onboarding for sites with a `menu` block. `QS_DEFAULT_PLATFORM_FEE_PERCENT` (default `0.05`) + `QS_DEFAULT_PLATFORM_FEE_MIN_CENTS` (default `0`) are the general-commerce fallback. All clamped to `QS_MAX_PLATFORM_FEE_PERCENT` (0.10). See §7c.
- `CLAIM_VERIFICATION_ENABLED` — when `1`/`true`, claiming a `listing_import` draft requires an OTP to the listing phone (or an operator manual verify) before ownership transfers. Needs the `claim_verifications` migration + Twilio env (`TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` + `TWILIO_FROM` or `TWILIO_MESSAGING_SERVICE_SID`). Off by default. See [`CLAIM_VERIFICATION_PLAN.md`](CLAIM_VERIFICATION_PLAN.md).
- `NEXT_PUBLIC_GUEST_BUILD_ENABLED=1` — gates the anonymous convert/rebuild path (prod ON).
- `REBUILD_HERO_ENABLED` — off by default; when on, conversion generates a fresh hero instead of reusing the source `og:image`.
- `STRIPE_SECRET_KEY` + `APP_BASE_URL`/`QS_PUBLIC_URL` — required for the Connect button (`/api/connect/onboard`).
- `QS_*` fee knobs — see [`partner-terms.ts`](../lib/commerce/partner-terms.ts).

## 9. Known gaps / follow-ups

- **Unverified link:** a live Stripe-**test** click-through of the full order (Enable ordering → Connect → place a test order → confirm the fee lands). Every piece is unit-tested + the demo route proves the numbers, but the browser chain hasn't been driven end-to-end.
- **Demand capture (§7c):** Phase 1 driven end-to-end locally (API + escalated claim bar + rate limit). Phase 2's actual SMS send is unverified — it needs Twilio creds and is held off in prod pending real-user Phase-1 data. Not yet built: post-claim **lead visibility** (show the owner the captured names/phones/items as the payoff for claiming), and re-notify cadence as demand keeps growing (today it texts once).
- **Not built** (each pulls in new checkout surface): order-level special instructions / notes, checkout tip, pickup-vs-delivery scheduling.
- **Deliberately owner-asserted, not AI-inferred:** dietary tags (GF/V/…) — an allergen-safety matter — are toggled by the owner in the editor, never guessed by conversion.
- Conversion does not auto-pull per-dish photos (menu subpages rarely map images to dish names reliably); photos are added in the editor.
