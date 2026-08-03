-- 20260816_collab_feedback.sql
--
-- Two additions to the client collaboration model:
--
--   1. collab_feedback        — reviews of the options, from AI mesh sessions and AI personas
--   2. collab_option_versions — an option is a LINEAGE, not one template, so feedback can be
--                               applied to a v2 without destroying the v1 the client already saw
--
-- ⚠️ EVERY REVIEW ROW CARRIES ITS OWN HONESTY NOTE, AND `reviewer_is_ai` IS NOT NULL WITH NO
-- DEFAULT. Both sources here are AI — a sibling Claude session, or an HJ browsing persona — and
-- this feedback is rendered on a page a real client reads while deciding about her own business.
-- "Three reviewers preferred B" is a sentence that means something very different depending on
-- whether those reviewers were people. A default would let a caller omit the field and have the
-- safe-looking value chosen for them; there is no default, so the question must be answered.
-- Same standard as voice_basis (audio), rule 9 (imagery), and honesty_note (persona findings):
-- label the AI at creation, in the record, not in a UI badge someone can forget to render.
--
-- ⚠️ `visible_to_client` DEFAULTS TO FALSE, AND THAT IS THE WHOLE CURATION GATE. Persona findings
-- arrive as CLAIMS — that is why they file at status 'triage' rather than 'open'. Auto-publishing
-- an unconfirmed claim onto the client's own page is the same cry-wolf failure the persona
-- contract warns about, except the person who loses trust is the customer rather than a triager.
-- An operator promotes a review to visible; nothing arrives visible.

create table if not exists public.collab_feedback (
  id            uuid primary key default gen_random_uuid(),
  collab_id     uuid not null references public.client_collabs(id) on delete cascade,

  -- Which option it is about. Null = about the set as a whole ("I'd pick B").
  template_id   uuid references public.templates(id) on delete set null,

  -- 'mesh'     — a sibling Claude session (HiveJournal, DeckSketch, PorchHearth)
  -- 'persona'  — an HJ browsing persona, via /api/persona-findings
  -- 'operator' — a human note recorded alongside, so the thread is complete
  source        text not null check (source in ('mesh', 'persona', 'operator')),

  -- Who specifically: 'PorchHearth', 'Daniel Wilson (persona)', a person's name.
  source_label  text not null,

  -- ⚠️ No default. See the header.
  reviewer_is_ai boolean not null,

  -- Rendered verbatim wherever the review is shown, exactly like persona findings.
  honesty_note  text,

  body          text not null,

  -- Which option this reviewer would choose, if they said. Free text ('A'/'B'/'C') rather than
  -- a reference, because a reviewer's preference is a statement about what they saw, and it must
  -- survive the option later being replaced by a v2.
  picked_option text,

  -- new → applied (we changed something because of it) → dismissed (we considered and didn't).
  -- 'dismissed' is a first-class outcome on purpose: feedback with no way to be declined turns
  -- into a backlog nobody closes.
  status        text not null default 'new' check (status in ('new', 'applied', 'dismissed')),

  -- The gate. Nothing reaches the client's page until an operator says so.
  visible_to_client boolean not null default false,

  created_at    timestamptz not null default now()
);

create index if not exists collab_feedback_collab_idx
  on public.collab_feedback (collab_id, created_at desc);

-- ── Option versions ────────────────────────────────────────────────────────────────────────
--
-- ⚠️ AN OPTION IS A LINEAGE. Applying feedback by editing the template in place would silently
-- rewrite what the client already looked at — she would come back to a page that had changed
-- under her, with no way to see what it used to be or to say "actually I preferred the old one".
-- A new version is a new template row; the old one stays published and viewable.
--
-- ⚠️ NO ROWS HERE MEANS "one version each, in client_collabs.template_ids". The existing live
-- collab predates this table, and a model that requires a backfill to keep working is a model
-- that breaks the one thing already in production. Readers fall back; writers create rows.

create table if not exists public.collab_option_versions (
  id            uuid primary key default gen_random_uuid(),
  collab_id     uuid not null references public.client_collabs(id) on delete cascade,

  -- Stable across versions: option A stays option A when its v2 is built. This is why the label
  -- is not derived from array position — a client who has been told "B" must keep meaning B.
  option_key    text not null,

  version       int  not null check (version >= 1),
  template_id   uuid not null references public.templates(id) on delete cascade,

  -- What changed and why, in one line, shown next to the version switcher.
  note          text,

  created_at    timestamptz not null default now(),

  unique (collab_id, option_key, version)
);

create index if not exists collab_option_versions_lookup_idx
  on public.collab_option_versions (collab_id, option_key, version desc);

alter table public.collab_feedback enable row level security;
alter table public.collab_option_versions enable row level security;

drop policy if exists collab_feedback_deny_all on public.collab_feedback;
create policy collab_feedback_deny_all on public.collab_feedback for all using (false) with check (false);

drop policy if exists collab_option_versions_deny_all on public.collab_option_versions;
create policy collab_option_versions_deny_all on public.collab_option_versions for all using (false) with check (false);

comment on column public.collab_feedback.reviewer_is_ai is
  'No default by design. This feedback renders on a real client''s page; whether a reviewer was a person is not a question a caller may skip.';
comment on column public.collab_feedback.visible_to_client is
  'Curation gate. Persona findings are unconfirmed claims; nothing reaches the client until an operator promotes it.';
comment on table public.collab_option_versions is
  'An option is a lineage of templates. No rows = one version each, from client_collabs.template_ids.';
