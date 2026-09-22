// lib/niches/score.ts
//
// Score a candidate niche from measured supply density plus the hand-set judgements on the
// candidate (lib/niches/candidates.ts). PURE — the probe script does the I/O.
//
// The question this answers is NOT "is there demand?" It is "can an organic result win the page
// at all?" Those come apart badly: towing has enormous demand and we cannot win a single query,
// because the screen is three map pins and the searcher is in a ditch.
//
// ⚠️ ONE MEASURED INPUT, THREE JUDGED ONES. Only `perMetro` comes from Places. `ticket`,
// `intent` and `toolFit` are written by hand on each candidate. The verdict text says which is
// which, because a score that hides that invites someone to trust the judgement as data.
//
// ⚠️ AND THE BIG ONE: supply density is a PROXY for local-pack strength, not a measurement of
// it. Nobody here has read a SERP. A candidate that scores well has earned a SERP check, not a
// domain purchase — `verdictFor` says so in words rather than leaving it implied.

import type { Intent, NicheCandidate, Ticket, ToolFit } from '@/lib/niches/candidates';

/** Places results for one candidate in one metro. */
export type MetroCount = { city: string; region: string; count: number };

export type NicheMeasurement = {
  key: string;
  metros: MetroCount[];
};

/**
 * Density bands, anchored to our own two cohorts rather than to a rule of thumb:
 * towing measured 6.4 businesses per city and loses; domes measured ~2 per STATE and works.
 */
export const DENSITY_BANDS = [
  { max: 2.5, label: 'thin', points: 40 },
  { max: 5, label: 'moderate', points: 25 },
  { max: 9, label: 'dense', points: 8 },
  { max: Infinity, label: 'saturated', points: 0 },
] as const;

export type DensityLabel = (typeof DENSITY_BANDS)[number]['label'];

const TICKET_POINTS: Record<Ticket, number> = { low: 0, mid: 12, high: 20 };
/** The single heaviest term. An emergency search is decided before a website loads. */
const INTENT_POINTS: Record<Intent, number> = { emergency: 0, considered: 25 };
const TOOL_POINTS: Record<ToolFit, number> = { none: 0, partial: 8, direct: 15 };

export function averagePerMetro(metros: readonly MetroCount[]): number {
  if (!metros.length) return 0;
  const total = metros.reduce((s, m) => s + m.count, 0);
  return Math.round((total / metros.length) * 10) / 10;
}

export function densityBand(perMetro: number): { label: DensityLabel; points: number } {
  const band = DENSITY_BANDS.find((b) => perMetro <= b.max) ?? DENSITY_BANDS[DENSITY_BANDS.length - 1];
  return { label: band.label, points: band.points };
}

export type NicheScore = {
  key: string;
  label: string;
  perMetro: number;
  /** Metros where Places found nothing — the strongest single signal on this list. */
  emptyMetros: number;
  metrosProbed: number;
  density: DensityLabel;
  score: number;
  verdict: string;
  note: string;
};

/**
 * 0–100. Density 40 + intent 25 + ticket 20 + tool 15. Intent and density together are 65 of
 * the 100 on purpose: they are the two that sank towing, and no amount of ticket size or tooling
 * rescued it.
 */
export function scoreNiche(candidate: NicheCandidate, measurement: NicheMeasurement): NicheScore {
  const perMetro = averagePerMetro(measurement.metros);
  const band = densityBand(perMetro);
  const score =
    band.points +
    INTENT_POINTS[candidate.intent] +
    TICKET_POINTS[candidate.ticket] +
    TOOL_POINTS[candidate.toolFit];

  return {
    key: candidate.key,
    label: candidate.label,
    perMetro,
    emptyMetros: measurement.metros.filter((m) => m.count === 0).length,
    metrosProbed: measurement.metros.length,
    density: band.label,
    score,
    verdict: verdictFor(candidate, band.label, score),
    note: candidate.note,
  };
}

export function verdictFor(candidate: NicheCandidate, density: DensityLabel, score: number): string {
  if (candidate.intent === 'emergency') {
    return 'Skip — emergency intent. The map pack decides this before a site loads, whatever the density.';
  }
  if (density === 'saturated') {
    return 'Skip — supply is saturated; the local pack is full and organic sits below the fold.';
  }
  if (score >= 75) {
    return 'Probe the SERP next: read 10 real searches. If the pack is thin or absent, this is a cohort.';
  }
  if (score >= 55) {
    return 'Worth a SERP read, but the weakest term is doing the damage — fix that assumption before spending.';
  }
  return 'Park it. Nothing here beats the dome benchmark; revisit if a tool or a partner changes the tool-fit term.';
}

/** Highest score first; ties broken by the measured term, never by the judged ones. */
export function rankNiches(scores: readonly NicheScore[]): NicheScore[] {
  return [...scores].sort((a, b) => b.score - a.score || a.perMetro - b.perMetro);
}
