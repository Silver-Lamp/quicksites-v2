// lib/evidence/grade.ts — the evidence grade for a health claim, derived from the studies behind it.
//
// Contract: crosstalk/contracts/evidence-grade.md (PROPOSED 2026-10-21). Plan: docs/LONGEVITY_PLAN.md.
//
// ⚠️ WHY A FUNCTION, NOT A FIELD. A guide that earns affiliate commission on what it grades will
// drift toward kinder grades if a person types the grade. So nobody types it: a claim lists its
// studies, each study records its design, size, outcome role and result, and the grade is DERIVED.
// To change a grade you have to change the evidence — which is visible, sourced and dated.
//
// Rules that are deliberate and pinned by tests:
//   - Testimonials and company white papers NEVER raise a grade. The FTC's 2022 Health Products
//     Compliance Guidance: consumer anecdotes never substantiate a health claim, and a testimonial
//     cannot make a claim the seller could not substantiate itself.
//   - A trial that tested the claim as its PRIMARY outcome and found nothing outranks everything
//     weaker that is positive: "tested, no effect" is a finding, not an absence.
//   - A positive SECONDARY outcome is never "established" — it is the result the trial was not
//     designed around, which is where chance findings live.
//   - Funding never changes the grade, and is always printed. A manufacturer-funded blinded trial
//     is still a blinded trial; the reader is told who paid.

export type StudyDesign =
  | 'meta_analysis_rct' // a systematic review that pooled randomized trials
  | 'rct_blinded' // double-blind placebo- or sham-controlled
  | 'rct_open' // randomized, not blinded
  | 'observational' // cohort, case-control, cross-sectional
  | 'case_series'
  | 'animal'
  | 'in_vitro'
  | 'review_narrative' // a review without pooled analysis
  | 'company_material' // white papers, brand blog "studies" without a journal
  | 'testimonial';

export type OutcomeResult = 'improved' | 'no_difference' | 'worse' | 'not_reported';

export type Funder = 'independent' | 'manufacturer' | 'mixed' | 'unknown';

export type Study = {
  id: string;
  title: string;
  url: string;
  year: number;
  design: StudyDesign;
  /** People (or animals) randomized/enrolled. Omit when the source does not say — never guess. */
  n?: number;
  durationWeeks?: number;
  population?: string;
  funder: Funder;
  peerReviewed: boolean;
  preRegistered?: boolean;
};

/** How one study bears on one claim. */
export type ClaimEvidence = {
  studyId: string;
  /** Was this the trial's PRIMARY outcome? Secondary results are weaker by design. */
  primary: boolean;
  result: OutcomeResult;
};

export type EvidenceGrade =
  | 'established' // ≥2 independent-of-each-other blinded RCTs (or a pooled RCT meta-analysis) positive on a primary outcome
  | 'promising' // ≥1 blinded RCT positive on a primary outcome
  | 'early' // human data, but open-label, observational, or a secondary outcome only
  | 'lab_only' // animal or cell studies only
  | 'tested_no_effect' // a blinded RCT tested it as the primary outcome and found nothing, and nothing stronger is positive
  | 'no_evidence'; // nothing but marketing, testimonials or narrative reviews

export const GRADE_LABEL: Record<EvidenceGrade, string> = {
  established: 'Established',
  promising: 'Promising',
  early: 'Early evidence',
  lab_only: 'Lab studies only',
  tested_no_effect: 'Tested — no effect found',
  no_evidence: 'No real evidence',
};

const NEVER_COUNTS: ReadonlySet<StudyDesign> = new Set(['testimonial', 'company_material', 'review_narrative']);
const BLINDED: ReadonlySet<StudyDesign> = new Set(['rct_blinded', 'meta_analysis_rct']);
const HUMAN: ReadonlySet<StudyDesign> = new Set(['meta_analysis_rct', 'rct_blinded', 'rct_open', 'observational', 'case_series']);

/** Pure. The grade for one claim from the studies listed against it. Unknown study ids are ignored, never guessed. */
export function gradeClaim(evidence: ClaimEvidence[], studies: Study[]): EvidenceGrade {
  const byId = new Map(studies.map((s) => [s.id, s]));
  const rows = evidence
    .map((e) => ({ e, s: byId.get(e.studyId) }))
    .filter((r): r is { e: ClaimEvidence; s: Study } => !!r.s && !NEVER_COUNTS.has(r.s.design));

  const blindedPrimaryPositive = rows.filter((r) => BLINDED.has(r.s.design) && r.e.primary && r.e.result === 'improved');
  const pooled = blindedPrimaryPositive.some((r) => r.s.design === 'meta_analysis_rct');
  if (pooled || blindedPrimaryPositive.length >= 2) return 'established';
  if (blindedPrimaryPositive.length === 1) return 'promising';

  const blindedPrimaryNull = rows.some((r) => BLINDED.has(r.s.design) && r.e.primary && (r.e.result === 'no_difference' || r.e.result === 'worse'));
  if (blindedPrimaryNull) return 'tested_no_effect';

  if (rows.some((r) => HUMAN.has(r.s.design) && r.e.result === 'improved')) return 'early';
  if (rows.some((r) => (r.s.design === 'animal' || r.s.design === 'in_vitro') && r.e.result === 'improved')) return 'lab_only';
  return 'no_evidence';
}

const DESIGN_WORDS: Record<StudyDesign, string> = {
  meta_analysis_rct: 'pooled analysis of randomized trials',
  rct_blinded: 'double-blind randomized trial',
  rct_open: 'open-label randomized trial',
  observational: 'observational study',
  case_series: 'case series',
  animal: 'animal study',
  in_vitro: 'lab (cell) study',
  review_narrative: 'narrative review',
  company_material: "company's own material",
  testimonial: 'customer testimonial',
};

const RESULT_WORDS: Record<OutcomeResult, string> = {
  improved: 'improved',
  no_difference: 'no difference from placebo',
  worse: 'worse than placebo',
  not_reported: 'result not reported',
};

/**
 * One plain sentence per study, for the guide: "Double-blind randomized trial, 66 people, 16 weeks
 * (2022) — secondary outcome: improved. Funder: unknown." Every number comes from the record; a
 * missing n says "size not stated" rather than inventing one.
 */
export function describeEvidence(e: ClaimEvidence, s: Study): string {
  const size = typeof s.n === 'number' ? `${s.n} ${s.design === 'animal' ? 'animals' : 'people'}` : 'size not stated';
  const dur = typeof s.durationWeeks === 'number' ? `, ${s.durationWeeks} weeks` : '';
  const role = e.primary ? 'primary outcome' : 'secondary outcome';
  const funder = s.funder === 'unknown' ? 'funder not checked' : `funded by ${s.funder === 'manufacturer' ? 'the manufacturer' : s.funder === 'mixed' ? 'mixed sources' : 'independent sources'}`;
  const design = DESIGN_WORDS[s.design];
  const counts = NEVER_COUNTS.has(s.design) ? ' Not counted toward the grade.' : '';
  return `${design[0].toUpperCase()}${design.slice(1)}, ${size}${dur} (${s.year}) — ${role}: ${RESULT_WORDS[e.result]}. ${funder[0].toUpperCase()}${funder.slice(1)}.${counts}`;
}
