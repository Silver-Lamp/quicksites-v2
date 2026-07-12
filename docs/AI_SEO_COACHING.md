# AI SEO Coaching (premium)

> A lightweight, customer-facing SEO coach for **paid-plan site owners**: a **daily
> "next best step"** email and a **weekly summary** for their own published QuickSites
> site. Turns the deterministic-rules → grounded-LLM shape proven by the geo-campaign
> recommendation engine into a retention/upgrade perk. Ships **flag-off**.

Companion: [`GEO_RECOMMENDATIONS_PLAN.md`](GEO_RECOMMENDATIONS_PLAN.md) (the engine this mirrors), [`PRICING_REDESIGN.md`](PRICING_REDESIGN.md) (plans/entitlements).

## What it does

For each paid, opted-in owner, the crons pick the owner's **most-in-need published site**, compute SEO signals, score it 0–100, produce deterministic recommendations, optionally polish the top step(s) with a grounded LLM pass, snapshot the result, and queue **one** email:

- **Daily** (`seo-coach-daily`, `30 9 * * *`): the single highest-impact next step + current score.
- **Weekly** (`seo-coach-weekly`, `0 9 * * 1`): score + week-over-week trend + top 3 to tackle.

Both queue into `email_outbox`; the existing `email-drain` cron (10:00 UTC) sends them via Resend, honoring the `List-Unsubscribe` header the coach attaches.

## Gating

- Premium = any **active paid plan** (`user_plans`, via `getUserPlan` + `isPaidPlan` + `ACTIVE_PLAN_STATUSES`). Enforced by the new `planAllows(userId, 'ai_seo_coaching')` entitlement (`lib/billing/entitlements.ts`) — used in the fan-out (defensive per-owner re-check) and the prefs `PATCH`.
- **v1 limitation:** enrollment reads `user_plans`. Owners who are paid only via `merchant_billing` (no `user_plans` row) aren't enrolled yet.

## Signals & engine (`lib/seo/coach/*`, pure unless noted)

- `onPage.ts` — `analyzeSiteOnPage(data)`: owner-lens on-page (reuses `analyzeOnPage` for schema/page-count; adds meta title/description quality, word count / thin-content, H1, missing alt).
- `signals.ts` (I/O) — `gatherSiteSeoSignals`: on-page + a **cache-first** 28-day GSC rollup (`gsc_cache` `sum:` rows, matched to a connected `gsc_tokens` domain via `normalizeGscDomain`; no live GSC fetch in the fan-out).
- `score.ts` — `computeSeoScore`: weighted 0–100 rubric (meta 25 / schema 10 / content 20 / GSC-connected 15 / position 15 / CTR 15). Unconnected GSC scores as partial "opportunity", not a hard zero.
- `recommendations.ts` — `buildSiteSeoRecommendations`: deterministic, priority-sorted rules (missing/short/long title & description, no schema, thin content, one-page, not-connected-to-GSC, position 11–20 push, high-impressions/low-CTR, …).
- `generate.ts` (I/O) — `generateDailyNextStep` / `generateWeeklyTopThree`: metered (`meterLLMCall`, attributed to the owner's `user_id`), **grounded** (may only rephrase the rules), flag-gated by `AI_SEO_COACH_LLM_ENABLED`; return `null` on disabled/error/over-budget → deterministic fallback.
- `email.ts` — pure HTML builders + `listUnsubscribeHeaders`. v1 uses the default QuickSites brand (`orgEmailBrand()` needs a request host, unavailable in a cron).
- `unsubToken.ts` — HMAC token (scope marker `c`), cloned from `lib/crm/unsubToken.ts`.
- `recipients.ts` (I/O) — `listPaidCoachRecipients`: paid+active owners → published content sites → email + prefs.
- `run.ts` (I/O) — `runSeoCoach(admin, kind, opts)`: the orchestrator (idempotency, focus-site pick, snapshot, queue). `opts.dryRun` skips writes for testing.

## Data model (`supabase/migrations/20260714_ai_seo_coach.sql`)

- `seo_coach_snapshots` — per-site history (score/signals/recs/summary, `kind` daily|weekly). Deny-default RLS; owner/admin read; service-role writes. Weekly trend = latest vs. prior `weekly` snapshot's `seo_score`.
- `email_preferences` — account opt-out (`seo_coach_daily/_weekly`, `unsubscribed_all`) + idempotency stamps (`last_daily_sent_on` UTC day, `last_weekly_sent_on` ISO week-start). Owner-scoped RLS.
- `email_outbox` gains nullable `from` / `headers jsonb`; `email-drain` forwards them to `sendEmail` (backward compatible).

## Surfaces

- Settings: **Profile → "AI SEO Coaching"** card (`components/profile/seo-coach-card.tsx`) — daily/weekly toggles for members (`/api/me/seo-coach-prefs`), upgrade CTA for free users.
- Unsubscribe: `GET/POST /api/seo-coach/unsubscribe?token=…[&kind=daily|weekly]` (token is the auth).

## Enabling it

1. Apply the migration: `npm run db:migrate:up`.
2. Set `AI_SEO_COACH_ENABLED=1` (+ `AI_SEO_COACH_LLM_ENABLED=1` and `OPENAI_API_KEY` for LLM polish).
3. Ensure `RESEND_API_KEY`, `CRON_SECRET`, `APP_BASE_URL` are set. Crons are already in `vercel.json`.

## Related change

The **geo-campaign** LLM synthesis (`synthesizeTopThree` in `lib/outreach/computeRecommendations.ts`) is now gated to **premium/rented** campaigns (`subscription_status === 'active'`). Free/unrented campaigns keep the deterministic `ranking`/`nextAction`; `summary` is `null`.
