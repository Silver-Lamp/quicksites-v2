-- 20260817_collab_option_notes.sql
--
-- What each option is BETTING ON, in the operator's words, on the card itself.
--
-- ⚠️ WHY THIS EXISTS. Three screenshots that differ in ways a non-technical person has to
-- reverse-engineer is not a choice, it is a guess. The operator invariably explains the axis
-- ("A leads with you, B leads with the offer") — but he explains it in the conversation thread,
-- which is a different column of the page from the cards being compared, and is scrolled past.
-- Stating the bet next to the thing making it gives her something to decide ON.
-- (DeckSketch, cold mesh poll 2026-08-04: "give her an axis to choose on instead of a gut
-- reaction to three images". Decision support, not decoration.)
--
-- ⚠️ WHY IT LIVES ON client_collabs AND NOT ON collab_option_versions. The live collab has ZERO
-- version rows — `resolveOptions` falls back to `client_collabs.template_ids`, and that fallback
-- is a supported state, not an unmigrated one (see lib/collab/versions.ts). A column on the
-- versions table could not be populated for the only collab in production without first
-- manufacturing version rows, i.e. the model would require a backfill before it worked.
--
-- ⚠️ KEYED BY OPTION LETTER, NOT TEMPLATE ID. The bet belongs to the OPTION — "B leads with the
-- offer" is still true of B's v2, which is the entire reason a v2 exists. Keying it to a template
-- would silently drop the rationale the moment a revision landed, leaving the revised card as the
-- only one that cannot explain itself.
--
-- Shape: { "A": "Leads with you — your name and your read first.", "B": "…" }
-- An absent key renders NOTHING. A card with no stated bet is honest; a card with an invented one
-- is the operator putting a rationale he never chose in front of a client.

alter table public.client_collabs
  add column if not exists option_notes jsonb not null default '{}'::jsonb;

comment on column public.client_collabs.option_notes is
  'Per-option rationale keyed by option letter (A/B/C): what that direction is betting on, in the operator''s words. Rendered on the option card. Absent key = render nothing.';
