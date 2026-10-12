-- The voicemail verdict (lib/ppl/voicemailVerdict.ts): is the message a lead for the trade?
-- 'lead' | 'not_lead' | 'unclear'; a not_lead is held back from the business. Recorded with the
-- reason so the row explains itself in /admin/call-logs and the alert email.
alter table public.call_logs add column if not exists voicemail_verdict text;
alter table public.call_logs add column if not exists voicemail_verdict_reason text;
alter table public.call_logs add column if not exists voicemail_judged_at timestamptz;
