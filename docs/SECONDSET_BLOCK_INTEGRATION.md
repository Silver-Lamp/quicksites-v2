# SecondSet + auto-shop competition — block integration

> Making the SecondSet/auto-shop work **addable in the builder** so any QuickSites site can
> surface it, the same way `restaurants_directory` fronts a restaurant competition apex.
> Two blocks. See [[secondset-and-autoshop-competition]], `docs/SECONDSET_GLASSES_PLAN.md`.

## 1. `auto_shops_directory` block (mirror of `restaurants_directory`)

Today the auto-shop competition directory renders only via the sites templateless fallback
(`lib/outreach/autoShopCompetitionDirectory.ts` → `AutoShopCompetitionDirectory`). Promote it
to a **first-class addable block** so an apex portal template (or any page) can host the live
winner-first cohort directory, hydrating from a `campaign_id` — exactly like
`restaurants_directory` (registry `renderBlockRegistry.ts:146`, default `defaultBlockContent.ts:255`,
public feed `/api/public/restaurant-directory`).

- **5-file registration:** `admin/lib/zod/blockSchema.ts` (`auto_shops_directory` → `{ title, campaign_id, entries }`), `types/blocks.ts` (`'content'`), `lib/blocks/defaultBlockContent.ts`, `lib/renderBlockRegistry.ts` → `components/admin/templates/render-blocks/auto-shops-directory.tsx`.
- **Hydration:** a public `GET /api/public/auto-shop-directory?campaign=<id>` → `loadAutoShopDirectoryByCampaignId` (already exists), so the block paints live (winner featured) even after publish.
- **Reuse:** the render component can wrap the existing `AutoShopCompetitionDirectory` presentational grid.

## 2. `service_transparency` block (SecondSet, for a shop's OWN site)

A shop that runs SecondSet can drop a block on its own QuickSites site that says **"we show
you the work"** and links a customer into their SecondSet portal / explains the flow. This is
the *marketing* surface of SecondSet on the shop's site (distinct from the customer job portal
`/jobs/[token]`, which is per-job).

- **Content:** `{ headline, blurb, cta_label, portal_hint }` — default copy: "See the work
  before you pay for it." No live data needed (it's an explainer + a trust badge); optional a
  "🔧 SecondSet" verified-shop badge.
- **5-file registration** as above → `components/admin/templates/render-blocks/service-transparency.tsx`.
- **Honesty/gating:** the block is pure marketing copy (always safe to render); it does NOT
  expose captures or the rail. It's independent of `SECONDSET_ENABLED` (a shop can advertise
  the promise), but the actual capture/portal flow stays flag- + pilot-gated.

## Honesty

Neither block exposes customer captures publicly — the `auto_shops_directory` lists shops
(not their jobs), and `service_transparency` is an explainer. Customer proof stays behind the
per-job `public_token` portal only.
