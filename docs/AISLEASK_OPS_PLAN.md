# AisleAsk Ops — location planning + gig cross-posting

> Build plan for the next session. Two features on top of the shipped store-walk loop:
> **(A)** a QS admin section for planning which AisleAsk locations to catalog, and
> **(B)** cross-posting the cataloging gigs to FB Marketplace / Craigslist (+ other
> channels) to recruit taskers, linking back to our sites.
>
> Read `crosstalk/contracts/route-optimize.md` and `crosstalk/contracts/aisleask-catalog-gig.md`
> first. This plan assumes the store-walk loop already shipped (see "What exists").

Last updated: 2026-07-17.

---

## What exists (the loop this builds on)

The AisleAsk store-walk loop is live end-to-end:

1. **Cataloging gig** = a store that needs its aisles cataloged. Two representations today:
   - `job_listing` block (`deliverable:'ordered_sections'`) on a template site — apply via
     `POST /api/jobs/apply` (emails poster + best-effort POSTs `{sections}` to `submit_url`). §10 wedge, PR #488.
   - **`catalog_gigs` table** (migration `20260727_catalog_gigs`, APPLIED) — the tasker-board
     model: `store_name, address, latitude, longitude, location_label, status(open|claimed|completed),
     claimed_by, source, external_ref, notes`. Deny-default RLS (service-role only). PR #520.
2. **Tasker gig board** `/walker` (+ `GET/POST /api/walker/gigs`, `POST /api/walker/gigs/[id] {action}`) —
   sign in → claim open gigs → **"Plan my route"** → Done/Release. `lib/walker/gigs.ts`
   (race-safe claim, `planRouteUrl`, `createGig`). PR #520.
