-- 20260822_outreach_touches.sql
--
-- Outreach history: what we actually sent, and what came back.
--
-- ⚠️ TIMESTAMPS ARE NOT A RECORD. `outreach_prospects` already has `postcard_sent_at` and
-- `sms_sent_at`, and they answer "did something happen" while saying nothing about WHAT. Three
-- weeks after a text, "what price did I quote them?" has no answer anywhere in this system. That
-- is the same failure this codebase keeps paying for — a marker standing in for the thing itself,
-- looking like a record because it has a date on it.
--
-- ⚠️ THE BODY IS STORED VERBATIM AND IS REQUIRED. A summary of what you sent is not evidence of
-- what you sent. Same reasoning as hashing the exact agreement text rather than trusting the row:
-- when it matters, it matters precisely because someone disagrees about the wording. `body` is
-- NOT NULL with no default, so a caller cannot log a contact without saying what it was.
--
-- ⚠️ INBOUND IS FIRST-CLASS. Their reply is half the history and usually the more useful half —
-- "not interested", "call me Tuesday", a price question. A log that only records our side is a
-- record of our intentions, not of a conversation.
--
-- Deny-default RLS: this is operator-only data about third parties who have not signed up.

create table if not exists public.outreach_touches (
  id            uuid primary key default gen_random_uuid(),

  -- What this contact was about. Any combination; at least one is enforced below.
  template_id   uuid references public.templates(id) on delete set null,
  prospect_id   uuid,
  -- For a contact with neither — a flyer in a driveway before any record exists.
  subject_label text,

  -- 'outbound' (we contacted them) | 'inbound' (they replied).
  direction     text not null check (direction in ('outbound', 'inbound')),

  -- sms | email | postcard | call | in_person | other. Free text, not an enum: the set of ways
  -- you can talk to a contractor is not ours to close, and a migration to add "WhatsApp" would be
  -- a silly reason to block someone logging a real conversation.
  channel       text not null,

  -- ⚠️ Verbatim. See the header.
  body          text not null,

  -- Optional: the flyer PDF actually sent, a screenshot of the thread.
  attachment_url  text,
  attachment_name text,

  -- When the contact happened — NOT when it was logged. Someone recording yesterday's phone call
  -- today must be able to say so, or the history quietly becomes a log of data entry.
  occurred_at   timestamptz not null default now(),

  actor_id      uuid,
  created_at    timestamptz not null default now(),

  -- A touch that belongs to nothing cannot be found again.
  constraint outreach_touches_has_subject
    check (template_id is not null or prospect_id is not null or nullif(btrim(subject_label), '') is not null)
);

create index if not exists outreach_touches_template_idx on public.outreach_touches (template_id, occurred_at desc);
create index if not exists outreach_touches_prospect_idx on public.outreach_touches (prospect_id, occurred_at desc);
create index if not exists outreach_touches_recent_idx  on public.outreach_touches (occurred_at desc);

comment on column public.outreach_touches.body is
  'Verbatim text of the message. Never a summary — the point is to answer "what exactly did I say".';
comment on column public.outreach_touches.occurred_at is
  'When the contact happened, not when it was typed in.';

alter table public.outreach_touches enable row level security;
-- No policies: operator-only, service-role via admin-gated routes.
