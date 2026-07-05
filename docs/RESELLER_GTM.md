# QuickSites — Reseller GTM (selling to people who host for others)

> How we find, reach, and convert **hosting resellers / agencies / freelancers who host sites for clients** — the channel our take-rate + lifetime residual model is built for.
> Companion to [`COMPETITIVE_LANDSCAPE.md`](COMPETITIVE_LANDSCAPE.md), [`WHITE_LABEL_PLAN.md`](WHITE_LABEL_PLAN.md), [`MONETIZATION.md`](MONETIZATION.md).
> Created: 2026-07-05.

---

## 0. The one strategic filter

Our wedge is **take-rate + lifetime residual on GMV**, not flat SaaS seats. That single fact decides who is worth chasing:

| Reseller type | Their clients | Fit | Why |
|---|---|---|---|
| cPanel/WHM commodity hosts | brochure sites, no transactions | **Weak** | No GMV to take a cut of → we're just "a cheaper builder" (our worst footing). |
| Web/marketing agencies & freelancers | mixed | **Medium** | Good if we move them toward commerce clients. |
| Agencies serving **transacting SMBs** (shops, restaurants, services taking payment, authors/POD) | sell online | **Strong** | The only segment where residual math beats a flat markup. |

**Target = "people who host websites for businesses that take money online,"** especially resellers *frustrated their current model caps out at a flat markup* (Duda/GHL). Same book of business, uncapped upside.

## 1. The migration objection — solved, not dodged

The #1 reseller objection is "moving my clients is a nightmare." Our answer is **not** a fidelity importer (a multi-quarter, low-fidelity slog that doesn't map arbitrary HTML onto our block schema). Two fast paths instead:

1. **Net-new (default motion).** Every *new* client starts on QuickSites; the AI industry scaffold seeds a working site in seconds. No migration at all.
2. **AI rebuild (the bridge — now shipped).** Paste a client's live URL → we scrape it → one metered AI call regenerates it as an editable QuickSites draft. It's a migration *and* a live sales demo. See `/rebuild` (`app/rebuild/page.tsx`, `app/api/rebuild/route.ts`, `lib/rebuild/*`).

We do **not** try to bulk-port a reseller's legacy brochure portfolio — those generate $0 in take-rate. We want their *transacting* clients on QuickSites, net-new + rebuilt on demand.

## 2. Where to find them (channels, by efficiency)

