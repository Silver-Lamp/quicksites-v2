// lib/evidence/topics/urolithinA.ts — urolithin A (sold as Mitopure; Timeline is the maker's brand),
// as evidence records (lib/evidence/grade.ts). Read 2026-10-21 from PubMed abstracts, with blinding,
// enrolment and sponsor confirmed on ClinicalTrials.gov where the abstract did not state them.
//
// ⚠️ Three of these four trials were sponsored by the ingredient's maker, Amazentis SA (stated in the
// papers' conflict-of-interest sections or the registry). That never changes a grade, and is always
// printed. The 2019 first-in-human study (Andreux, Nat Metab) is not entered: its abstract states a
// safety primary outcome and biomarker secondaries but not its design, so it cannot be recorded
// without guessing.
import type { Study } from '@/lib/evidence/grade';
import type { TopicClaim } from '@/lib/evidence/topics/mullein';

export const UROLITHIN_A_EVIDENCE_CHECKED = '2026-10-21';

export const UROLITHIN_A_STUDIES: Study[] = [
  {
    id: 'liu2022',
    title: 'Effect of urolithin A supplementation on muscle endurance and mitochondrial health in older adults (JAMA Netw Open 2022;5:e2144279)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35050355/',
    year: 2022,
    design: 'rct_blinded',
    n: 66,
    durationWeeks: 16,
    population: 'adults 65–90, Seattle; 1,000 mg/day vs placebo. One author was an Amazentis employee during the study',
    funder: 'unknown',
    peerReviewed: true,
    preRegistered: true,
  },
  {
    id: 'singh2022',
    title: 'Urolithin A improves muscle strength, exercise performance, and biomarkers of mitochondrial health in middle-aged adults (Cell Rep Med 2022;3:100633)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35584623/',
    year: 2022,
    design: 'rct_blinded',
    n: 90,
    durationWeeks: 16,
    population: 'middle-aged adults, two doses vs placebo; triple-blind per ClinicalTrials.gov NCT03464500 (90 enrolled)',
    funder: 'manufacturer',
    peerReviewed: true,
    preRegistered: true,
  },
  {
    id: 'denk2025',
    title: 'Effect of the mitophagy inducer urolithin A on age-related immune decline (Nat Aging 2025;5:2309)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/41174221/',
    year: 2025,
    design: 'rct_blinded',
    n: 50,
    durationWeeks: 4,
    population: 'healthy middle-aged adults, 1,000 mg/day vs placebo',
    funder: 'manufacturer',
    peerReviewed: true,
    preRegistered: true,
  },
  {
    id: 'ou2026',
    title: 'Urolithin A and endothelial and cerebrovascular function in middle-aged adults with obesity (JAMA Netw Open 2026;9:e2638047)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/42853569/',
    year: 2026,
    design: 'rct_blinded',
    n: 50,
    durationWeeks: 4,
    population: 'adults 40–64 with obesity, 1,000 mg/day vs placebo, University of Oklahoma',
    funder: 'unknown',
    peerReviewed: true,
    preRegistered: true,
  },
];

export const UROLITHIN_A_CLAIMS: TopicClaim[] = [
  {
    id: 'endurance',
    claim: 'Improves muscle endurance',
    evidence: [
      { studyId: 'liu2022', primary: false, result: 'improved' },
      { studyId: 'singh2022', primary: false, result: 'improved' },
    ],
    note: 'Both trials found better endurance — repetitions to fatigue in older adults’ hand and leg muscles; aerobic capacity in middle-aged adults — but neither was the outcome the trial was built around.',
  },
  {
    id: 'walking',
    claim: 'Improves walking distance (the 6-minute walk)',
    evidence: [
      { studyId: 'liu2022', primary: true, result: 'no_difference' },
      { studyId: 'singh2022', primary: false, result: 'improved' },
    ],
    note: 'In older adults it was a main outcome and did not change. In middle-aged adults it improved as a secondary outcome. A tested main outcome that found nothing outranks a secondary result.',
  },
  {
    id: 'strength',
    claim: 'Increases muscle strength',
    evidence: [{ studyId: 'singh2022', primary: false, result: 'improved' }],
    note: 'Leg strength rose about 12% in middle-aged adults — a secondary outcome. The trial’s main outcome, peak power on a bike, did not change.',
  },
  {
    id: 'power',
    claim: 'Improves exercise power output',
    evidence: [{ studyId: 'singh2022', primary: true, result: 'no_difference' }],
    note: 'Peak power output was the main outcome of the middle-aged trial and did not improve.',
  },
  {
    id: 'immune',
    claim: 'Shifts immune cells toward a younger profile',
    evidence: [{ studyId: 'denk2025', primary: true, result: 'improved' }],
    note: 'After 4 weeks, measures of T-cell types and their metabolism moved in the direction the trial predicted. These are lab measures of immune cells — the trial did not measure infections or illness.',
  },
  {
    id: 'blood-vessels',
    claim: 'Improves blood-vessel function',
    evidence: [{ studyId: 'ou2026', primary: true, result: 'no_difference' }],
    note: 'Four weeks did not improve artery function (flow-mediated dilation) in middle-aged adults with obesity — the trial’s main outcome.',
  },
];
