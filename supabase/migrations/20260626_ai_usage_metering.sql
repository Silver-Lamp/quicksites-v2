-- AI usage metering
--
-- Backing table for LLM/AI cost logging + metering. `lib/ai/withCostLogging.ts`
-- already writes to ai_usage_events, but the table was never defined in a
-- migration (it lived only in the live DB). This makes it reproducible for any
-- dev / fresh environment, and adds the indexes the budget guard needs.
--
-- Idempotent: safe whether or not the table already exists.

create table if not exists ai_usage_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid,                       -- nullable: system/anon calls
  site_id       uuid,
  template_id   uuid,
  provider      text not null,              -- 'openai', ...
  model_code    text not null,              -- 'gpt-4o-mini', ...
  modality      text not null,              -- 'chat'|'embeddings'|'image'|'audio_stt'|'audio_tts'
  input_tokens  int  not null default 0,
  output_tokens int  not null default 0,
  images        int  not null default 0,
  minutes_audio numeric not null default 0,
  cost_usd      numeric(12,6) not null default 0,
  route         text,                        -- API route that triggered the call (for attribution)
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

-- Backfill the `route` column if the table pre-existed without it.
alter table ai_usage_events add column if not exists route text;

-- Indexes for the metering aggregates (spend-by-user-by-day, spend-by-day).
create index if not exists ai_usage_events_created_idx on ai_usage_events (created_at);
create index if not exists ai_usage_events_user_created_idx on ai_usage_events (user_id, created_at);

-- RLS: server-side (service role) writes/reads only; users may read their own usage.
alter table ai_usage_events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'ai_usage_events' and policyname = 'ai_usage_own_read') then
    create policy ai_usage_own_read on ai_usage_events
      for select using (user_id = auth.uid());
  end if;
end $$;

-- Convenience aggregate: spend since a timestamp, optionally for one user.
create or replace function ai_spend_usd(since timestamptz, p_user uuid default null)
returns numeric language sql stable as $$
  select coalesce(sum(cost_usd), 0)
  from ai_usage_events
  where created_at >= since
    and (p_user is null or user_id = p_user);
$$;
