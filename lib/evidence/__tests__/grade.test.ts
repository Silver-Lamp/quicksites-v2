/**
 * @jest-environment node
 */
// The grade is derived, never typed (lib/evidence/grade.ts). These cases are the ones a guide that
// earns commission would be tempted to round up.
import { describeEvidence, gradeClaim, GRADE_LABEL, type Study } from '@/lib/evidence/grade';
import { MULLEIN_CLAIMS, MULLEIN_STUDIES } from '@/lib/evidence/topics/mullein';

const study = (id: string, over: Partial<Study> = {}): Study => ({
  id,
  title: id,
  url: `https://example.org/${id}`,
  year: 2022,
  design: 'rct_blinded',
  funder: 'unknown',
  peerReviewed: true,
  ...over,
});

// Liu et al. 2022 (JAMA Netw Open): 66 adults 65–90, urolithin A 1,000 mg vs placebo, 4 months.
const LIU = study('liu2022', { n: 66, durationWeeks: 16, population: 'adults 65–90, Seattle' });

describe('gradeClaim', () => {
  it('urolithin A — endurance improved only as a SECONDARY outcome: early, never promising', () => {
    expect(gradeClaim([{ studyId: 'liu2022', primary: false, result: 'improved' }], [LIU])).toBe('early');
  });
  it('urolithin A — walking distance was the PRIMARY outcome and did not move: tested, no effect', () => {
    expect(gradeClaim([{ studyId: 'liu2022', primary: true, result: 'no_difference' }], [LIU])).toBe('tested_no_effect');
  });
  it('one blinded trial positive on its primary outcome is promising; two are established; a pooled RCT analysis is established', () => {
    const a = study('a');
    const b = study('b');
    expect(gradeClaim([{ studyId: 'a', primary: true, result: 'improved' }], [a])).toBe('promising');
    expect(gradeClaim([{ studyId: 'a', primary: true, result: 'improved' }, { studyId: 'b', primary: true, result: 'improved' }], [a, b])).toBe('established');
    const m = study('m', { design: 'meta_analysis_rct' });
    expect(gradeClaim([{ studyId: 'm', primary: true, result: 'improved' }], [m])).toBe('established');
  });
  it('a positive blinded trial outranks a null one (the claim is promising, and the null is shown beside it)', () => {
    const a = study('a');
    const b = study('b');
    expect(gradeClaim([{ studyId: 'a', primary: true, result: 'improved' }, { studyId: 'b', primary: true, result: 'no_difference' }], [a, b])).toBe('promising');
  });
  it('a blinded null on the primary outcome outranks weaker positive evidence', () => {
    const rct = study('rct');
    const obs = study('obs', { design: 'observational', n: 280 });
    const rat = study('rat', { design: 'animal' });
    expect(
      gradeClaim(
        [
          { studyId: 'rct', primary: true, result: 'no_difference' },
          { studyId: 'obs', primary: true, result: 'improved' },
          { studyId: 'rat', primary: true, result: 'improved' },
        ],
        [rct, obs, rat],
      ),
    ).toBe('tested_no_effect');
  });
  it('testimonials, company white papers and narrative reviews never raise a grade', () => {
    const t = study('t', { design: 'testimonial' });
    const w = study('w', { design: 'company_material', peerReviewed: false });
    const r = study('r', { design: 'review_narrative' });
    expect(gradeClaim([{ studyId: 't', primary: true, result: 'improved' }, { studyId: 'w', primary: true, result: 'improved' }, { studyId: 'r', primary: true, result: 'improved' }], [t, w, r])).toBe('no_evidence');
  });
  it('open-label human trials are early; animal and cell work is lab only', () => {
    expect(gradeClaim([{ studyId: 'o', primary: true, result: 'improved' }], [study('o', { design: 'rct_open', n: 10 })])).toBe('early');
    expect(gradeClaim([{ studyId: 'x', primary: true, result: 'improved' }], [study('x', { design: 'in_vitro' })])).toBe('lab_only');
  });
  it('funding never changes the grade', () => {
    const indep = study('i', { funder: 'independent' });
    const maker = study('i', { funder: 'manufacturer' });
    const ev = [{ studyId: 'i', primary: true, result: 'improved' as const }];
    expect(gradeClaim(ev, [indep])).toBe(gradeClaim(ev, [maker]));
  });
  it('an evidence row pointing at an unknown study is ignored, not guessed', () => {
    expect(gradeClaim([{ studyId: 'missing', primary: true, result: 'improved' }], [])).toBe('no_evidence');
  });
  it('every grade has a reader-facing label', () => {
    for (const g of ['established', 'promising', 'early', 'lab_only', 'tested_no_effect', 'no_evidence'] as const) expect(GRADE_LABEL[g]).toBeTruthy();
  });
});

describe('mullein, as recorded (lib/evidence/topics/mullein.ts)', () => {
  const grade = (id: string) => {
    const c = MULLEIN_CLAIMS.find((x) => x.id === id)!;
    return gradeClaim(c.evidence, MULLEIN_STUDIES);
  };
  it('cough and the smokers claim have no evidence — the pages may never say otherwise', () => {
    expect(grade('cough')).toBe('no_evidence');
    expect(grade('smokers-lungs')).toBe('no_evidence');
  });
  it('the six-ingredient ear-drop trial is never credited to mullein', () => {
    expect(grade('ear-pain-combo')).toBe('no_evidence');
  });
  it('every claim carries a plain-language note', () => {
    for (const c of MULLEIN_CLAIMS) expect(c.note.length).toBeGreaterThan(20);
  });
});

describe('describeEvidence', () => {
  it('states design, size, duration, outcome role, result and funder from the record', () => {
    expect(describeEvidence({ studyId: 'liu2022', primary: false, result: 'improved' }, LIU)).toBe(
      'Double-blind randomized trial, 66 people, 16 weeks (2022) — secondary outcome: improved. Funder not checked.',
    );
  });
  it('never invents a sample size, and marks material that does not count', () => {
    const w = study('w', { design: 'company_material', peerReviewed: false, funder: 'manufacturer' });
    expect(describeEvidence({ studyId: 'w', primary: true, result: 'improved' }, w)).toBe(
      "Company's own material, size not stated (2022) — primary outcome: improved. Funded by the manufacturer. Not counted toward the grade.",
    );
  });
});
