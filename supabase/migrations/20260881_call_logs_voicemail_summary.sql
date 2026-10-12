-- The AI summary of a spoken voicemail (lib/ppl/voicemailVerdict.ts): one sentence of what the
-- caller wants, texted to the business beside the recording link, labelled as an AI summary.
alter table public.call_logs add column if not exists voicemail_summary text;