3. **Route planner** `/tools/route-planner` (+ `POST /api/tools/route-optimize`) — stops
   (addresses or `Name @lat,lng` coords) → geocode (free Nominatim, `lib/route/geocodeAddress.ts`)
   → nearest-first order (`lib/route/optimizeRoute.ts`, PorchHearth's borrowed seam) → Google
   Maps turn-by-turn. Contract `crosstalk/contracts/route-optimize.md`. PRs #517/#519.
4. **Capture**: HiveJournal's Mentra Live glasses catalog each store hands-free (HJ #1328),
   POSTing the ordered sections to the gig's `submit_url`. AisleAsk stores persist
   address+lat/lng (HJ mig 510), so gigs sourced from them carry precise coords.

**Ownership:** the tasker↔gig **assignment** is QS's (Odd-Jobs side). AisleAsk (HJ) owns the
store list + catalog ingest + the glasses. Gigs are **operator-seeded today** (admin `POST
/api/walker/gigs`); the AisleAsk auto-source seam is proposed to HJ (rides partner-provisioning
auth, HJ PR #1332, pending).

**Governance:** standing crosstalk sanction (owner runs all products). Carve-outs still surface
to the owner: **spending real money, deleting data, publishing externally.** Feature B touches
"publishing externally" hard — see its section.

---

## Feature A — AisleAsk location planning (QS admin)

**Goal:** an operator plans *which stores/areas to catalog* and seeds them as `catalog_gigs`,
so the `/walker` open pool fills from a real coverage plan rather than one-off manual adds.

**Surface:** a new admin section — either `/admin/aisleask` or a tab under `/admin/growth`
(the growth area already hosts prospecting; a sibling tab is lowest-friction). Reuse the
prospect-discovery machinery wholesale.

**Build:**
1. **Sweep for target stores** — reuse the prospect sweep pattern verbatim:
   `components/admin/prospects-client.tsx` (the `CATEGORIES` + sweep UI) → `POST
   /api/admin/prospects/discover` (Google Places, `lib/places/searchTextNearby`). Add
   grocery/retail categories (`grocery_store`, `supermarket`, `convenience_store`,
   `department_store`, etc.) so a sweep of a city returns catalogable stores **with coords**
   (Places results include lat/lng — no geocoding needed).
2. **Turn swept stores into gigs** — a "Create cataloging gigs" action that inserts selected
   Places results into `catalog_gigs` via `createGig` (`source:'places'`, `external_ref:<placeId>`
   for de-dupe; store_name + formatted address + lat/lng straight from Places). Guard against
   dupes on `external_ref`.
3. **Coverage view** — a map/list of `catalog_gigs` by status (open/claimed/completed), so the
   operator sees which areas are covered, who's working what, and what's stale. A simple table
   + status filters is enough for v1; a map (reuse whatever map component prospects uses, if any)
   is a nice-to-have.
4. **Manage gigs** — edit/close/reopen a gig; bulk-close a metro; notes.

**New/changed code:** an admin page + client; extend `lib/walker/gigs.ts` with `listAllGigs`
(admin, all statuses + filters) and a bulk `createGigs`; add grocery/retail categories to the
sweep (either in `prospects-client` CATEGORIES or a dedicated AisleAsk category set). `POST
/api/walker/gigs` already creates one gig (admin-gated) — add a batch variant. Everything is
`requireAdmin`.

**Effort:** medium. Most of it is reusing the prospect sweep + the `catalog_gigs` table that
already exists. The genuinely new part is the coverage/management UI.

---

## Feature B — Gig cross-posting (recruit taskers), linking to our sites

**Goal:** get the cataloging gigs in front of potential taskers on **FB Marketplace / Craigslist**
(and other channels), each post linking back to a QS gig page where the tasker claims it.

### ⚠️ HARD CONSTRAINT — read before designing "automation"

**Neither FB Marketplace nor Craigslist offers a posting API, and both forbid automated
posting in their ToS + actively block it (login walls, bot/CAPTCHA detection).** A headless
"auto-post to Marketplace/Craigslist" build is (a) against their terms, (b) technically
brittle/blocked, and (c) an **external-publishing carve-out** requiring owner sign-off anyway.
So "as much as possible" ≠ headless posting. The realistic, honest build is **assisted posting**:
generate everything, let a human do the final submit. Do NOT build a scraper/bot that logs in
and posts on the user's behalf.

### What to build (assisted cross-posting)

1. **Public gig landing page** — a shareable, indexable-optional URL per gig (e.g.
   `/gigs/[id]` or `/walk/[id]`) that shows the gig (store, area, what the task is, pay if any)
   and a **"Claim this gig"** CTA → sign in → `/walker`. This is what every cross-post links to.
   (Today gigs only live in the authed `/walker` board; a public per-gig page is net-new.)
2. **Post-content generator** — per gig + per channel, produce ready-to-post content:
   - **title** (e.g. "Flexible gig: catalog a grocery store's aisles — {City}"),
   - **body** (what the task is, ~15–30 min/store, flexible, how to claim, the gig URL),
   - **price/category** hints (Craigslist "gigs > labor"; Marketplace "misc/services"),
   - a **QR code** + optional site screenshot as the image (reuse the QR pipeline —
     `lib/listings/qrPack.ts` / the competition-postcard QR generation already in the repo).
   - **One-click copy** for each field + a preview.
3. **Assisted-post launchers** — buttons that OPEN the posting form (a human finishes):
   - Craigslist: deep-link the post form for the chosen city + category
     (`https://<city>.craigslist.org/...` post flow). No prefill possible beyond the category;
     the human pastes the generated title/body.
   - FB: Marketplace has no deep-linkable create form worth automating; instead offer a
     **"Share to a Facebook Page"** path via the **Graph API** (legit + automatable) IF the
     operator connects a Page — post the gig link to the Page feed (not Marketplace). That's
     the one truly-automatable FB surface.
4. **Track posted-where** — a small `gig_posts` table (or a JSON column on `catalog_gigs`):
   `{gig_id, channel, posted_at, posted_by, url?}` so the operator sees which gigs are live on
   which channels and doesn't double-post.
5. **Legitimately-automatable channels (do these for real):** a **public QS gigs page** (all
   open gigs, indexable — free SEO/organic recruiting), an **RSS/JSON feed** of open gigs,
   **email/SMS** to a saved tasker list (reuse `lib/email.ts` / the SMS sender), and the **FB
   Page** post above. These need no ToS gymnastics and can be fully automated.

### Honesty / governance notes (bake into the build)
- Frame it to the operator as "generate the post + open the form" — never imply we posted to
  Marketplace/Craigslist for them.
- Any actual external post is the **owner's external-publishing carve-out** — the tool prepares,
  the human (or an explicit owner-approved automation for owned channels like the FB Page)
  publishes.
- The gig posts must be **honest**: real gigs, real pay terms (or clearly "unpaid/volunteer /
  pilot" if that's the model — confirm the comp model with the owner; §10 was payments-free v0,
  so recruiting for unpaid work needs an honest framing + likely a comp decision first).

**Effort:** medium-large. The public gig page + content generator + tracking are the real work;
the FB Page Graph API path is the only "true automation" and needs a connected Page + token
(owner setup). Sequence: public gig page → content generator + copy/launchers → tracking →
owned-channel automation (site page/feed/email) → FB Page API last.

---

## Suggested sequence for the new session

1. **Feature A first** (fills the gig pool from a real plan) — it's mostly reuse and unblocks
   having gigs worth cross-posting.
2. **Public gig page** (Feature B #1) — needed by every cross-post.
3. **Content generator + assisted launchers + tracking** (Feature B #2–4).
4. **Owned-channel automation** (public gigs page/feed/email) + **FB Page API** (Feature B #5).
5. **Confirm with the owner before any external posting:** the comp model (paid vs. pilot),
   and that assisted posting (human submits) is the posture — no headless Marketplace/Craigslist
   bot. Surface the FB Page connection (owner setup + token) when you get there.

## Files/patterns to reuse
- Gigs: `lib/walker/gigs.ts`, `catalog_gigs` table, `/api/walker/gigs*`.
- Sweep/Places: `components/admin/prospects-client.tsx`, `app/api/admin/prospects/discover/route.ts`,
  `lib/places/searchTextNearby.ts`, `lib/places/typeToIndustry.ts`.
- QR/print: `lib/listings/qrPack.ts` + the competition-postcard QR generation.
- Email/SMS: `lib/email.ts`, the Twilio SMS sender (`lib/sms/sendSms.ts`).
- Auth: `lib/auth/requireUser.ts` (`requireAdmin` / `requireUser`).
- Adding an admin page: mirror `/admin/growth` / `/admin/outreach` structure.
