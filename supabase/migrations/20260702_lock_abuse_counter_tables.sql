-- Lock the abuse-counter + metering + ledger tables (RLS deny-default).
--
-- These were RLS-DISABLED, so the browser anon key / any authenticated (incl.
-- anonymous guest) session could write them directly via PostgREST. That let an
-- abuser DELETE their own rows to RESET every guard we just built:
--   guest_token_usage  → resets the per-guest AI call cap (enforceGuestAiLimit)
--   ratelimit_events   → resets the per-IP guest-draft rate limit
--   ai_usage_events    → evades the dollar budget guard / pollutes cost data
--   schema_migrations  → tampers the migration ledger
--
-- Every one of these is written (and read) ONLY via the service-role client or
-- psql (verified): guestGuard/rateLimit/withCostLogging use supabaseAdmin, the
-- ai-costs admin page uses the service-role key, the ledger is psql-only. So
-- enabling RLS with NO policies (deny-default) blocks anon/authenticated while the
-- service role (which bypasses RLS) keeps working — no app change needed.
alter table public.guest_token_usage enable row level security;
alter table public.ratelimit_events  enable row level security;
alter table public.ai_usage_events   enable row level security;
alter table public.schema_migrations enable row level security;
