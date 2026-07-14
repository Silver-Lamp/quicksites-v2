// lib/rebuild/pitchPipeline.ts
//
// Pure helpers for the "created from a site URL" provenance + the pitch pipeline shown
// on the templates list (card + table). A URL-rebuild (app/api/rebuild) stamps two
// things we read here:
//   • data.meta.rebuilt_from  → the prospect's original site URL
//   • data.meta.rebuild_source = 'ai_rebuild' (and claim_source 'ai_rebuild' for
//     signed-in operators; 'guest_build' for anon, which still carries rebuilt_from)
// The pipeline turns that into an ordered set of next-steps for pitching the freshly
// rebuilt site back to the business it was scraped from. Kept framework-free so it can
// be unit-tested and reused server-side.

export type RebuildProvenance = {
  /** The original site URL we rebuilt from, if stored. */
  sourceUrl: string | null;
  /** Bare host (no scheme/www), for compact display. */
  sourceHost: string | null;
};

export type PitchStepKey = 'polish' | 'publish' | 'pitch' | 'claim';

export type PitchStep = {
  key: PitchStepKey;
  label: string;
  hint: string;
  /** Derivable from observable row state (live/published); advisory steps stay false. */
  done: boolean;
};

export type RebuildPitch = {
  /** True when this row was created by pasting an existing site URL. */
  isRebuild: boolean;
  provenance: RebuildProvenance | null;
  steps: PitchStep[];
  /** First not-yet-done step — the recommended next action. */
  nextStep: PitchStep | null;
};

function parseData(v: any): any {
  if (!v) return {};
  if (typeof v === 'object') return v;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return {}; } }
  return {};
}

/** meta bag, whether the row stored `data.meta` or a flattened `data`. */
function metaOf(row: any): any {
  const d = parseData(row?.data);
  return (d?.meta && typeof d.meta === 'object' ? d.meta : d) ?? {};
}

/** Bare host from a URL (no scheme, no leading www). Null if unparseable. */
export function hostFromUrl(u?: string | null): string | null {
  if (!u) return null;
  const raw = String(u).trim();
  if (!raw) return null;
  try {
    return new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Provenance for a list row, or null when it wasn't rebuilt from a URL. */
export function rebuildProvenance(row: any): RebuildProvenance | null {
  const meta = metaOf(row);
  const src = typeof meta?.rebuilt_from === 'string' ? meta.rebuilt_from.trim() : '';
  const claim = String(row?.claim_source ?? meta?.rebuild_source ?? '');
  const isRebuild = !!src || claim === 'ai_rebuild';
  if (!isRebuild) return null;
  return { sourceUrl: src || null, sourceHost: src ? hostFromUrl(src) : null };
}

/** Does the row have a shareable live URL (custom/geo domain or an explicit publish)? */
function isLive(row: any): boolean {
  const dom = String(row?.custom_domain ?? row?.domain ?? '').trim();
  return !!dom || row?.published === true;
}

/**
 * The pitch pipeline for a rebuilt site. `done` is conservative: the two early
 * milestones flip once the site is live (that's the strongest signal we have in a
 * list row — published state isn't always hydrated), and the outreach steps stay
 * advisory since we can't observe whether a pitch was sent.
 */
export function rebuildPitch(row: any): RebuildPitch {
  const provenance = rebuildProvenance(row);
  if (!provenance) return { isRebuild: false, provenance: null, steps: [], nextStep: null };

  const live = isLive(row);
  const steps: PitchStep[] = [
    {
      key: 'polish',
      label: 'Review & polish',
      hint: 'Check the AI captured the business correctly — fix the hero, services, and contact info.',
      done: live,
    },
    {
      key: 'publish',
      label: 'Publish a shareable link',
      hint: 'Publish so you have a live URL to show the owner.',
      done: live,
    },
    {
      key: 'pitch',
      label: 'Pitch it to the owner',
      hint: 'Send the before/after and your offer to the business you rebuilt.',
      done: false,
    },
    {
      key: 'claim',
      label: 'Hand off & close',
      hint: 'Let them claim the site and convert to a paying customer.',
      done: false,
    },
  ];

  const nextStep = steps.find((s) => !s.done) ?? null;
  return { isRebuild: true, provenance, steps, nextStep };
}
