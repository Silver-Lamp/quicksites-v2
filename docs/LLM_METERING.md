# QuickSites — LLM Metering

> How AI/LLM calls are measured and limited. Companion to [`../CLAUDE.md`](../CLAUDE.md).
> Status as of 2026-06-26: primitive built, rollout pending.

## Why this exists
There are **~21 API routes calling OpenAI directly**. A cost-logging helper existed
(`lib/ai/withCostLogging.ts#logActualCost` → `ai_usage_events`) **but it was imported
nowhere** — so in practice AI spend was **untracked and unbounded**. "Meter" here means
both halves: **measure** every call and **limit** total spend.

## What's now in place
| Piece | File | Role |
|---|---|---|
| Usage table | `supabase/migrations/20260626_ai_usage_metering.sql` | Defines `ai_usage_events` (previously undocumented), indexes, RLS, `ai_spend_usd()` helper. |
| Cost logging | `lib/ai/withCostLogging.ts` (existing) | Computes USD from the pricing table, inserts a row. |
| Pricing | `lib/ai/cost/pricing.ts` + admin AI-pricing sync cron | Per-model rates. |
| **Meter / guard** | `lib/ai/meter.ts` (new) | Pre-call **budget enforcement** + one-call wrapper that logs + mirrors to PostHog. |
| Analytics mirror | `lib/analytics/posthog-server.ts` | `llm_call` events land in PostHog alongside revenue. |

## Limits (env-driven — see `.env.example`)
```
LLM_METERING_ENABLED=true        # master switch for enforcement (logging always on)
LLM_DAILY_USD_LIMIT=50           # global/day; 0 = unlimited
LLM_MONTHLY_USD_LIMIT=1000       # global/month; 0 = unlimited
LLM_PER_USER_DAILY_CENTS=200     # per-user/day abuse cap; 0 = off
```
When `LLM_METERING_ENABLED` ≠ `true`, the guard no-ops (you still get logging) — so you
can deploy the wrapper everywhere first, watch PostHog, then flip enforcement on.

## How to meter a call (the rollout)
Replace a raw OpenAI call with `meterLLMCall`:

```ts
import { meterLLMCall } from '@/lib/ai/meter';

const text = await meterLLMCall(
  { provider: 'openai', model_code: 'gpt-4o-mini', modality: 'chat',
    user_id, site_id, route: '/api/ai/suggest' },
  async () => {
    const r = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages });
    return {
      value: r.choices[0]?.message?.content ?? '',
      usage: { input_tokens: r.usage?.prompt_tokens, output_tokens: r.usage?.completion_tokens },
    };
  },
);
```
- For a pure pre-check without wrapping, call `await assertAiBudget(userId)`.
- Over-budget throws `LLMBudgetExceededError` — catch it and return HTTP **429**.
- Image/audio modalities: pass `images` / `minutes_audio` (and `metadata.megapixels_per_image` for images) in `usage`.

### Suggested route order (highest volume / risk first)
1. `app/api/ai/suggest` (editor copy — highest call volume)
2. `app/api/hero/*`, `app/api/services/suggest`, `app/api/faq/generate`, `app/api/testimonials/generate`
3. Image gen: `app/api/hero/generate-image`, `app/api/favicon/generate`, `app/api/icon/generate`, `app/api/chef/profile/generate-avatar`, `app/api/dev/generate-meal-image`
4. Assistants/digests: `app/api/ask-assistant`, `app/api/weekly-digest-live`, `app/api/send-weekly-digest`
5. Remaining OpenAI callers (grep: `grep -rl openai app/api`).

## Design notes
- **Fails open on read errors**: if the spend query fails, the call is allowed (analytics
  outage shouldn't break AI features). The post-call log still records spend.
- **UTC day/month** boundaries for limits.
- **PostHog `llm_call`** carries `cost_usd`, `model`, `route`, tokens → build a spend
  dashboard + per-route breakdown there.
- **Per-org/merchant caps** are a natural next step (tie limits to `merchant_billing.plan`)
  once Model A billing tiers exist — see [`MONETIZATION.md`](MONETIZATION.md).

## Verify locally
```sql
-- top routes by spend, last 24h
select metadata->>'route' as route, count(*), round(sum(cost_usd)::numeric, 4) as usd
from ai_usage_events where created_at > now() - interval '1 day'
group by 1 order by usd desc;
```
