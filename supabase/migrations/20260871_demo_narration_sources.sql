-- 20260871_demo_narration_sources.sql
--
-- Two narration sources per line: what the owner actually read, and a synthesised version in
-- his consented HiveJournal voice clone. He picks which to publish.
--
-- ⚠️ THE UNIQUE KEY GAINS `source`, so the two coexist instead of overwriting each other.
-- Keyed (clip_key, line_index, source): one take per line per source, still at-most-one each.
--
-- ⚠️ `voice_basis` IS NOT DECORATION. It records which voice HJ says actually spoke — `self`
-- (the owner's own consented clone) or `narrator` (the house voice). Nothing may be labelled
-- "in the owner's voice" unless HJ reported `self`; an unreported basis must read as unknown,
-- never as self. Same rule as the audio-honesty standard everywhere else in the mesh.
-- A human recording is `recorded` with no basis to report: it is simply him.

alter table public.demo_narration_takes
  add column if not exists source text not null default 'recorded'
    check (source in ('recorded', 'tts')),
  add column if not exists voice_basis text
    check (voice_basis is null or voice_basis in ('self', 'narrator')),
  -- Provenance for a synthesised take: which HJ embed produced it.
  add column if not exists embed_id text;

-- Swap the uniqueness: one take per line PER SOURCE.
alter table public.demo_narration_takes
  drop constraint if exists demo_narration_takes_one_per_line;

create unique index if not exists demo_narration_takes_one_per_line_source
  on public.demo_narration_takes (clip_key, line_index, source);

-- ⚠️ A recorded take can never carry a voice_basis, and a tts take should always have one it
-- was TOLD rather than one we assumed. Enforced here because the honest label depends on it.
alter table public.demo_narration_takes
  drop constraint if exists demo_narration_takes_basis_fits_source;
alter table public.demo_narration_takes
  add constraint demo_narration_takes_basis_fits_source
  check (source <> 'recorded' or voice_basis is null);

comment on column public.demo_narration_takes.source is
  'recorded = the owner read it; tts = synthesised via the HJ partner grant.';
comment on column public.demo_narration_takes.voice_basis is
  'For tts only: which voice HJ reported actually spoke. NULL means unknown — never label it as the owner''s voice.';
