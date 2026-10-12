-- Per-call analysis (lib/ppl/callAnalysis.ts, owner 2026-10-12: "do that for each call that comes
-- in and put the analysis in the call db"). `analysis` holds the FACTS we measured (site visit
-- before the call, caller history, campaign state, voicemail verdict) and the model's read of
-- them; `analysis_summary` is the sentence the alert email and /admin/call-logs show.
alter table public.call_logs add column if not exists analysis jsonb;
alter table public.call_logs add column if not exists analysis_summary text;
alter table public.call_logs add column if not exists analyzed_at timestamptz;
