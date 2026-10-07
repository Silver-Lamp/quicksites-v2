-- 20260875_call_logs_voicemail_speech.sql
--
-- What a voicemail actually contained, decided by a metered transcription before anyone is told
-- "relay it to a local business".
--
-- ⚠️ WHY. On 2026-10-07 04:29 a fax machine dialled covingtontow.com, got the voicemail greeting
-- and left 21 seconds of CNG tones. The operator email said "New lead … Relay it to a local
-- business", because the only thing it knew was that a recording existed. Twenty seconds of
-- Whisper settles whether a human spoke; the email can then say so instead of asking someone to
-- listen to a fax.
--
-- `voicemail_speech`: 'speech' | 'no_speech' | 'unknown' (transcription failed or not attempted).
-- `voicemail_transcript`: Whisper's text when speech was found; NULL otherwise. ⚠️ This is a
-- member of the public's message about their own situation — it stays on the same service-role
-- only table as the recording URL, and the public voicemail link still serves audio, never text.

alter table public.call_logs
  add column if not exists voicemail_speech text,
  add column if not exists voicemail_transcript text,
  add column if not exists voicemail_transcribed_at timestamptz;

comment on column public.call_logs.voicemail_speech is
  'speech | no_speech | unknown — whether a human spoke on the voicemail, from a metered transcription (lib/ppl/voicemailSpeech.ts).';