1. **Poach from competitor ecosystems** (highest leverage — they've already decided to resell web software):
   - GoHighLevel Facebook groups, r/gohighlevel, GHL "SaaS-preneur" Skool/YouTube communities.
   - Duda partner forum + agency communities.
   - Vendasta reseller networks.
   - *Pitch:* "You're already reselling — here's revenue your current stack structurally can't pay: a share of every sale, not a flat markup."
2. **Vertical agency lists** — restaurant-marketing shops, "we build sites for [contractors/salons/authors]" agencies. Map directly to our industry scaffolds + the POD/author flagship (a category neither competitor answers).
3. **cPanel/WHM & registrar reseller directories** — filter hard for those serving commerce clients.
4. **Our own self-serve loop** (built, under-trafficked): `/partners`, `/partners/resellers`, `/partners/calculator`, `/compare`, `/rebuild`, one-click JoinButton, self-issued referral codes, white-labeled `/join/<code>`. The acquisition machine exists — it's starved of the *right* traffic.

## 3. The message (why us over Duda / GoHighLevel)

Lead with the model, back it with the proof, stay honest about the gaps.

- **The model they can't copy:** Duda takes **0%** on store sales; GHL has **no real ecommerce**. Both monetize flat seats *by design*. A take-rate + lifetime residual is the revenue model both leaders have structurally chosen not to build. ([COMPETITIVE_LANDSCAPE.md](COMPETITIVE_LANDSCAPE.md) §3–4.)
- **Free hosting:** no $149/$497 monthly nut to cover before the reseller profits.
- **Your brand front-and-center:** white-labeled builder, login, admin chrome, transactional emails (gated on `billing_mode==='reseller'`). ([WHITE_LABEL_PLAN.md](WHITE_LABEL_PLAN.md).)
- **Verticals they can't serve:** real product commerce + POD author/apparel (Lulu + Gelato).
- **Honest caveat (say it):** we sell a better *model*; they sell finished *products*. Duda's storefront is more mature; GHL's resale motion is proven at scale. → **Always lead with a live proof**, not a slide: the green-path money-path demos (`/api/admin/commerce/e2e-demo`, `pod-demo`) show a real dollar flowing through with the residual accruing.

## 4. Cold-outreach sequence (ex-Duda/GHL reseller)

Personalize `{{first_name}}`, `{{agency}}`, `{{client_url}}` (a real client site of theirs). Every email points at a built surface.

**Email 1 — the rebuild hook (day 0).**
> Subject: rebuilt {{client_business}}'s site in 30 seconds
>
> {{first_name}} — saw {{agency}} builds for {{niche}} clients. I ran {{client_url}} through our AI rebuild and it spat out a fresh, editable version in about half a minute: `https://quicksites.ai/rebuild?url={{client_url}}`
>
> The reason I'm reaching out isn't the builder though — it's the money model. On Duda/GHL you mark up a flat seat, so you earn the same whether {{client_business}} does $0 or $1M. We pay you a share of every order they process. Worth 10 minutes?

**Email 2 — the math (day 3).**
> Subject: what {{agency}} would've earned last quarter
>
> Quick napkin math: [calculator link with their rough client GMV]. A Duda reseller pockets a fixed markup; here you keep a share of every sale, for the life of the account. Same clients, same effort. Calculator: `https://quicksites.ai/partners/calculator`

**Email 3 — the honest comparison (day 7).**
> Subject: where we beat Duda/GHL — and where we don't
>
> I won't pretend we out-feature Duda's storefront on day one. Here's the honest, sourced side-by-side incl. where they lead: `https://quicksites.ai/compare`. Where we win is the one thing they've chosen not to build — you earning on GMV. Happy to rebuild 2–3 of your clients live on a call.

**Email 4 — break-up (day 14).**
> Subject: closing the loop
>
> Not the right time? No worries. If you ever want to add GMV upside to the clients you already host, the door's open — and the rebuild tool's free to play with: `https://quicksites.ai/rebuild`.

## 5. What shipped for this motion (2026-07-05)

- **AI rebuild lead magnet** — `/rebuild` page + `POST /api/rebuild`; `lib/rebuild/{scrapeSite,inferSiteSpec,assembleDraft}.ts`. SSRF-guarded scrape, one metered AI call, guest-abuse-gated (guest AI cap + per-IP rate limit + LLM budget guard), stamps `claim_source` + `owner_id` so a guest draft auto-claims on signup. `?url=` prefill so outreach links open on a prospect's own site. Unit-tested SSRF guard + parser (`lib/rebuild/__tests__/scrapeSite.test.ts`, 13 cases).
- **Reseller-switcher landing** — `/partners/resellers` targeting Duda/GHL resellers (flat markup → GMV residual), routing to the calculator + rebuild tool.
- **"What you'd have earned" overlay** — the rebuild result card has an interactive GMV slider showing the partner's monthly/annual residual, via the shared pure estimator `estimatePartnerResidual()` (`lib/commerce/partnerEarnings.ts`, unit-tested), which now also backs `/partners/calculator` (constants de-duplicated).
- **Analytics funnel** — `rebuild_started` (scrape succeeded) + `rebuild_completed` (draft generated) emit server-side via `captureServer` (`app/api/rebuild/route.ts`); host-only (no full prospect URL). Event constants in `lib/analytics/events.ts`.

- **Fresh hero image on rebuild** — flag-gated (`REBUILD_HERO_ENABLED`, off by default; image gen is the priciest call). When on, a clean on-brand hero is generated + stored (`lib/rebuild/generateHero.ts`, metered image call) instead of reusing the old site's og:image; best-effort, falls back to the scraped image. The result card previews the hero. Pure bits unit-tested (`generateHero.test.ts`).

## 6. Open follow-ups (not built yet)

- **Outreach automation** — the sequence above is copy; wiring it to a sender/CRM is ops.
- **PostHog funnel/insight** — build the `rebuild_started → rebuild_completed → signup` funnel in the dashboard (instrumentation is live).
