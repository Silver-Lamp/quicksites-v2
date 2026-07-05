# AI Rebuild / Site-Conversion — Smoke Test

> How to verify the AI site-conversion feature end-to-end before promoting it in a campaign.
> Covers the shared backend (one CLI command) + the four UI entry points (manual, browser).
> Companion to [`RESELLER_GTM.md`](RESELLER_GTM.md).

The conversion tool has **one backend** (`POST /api/rebuild` + `lib/rebuild/*`) behind **four entry points**. Smoke the backend once with the CLI; then click each UI surface once.

---

## 1. Backend — CLI (fast, no UI, no DB write)

```bash
npm run smoke:rebuild -- https://some-real-business-site.com
```

Runs the exact three stages the route uses — **scrape → infer spec (AI) → assemble draft** — and prints what each produced. It writes **no rows**.

- **Env:** reads `.env.local`. Scrape-only works with zero env; the AI stage needs `OPENAI_API_KEY`; the meter chain needs `NEXT_PUBLIC_SUPABASE_URL` + anon key (it constructs a Supabase client at import — the script polyfills `WebSocket` from `ws` for Node 20).
- **What good looks like:** a plausible `businessName` + industry, non-empty `headline`/`services`, and `blockTypes: [hero, services, faq, contact_form]` (storefront industries also get `products_grid`).
- **Try a few:** a plumber/HVAC site (clean industry match), a restaurant, and an author/shop (storefront blocks). Also try a bad input (`npm run smoke:rebuild -- http://localhost` → should be blocked by the SSRF guard) to confirm the guard fires.

## 2. UI entry points (browser, ~2 min each)

All four require `NEXT_PUBLIC_GUEST_BUILD_ENABLED=1` for the **anonymous** paths (already set in prod). Signed-in paths work regardless.

| # | Surface | How to reach it | Expected |
|---|---|---|---|
| 1 | **Public lead magnet** | `/rebuild`, paste a URL | Staged progress → result card with hero preview + services + "Open in the editor" + earnings overlay (drag the GMV slider). |
| 2 | **Compare CTA** | `/compare` → "Rebuild a client's site — free" | Lands on `/rebuild`. |
| 3 | **Homepage hero (top of funnel)** | Home page (logged out) → "I already have a site" toggle → paste URL | Mints a guest session → lands in the editor with a populated draft. |
| 4 | **Onboarding chooser** | `/admin/templates/new` (signed in) → "Convert an existing site" card → paste URL | Lands in the editor (`/edit`) with a populated draft owned by you. |

### What to verify in each
- **Editor opens populated** — hero headline/subheadline, a services block, faq, contact (not empty/placeholder blocks).
- **Guest paths (1, 3):** the "You're building as a guest / Sign up to publish" banner is present; publishing is gated (`needs_signup`) until you sign up; after signup the draft is **still yours** (auto-claim, same uid).
- **Signed-in path (4):** the draft is owned immediately (`claim_source='ai_rebuild'`), no signup prompt.
- **Abuse guards:** repeat rapidly as a guest → eventually a friendly `rate_limited` / `guest_limit` message (not a crash). Governed by `GUEST_DRAFT_HOURLY_LIMIT_PER_IP` + `GUEST_AI_CALL_LIMIT`.

## 3. Optional — fresh hero image

If you set `REBUILD_HERO_ENABLED=true` (off by default), the result should show a freshly generated hero rather than the source site's image. Verify on **preview** first — it adds ~20s + a second AI call per rebuild.

## 4. Analytics

Each completed rebuild emits `rebuild_started` + `rebuild_completed` (host-only, no full URL) via PostHog. After a smoke run, confirm the events land, then build the `rebuild_started → rebuild_completed → signup` funnel in the dashboard.
