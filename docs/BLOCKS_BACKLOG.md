# Block-Type Backlog

> The QuickSites block roadmap, adapted from the HiveJournal handoff brief
> (`hivejournal-2026/docs/product/QUICKSITES_BLOCKS_BRIEF.md`, 2026-07-17) and
> reconciled against what THIS repo already ships. Strategy in one line: **every
> sitebuilder has the standard blocks — only QuickSites can offer owner-voice audio
> blocks** (the HiveJournal/Emberkiln stack: consented voice clones, render-once TTS
> caching, the About That embed service — all already in prod on the HJ side).
> Lead with the moat; backfill table-stakes.
>
> Adding a block = the 5-file schema-driven recipe: `blockContentSchemaMap`
> (admin/lib/zod/blockSchema.ts) → `BLOCK_CATEGORY` (types/blocks.ts) →
> `defaultBlockContent.ts` → `renderBlockRegistry.ts` → the renderer (+ optional
> dedicated editor; palette auto-updates). Reference implementations: `story`
> (#201), `restaurants_directory` (#443, live-data pattern), `about_that`
> (#467, third-party embed-loader pattern).

> **Contracts source of truth**: cross-product API specs live in
> `~/Desktop/_SilverLamp/crosstalk/contracts/` (`about-that-embed.md`,
> `voice-welcome-endpoint.md`, more as they land) — the summary below is
> orientation, the contract files win on conflict. See CLAUDE.md §8b.

## Integration contract for HiveJournal-powered blocks

One script tag; nothing server-side in quicksites (player, rendering, caching, rate
limits, billing all live on HiveJournal):

```html
<script async src="https://www.hivejournal.com/about-that.js" data-embed="EMBED-ID"></script>
```

- Optional `data-url` overrides the narrated URL (default `window.location.href`);
  `data-width` sizes the iframe.
- **Domain gate**: an embed narrates only pages on its `allowed_domains`
  (dot-boundary suffix match). Subdomain sites → one root-domain entry covers all.
  **Custom domains → each must be added (cap: 20/embed today)** — open decision on
  the HJ side (raise the cap vs per-site embeds); revisit before selling audio
  blocks to custom-domain sites at volume.
- Renders are once-per-page-content (content-hash cache); playback is a static MP3.
- React gotcha (learned in #467): append the loader `<script>` via `useEffect` into
  a ref'd container with unmount cleanup — JSX-rendered script tags don't reliably
  execute.

## HJ answers (2026-07-17 — full text in `hivejournal-2026/docs/product/QUICKSITES_BLOCKS_RETURN_BRIEF.md`)

- **Sandbox embed LIVE**: `22e4692a-2538-4d8b-a2df-9fce1a7abdb9` — allowed on
  `quicksites.ai` incl. `/template/...` editor paths, house voice, founder preset,
  **25 renders/day shared cap, lazy (tap-to-render)**. Bills to HJ. **Testing only —
  do NOT wire it into product UI** (guest traffic would burn the shared cap).
- **Voice Welcome**: task logged P1; proposed contract
  `POST /api/about-that/:embedId/welcome {script}` → `{welcome_id, audio_url}` —
  a **static MP3, no iframe** (we own the block UI; even better than assumed).
- **Per-site embeds + partner provisioning API: ACCEPTED, logged P1** (partner API
  key, billing rolls up to the partner). Spec jointly after the conversion trio.
- **Metadata GET**: `GET /api/about-that/embed/:id/meta?host=…` →
  `{exists, preset, kinds, host_allowed}` (host-check param, not a domain dump).
- **Loader confirmed** (and smoke-tested from this repo 2026-07-16): multiple
  embeds per page OK (per-tag IIFE; use `data-url` per listing card);
  container-clear cleanup survives StrictMode (iframe = script's next sibling);
  **`data-width` is a raw CSS max-width** — bare numbers are invalid CSS, our
  `AboutThatEmbed` normalizes `480` → `480px`.
- **Custom-domain editor previews 403 renders until the provisioning API** —
  interim: preview with the sandbox embed, publish with the real one.
- Bonus: HJ's public gallery now includes a **quicksites.ai Pitch Panel** (house
  voice pitching QuickSites) — our product is demo content on theirs.

## Tier 1 — moat blocks (HiveJournal rails exist today)

| # | Block | Status | Notes |
|---|---|---|---|
| 1 | **About That** (`about_that`) | ✅ **SHIPPED** (PR #467) | Loader snippet; embed_id + width + url override. Needs a live cross-origin smoke test on a published page. |
| 2 | **Voice Welcome** | ⏸ blocked on HJ | One-shot greeting in the owner's cloned voice, above the fold. Fixed owner-written script (not page extraction) → **needs HJ's fixed-script TTS endpoint variant. Per the brief: tell HJ to log that task the moment we commit to this block.** |
| 3 | **Product Pitch Panel** | ready to build | About That on product pages (owner pitches, skeptical AI buyer probes — ecommerce sibling of the HJ real-estate `agent` preset). Likely `about_that` + a product-page placement preset rather than a new type; decide when building. |
| 4 | **Audio FAQ** | ready to build | Owner-voiced top-5 answers, rendered once, inline players. Extend the existing `faq` block with an optional embed slot, or a sibling type. Upgradeable later to HJ's interactive `faq_answer` register. |
| 5 | **Emberkiln audio card** | ready to build | Narrated excerpt / graphene.fm-style player card — pairs with the `author` industry + POD pipeline this repo already has. |
| 6 | **Testimonial audio strip** | ready to build | Extends the existing `testimonial` block. **Hard rule: never synthesize customer voices** — HOUSE voices only, explicitly labeled as dramatized readings. |

## Tier 2 — ecommerce conversion (table-stakes)

| Block | Status | Notes |
|---|---|---|
| Announcement bar | new | Dismissible; free-shipping threshold / promo code / sale window. |
| Countdown timer | new | **Real end times only — no fake-resetting scarcity** (brand + regulatory line, same honesty rule as the demand-capture flow). |
| Sticky add-to-cart | partial | `order_bar` already does the mobile sticky bar for restaurants — build the product-page variant on the same pattern (emit `qs:cart:add`, the shared cart event). |
| Bundle / bought-together | new | Owner-picked pairs v1 (ids from the owner's catalog via `/api/commerce/site-merchant`); algorithmic later. |
| Reviews + schema.org | new | The Google star snippet IS the feature — `AggregateRating`/`Review` JSON-LD emitted on the published render (follow the LocalBusiness-schema pattern in `app/sites/[slug]`). |
| Shoppable gallery | new | Image grid with product hotspots → `qs:cart:add`. |
| Size/spec table | new | With unit toggle. Boring; endlessly requested. |
| Back-in-stock / waitlist | new | Per-product email capture; doubles as a demand signal (kin to `demand_events`). Needs a small public rate-limited capture endpoint — the one Tier-2 item with server surface. |

## Tier 3 — trust + content + SEO

- **Trust badges strip** · **logo marquee** · **founder story** (pairs with Voice
  Welcome: read it or hear it) — all new, all thin renderers.
- **FAQ accordion + FAQPage schema** — `faq` block EXISTS; the delta is emitting
  FAQPage JSON-LD on the published render.
- **Comparison table** — honesty-first template (same DNA as `/compare`).
- **Before/after slider** — new; strong for the service verticals (pressure washing,
  detailing, roof cleaning).
- **Calculator block** — configurable estimators; each one is an SEO magnet.
- **Booking embed** — ✅ effectively covered: native `scheduler` block already
  exists; a Cal.com/Calendly wrapper is only worth it if prospects demand it.
- **Map + hours + open-now** — `location` + `hours` blocks and LocalBusiness JSON-LD
  already exist; the delta is an **open-now indicator** and/or a combined block.
- **Live activity ticker** — only if backed by REAL events (`orders`,
  `demand_events`); fabricated urgency is off the table product-wide.

## Tier 4 — vertical presets

- **Real-estate listing card** — **the strategic one.** Address/price/beds/baths/
  gallery/inquiry CTA **with an About That agent-preset player slot built in**.
  QuickSites can BE the on-domain listing pages most agent sites lack — which is
  what makes HJ's $79/mo real-estate tier land. The two products sell each other.
  `real_estate` industry key exists; this block + an industry-scaffold placement +
  a starter seed (see `lib/builder/starterSeeds.ts`) is the full move.
- **Menu block** — ✅ EXISTS (restaurant vertical). Delta: pair with owner-voice
  daily specials once Voice Welcome rails exist.
- **Class/session schedule** — gyms/studios/coaches; `scheduler` covers booking,
  this is the display grid.

## Tier 5 — AI-native builder passes (not visible blocks)

- **Auto-summary hero** — partially exists: `autogen_pending` already drafts hero
  copy + image on first editor open (guest build). Delta: expose it as a re-runnable
  pass for any site; nothing ships unreviewed.
- **Alt-text/SEO-meta filler** — natural fit as a `readinessActions` registry entry
  (one-click fix + pipeline step + coach integration for free). Marketable as
  "accessibility + SEO included."

## Sequence (repo-adjusted)

1. ~~About That block~~ ✅ shipped #467 → **do the live smoke test on a published page.**
2. **Real-estate listing card** — completes the About That revenue loop; unblocked
   today, and Voice Welcome isn't (HJ endpoint).
3. **Conversion trio**: announcement bar + sticky add-to-cart (product variant of
   `order_bar`) + reviews-with-schema.
4. **Voice Welcome** the moment HJ ships the fixed-script TTS variant (ping HJ to
   log it when we commit).
5. Cheap SEO deltas piggybacking on existing blocks: FAQPage JSON-LD, open-now on
   hours, alt-text readiness action.
6. Everything else by demand.

## Cross-product integration candidates (beyond blocks — from hivejournal.com/features, reviewed 2026-07-16)

> Status 2026-07-17: #1 is **CONTRACT AGREED** (`crosstalk/contracts/
> sellable-artifacts-export.md` — stable `artifact_id` upsert key, margin-fee
> `base_cost_cents`, v1 = paperback+audiobook w/ owner-token auth; HJ builds the
> export P1). **QS-side work item once it ships: the author-storefront import**
> (fetch artifacts → upsert `catalog_items` on `metadata.hj_artifact_id` → wire
> the grid — reuses the site-merchant + starterCatalog plumbing). #2 JQ Forms:
> both directions accepted, HJ drafts the contracts when their task cycle starts.

1. **The author-commerce bridge (EmberKiln ↔ QuickSites catalog) — the big one.**
   Both platforms already use the SAME POD providers: HJ's print-on-demand paperback
   is **Lulu**, its story-as-merch is **Gelato** — exactly our `pod_spec` rails. An
   author who writes/renders on HJ (book, audiobook MP3, cover-art merch) should
   sell it on their QuickSites author site: paperback → `catalog_items` w/ Lulu
   pod_spec, merch → Gelato pod_spec, audiobook → `type='digital'`. HJ makes the
   artifacts; we're the storefront + take-rate. Mirrors the real-estate loop —
   author vertical: Emberkiln audio card block + author starter + this bridge.
   Ask HJ for: an export/API of a story's sellable artifacts (lulu interior/cover
   URLs, gelato productUid/fileUrl, audio file, cover art).
2. **JQ Form Creator as a block** — "photo of a paper form → hosted fillable web
   form." Local businesses LIVE on paper forms (catering orders, intake, waivers,
   service requests). A `form_embed` block (or an import path into `contact_form`)
   turns that into an onboarding wow for exactly our customers.
3. **Graphene presence on author sites** — show-poster grid, follow capture,
   "📕 on kindle" pills, per-writer hubs already exist on HJ with public URLs; an
   author QuickSites site should surface their Graphene catalog (subsumed by #1 if
   the artifact API includes shows).
4. **Podcast Discussions embed** — "AI host interviews the owner, in the owner's
   voice" as a content block = the local-business trust artifact (the butcher's
   10-minute story on the About page). Rails exist (podcast library + share pages).
5. Already sequenced as blocks, powered by their rails: Voice Welcome (lovio clone
   + render-once cache), testimonial audio strip (their house-voice TTS is the same
   ElevenLabs render-once pattern they use for contest winners).

Weak/no fit (checked, deliberately skipped): journaling suite, Life Map, Odessa,
Looking Glass, write.cafe contests/battles, Drift coins, Rehearsal Room — consumer
surfaces with no local-business buyer.

## Standing rules (from the brief; consistent with this repo's honesty stance)

- No fabricated urgency anywhere: countdowns use real end times, activity tickers
  use real events, testimonial audio is house-voiced and labeled.
- Never synthesize a customer's voice.
- HiveJournal-powered blocks ship zero server-side code here — if a block needs a
  quicksites endpoint, it's not a Tier-1 block, it's a different feature.
