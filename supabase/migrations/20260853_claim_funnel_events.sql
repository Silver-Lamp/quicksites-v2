-- 20260853_claim_funnel_events.sql
--
-- The claim funnel's steps: what happens between "a stranger scans the postcard" and "the site is
-- theirs". Sibling of guest_upgrade_events, for the other half of the same wall.
--
-- ⚠️ WHY A TABLE AND NOT POSTHOG. Every step here could have been a captureServer() call — the code
-- already existed and would have looked finished. But PostHog has NEVER been configured in
-- production (`vercel env ls production` returns zero entries), and captureServer returns early
-- without a key, so all 33 existing call sites write to nothing. Instrumenting this funnel into that
-- same silence would have been the third instance in one day of building a measurement that cannot
-- record. The events mirror to PostHog too, best-effort, for whenever the key is set.
--
-- ⚠️ NO PII. The unit is a STEP, not a person: a template id, an optional prospect id, and a coarse
-- reason. No email, no phone, no name, no token. There is no column here to put one in, which is
-- the point — the schema is the boundary.

create table if not exists public.claim_funnel_events (
  id          uuid primary key default gen_random_uuid(),
  -- The draft being claimed. Not a FK: a draft can be deleted and the funnel history should survive
  -- it — losing the record of an attempt would bias the funnel toward the sites that worked out.
  template_id uuid not null,
  -- The outreach prospect, when the visitor arrived from a postcard. Null for an organic claim
  -- (e.g. the delivered.menu claim bar), which is a real and different path.
  prospect_id uuid,
  event       text not null,
  -- Why a step ended the way it did: 'bad_token' | 'not_claimable' | 'already_claimed' | 'error'.
  -- Coarse on purpose; never a provider message.
  reason      text,
  created_at  timestamptz not null default now()
);

create index if not exists claim_funnel_events_created_idx on public.claim_funnel_events (created_at desc);
create index if not exists claim_funnel_events_event_idx   on public.claim_funnel_events (event);
create index if not exists claim_funnel_events_tpl_idx     on public.claim_funnel_events (template_id);

-- ⚠️ DENY-DEFAULT: RLS on, no policies, so only the service role reaches it. Deliberately unlike
-- guest_upgrade_events, which has RLS DISABLED and therefore depends on table grants — a state that
-- makes a browser insert's success a matter of configuration rather than design. Everything here is
-- written server-side, so nothing needs a policy and nothing can silently start failing.
alter table public.claim_funnel_events enable row level security;

comment on table public.claim_funnel_events is
  'Steps between scanning a claim postcard and owning the site. Service-role only; no PII by construction.';
