-- Caller screens (lib/ppl/callerScreen.ts). A number on this list is not forwarded to the
-- business: the tracking line tells it the number doesn't connect sales calls and takes a
-- voicemail instead, which the existing voicemail pipeline transcribes, judges and relays — so a
-- wrongly screened customer still gets through, by message (owner, 2026-10-15: "if we detect an
-- Angie's lead call can we not forward?").
--   reason   'vendor_voicemail' — the number's own voicemail named a lead-gen vendor and was judged
--            not a lead (deterministic keyword match + the verdict, never the verdict alone)
--            'operator'         — a person screened it from /admin/call-logs
--   evidence what was said / why, for the person who later asks "why is this number screened"
--   released_at — a screen is lifted, never deleted, so the history of the decision survives
create table if not exists public.caller_screens (
  number text primary key,
  reason text not null check (reason in ('vendor_voicemail','operator')),
  evidence text,
  source_call_id uuid references public.call_logs(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid,
  release_note text
);
create index if not exists caller_screens_active_idx on public.caller_screens (number) where released_at is null;

-- Deny-default: service role only (the Twilio entry route and admin routes).
alter table public.caller_screens enable row level security;
