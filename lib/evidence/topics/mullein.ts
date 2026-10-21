// lib/evidence/topics/mullein.ts — the evidence on mullein (Verbascum thapsus), as records the grade
// function reads (lib/evidence/grade.ts). Read 2026-10-21 from PubMed: a search for Verbascum AND
// (randomized OR trial) returned four records, two of them human trials, NEITHER about lungs or cough.
// Re-check before publishing; the date below is what the guide prints.
//
// ⚠️ Each record carries only what its abstract states. An outcome not read is not entered — the
// ear-drop trial's results are not recorded here because the product was a six-ingredient
// combination, so no result in it can be attributed to mullein.
import type { ClaimEvidence, Study } from '@/lib/evidence/grade';

export const MULLEIN_EVIDENCE_CHECKED = '2026-10-21';

export const MULLEIN_STUDIES: Study[] = [
  {
    id: 'sarrell2003',
    title: 'Naturopathic treatment for ear pain in children (Pediatrics 2003;111:e574)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/12728112/',
    year: 2003,
    design: 'rct_blinded',
    n: 171,
    population: 'children 5–18 with ear pain and middle-ear infection; drops combining garlic, mullein, calendula, St John\'s wort, lavender and vitamin E',
    funder: 'unknown',
    peerReviewed: true,
  },
  {
    id: 'taleb2021',
    title: 'Verbascum thapsus on episiotomy wound healing in nulliparous women (BMC Complement Med Ther 2021;21:166)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/34103042/',
    year: 2021,
    design: 'rct_blinded',
    n: 93,
    durationWeeks: 1.5,
    population: 'first-time mothers after episiotomy; a mullein cream vs placebo cream, twice daily for 10 days',
    funder: 'unknown',
    peerReviewed: true,
    preRegistered: true,
  },
];

export type TopicClaim = { id: string; claim: string; evidence: ClaimEvidence[]; note: string };

export const MULLEIN_CLAIMS: TopicClaim[] = [
  {
    id: 'cough',
    claim: 'Mullein relieves cough',
    evidence: [],
    note: 'No human trial has tested it. The EU herbal monograph lists relief of sore throat with dry cough and cold as a TRADITIONAL use — based on long-standing use, not on trials.',
  },
  {
    id: 'smokers-lungs',
    claim: "Mullein clears, cleanses or 'detoxes' a smoker's lungs",
    evidence: [],
    note: 'No human trial has tested it, and no study has measured lung function after mullein. Nothing undoes smoking damage except stopping.',
  },
  {
    id: 'ear-pain-combo',
    claim: 'Ear drops that contain mullein ease ear pain in children',
    evidence: [],
    note: 'One double-blind trial (171 children) used drops with six ingredients, mullein among them, so no result can be attributed to mullein alone. Not graded for mullein.',
  },
  {
    id: 'episiotomy-cream',
    claim: 'Mullein cream helps episiotomy wounds heal',
    evidence: [{ studyId: 'taleb2021', primary: true, result: 'improved' }],
    note: 'A cream, not drops or gummies. Healing scores were better than placebo on day 10 but not on days 1 or 3. One trial; not replicated.',
  },
];
