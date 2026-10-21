-- 20260903_caller_blocks.sql
--
-- Caller BLOCKS beside caller screens (owner, 2026-10-21: "repeat robocallers being reported
-- from 2 calls today, can we start a block list and just block or drop them").
--
-- A screened number is offered voicemail (a wrongly screened customer still gets through by
-- message). A BLOCKED number is rejected before the call is answered — nothing is said, nothing
-- is recorded, nobody is texted or emailed. Reserved for numbers whose own behaviour on our lines
-- proves they are a dialer: a person clicks Block on /admin/call-logs, or the deterministic
-- repeat pattern in lib/ppl/callerScreen.ts#repeatPatternDecision fires (≥ N sub-15-second calls
-- across ≥ 2 of our lines in 30 days, none connected, no message left — our own call records,
-- never the AI read alone).
--
-- ⚠️ AND A LATENT BUG, FOUND WHILE ADDING THIS: `call_logs_handling_check` (20260865) admits
-- forward / cascade / voicemail_first / ppl / no_destination. The screen branch (20260887) writes
-- handling = 'screened' and the own-number branch writes 'own_business' — both refused by the
-- constraint, both inside the entry route's best-effort try/catch, so every screened and every
-- own-business call since 2026-10-15 was NEVER LOGGED (0 rows with either value; the status
-- callback then updated a row that did not exist). Widened here; lib/ppl/__tests__/handlingValues
-- .test.ts pins every handling literal the routes write to this list.

alter table public.call_logs drop constraint if exists call_logs_handling_check;
alter table public.call_logs
  add constraint call_logs_handling_check
  check (handling is null or handling in ('forward', 'cascade', 'voicemail_first', 'ppl', 'no_destination', 'screened', 'own_business', 'blocked'));

alter table public.caller_screens add column if not exists mode text not null default 'screen';
alter table public.caller_screens drop constraint if exists caller_screens_mode_check;
alter table public.caller_screens add constraint caller_screens_mode_check check (mode in ('screen', 'block'));

alter table public.caller_screens drop constraint if exists caller_screens_reason_check;
alter table public.caller_screens add constraint caller_screens_reason_check check (reason in ('vendor_voicemail', 'operator', 'repeat_pattern'));

comment on column public.caller_screens.mode is 'screen = offered voicemail, never bridged; block = rejected before answer (lib/ppl/callerScreen.ts)';
