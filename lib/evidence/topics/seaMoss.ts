// lib/evidence/topics/seaMoss.ts — the evidence on sea moss (Irish moss, Chondrus crispus) for a
// smoker's lungs, as records the grade function reads (lib/evidence/grade.ts). Read 2026-10-23 from
// PubMed (E-utilities): "Chondrus crispus" AND (randomized OR trial OR humans) returned 26 records and
// "sea moss" OR "Irish moss" returned 6 — NOT ONE a human trial of eating sea moss. The only
// randomized trial was in dairy cows (methane). No record measured lungs, cough or mucus in people.
//
// ⚠️ The nearest human evidence is NOT sea moss: four placebo-controlled trials of a NASAL SPRAY made
// from iota-carrageenan, a purified extract of red seaweed, for the common cold. It is recorded as
// its own claim and the page says so, because a spray in the nose tells us nothing about a gel or a
// gummy swallowed — and nothing about a smoker's lungs. Each record carries only what its abstract
// states (efetch, 2026-10-23). The iodine analysis the page cites (PMID 32803579) is a lab test of
// shop samples, not a study of people, so it is linked in the text rather than entered here.
import type { ClaimEvidence, Study } from '@/lib/evidence/grade';
import type { TopicClaim } from '@/lib/evidence/topics/mullein';

export const SEA_MOSS_EVIDENCE_CHECKED = '2026-10-23';

export const SEA_MOSS_STUDIES: Study[] = [
  {
    id: 'eccles2010',
    title: 'Iota-carrageenan nasal spray in early common cold (Respir Res 2010;11:108)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/20696083/',
    year: 2010,
    design: 'rct_blinded',
    n: 35,
    population: 'adults with early cold symptoms; 0.12% iota-carrageenan nasal spray vs placebo spray, three times a day for 4 days',
    funder: 'manufacturer', // authors from Marinomed, the spray's developer
    peerReviewed: true,
  },
  {
    id: 'fazekas2012',
    title: 'Iota-carrageenan nasal spray in children with acute cold symptoms (BMC Complement Altern Med 2012;12:147)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/22950667/',
    year: 2012,
    design: 'rct_blinded',
    n: 153,
    population: 'children aged 1–18 with acute cold symptoms; carrageenan spray vs saline spray for 7 days',
    funder: 'unknown',
    peerReviewed: true,
    preRegistered: true,
  },
  {
    id: 'ludwig2013',
    title: 'Carrageenan nasal spray in adults with common cold (Respir Res 2013;14:124)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/24219370/',
    year: 2013,
    design: 'rct_blinded',
    n: 211,
    population: 'adults with early cold symptoms; carrageenan spray vs saline spray, three times a day for 7 days',
    funder: 'mixed', // university trial with authors from Marinomed
    peerReviewed: true,
    preRegistered: true,
  },
  {
    id: 'eccles2015',
    title: 'The ICICC trial: iota-carrageenan nasal spray vs placebo in adults (Respir Res 2015;16:121)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/26438038/',
    year: 2015,
    design: 'rct_blinded',
    n: 200,
    population: 'adults with colds under 48 hours old; carrageenan spray vs placebo spray, four times a day for 4–10 days',
    funder: 'manufacturer', // Boehringer Ingelheim, which sold the spray
    peerReviewed: true,
    preRegistered: true,
  },
];

export const SEA_MOSS_CLAIMS: TopicClaim[] = [
  {
    id: 'smokers-lungs',
    claim: "Sea moss clears, cleanses or 'detoxes' a smoker's lungs",
    evidence: [],
    note: 'No human study has tested it, and no study has measured lung function, cough or mucus after eating sea moss. Nothing undoes smoking damage except stopping.',
  },
  {
    id: 'mucus',
    claim: 'Sea moss loosens mucus or eases chest congestion',
    evidence: [],
    note: 'A traditional use — the gel is soothing to swallow — but no trial has measured mucus, cough or congestion in people.',
  },
  {
    id: 'carrageenan-spray',
    claim: 'A nasal spray made from a red-seaweed extract (iota-carrageenan) eases a cold',
    evidence: [
      { studyId: 'eccles2010', primary: true, result: 'improved' },
      { studyId: 'fazekas2012', primary: true, result: 'no_difference' },
      { studyId: 'ludwig2013', primary: true, result: 'no_difference' },
      { studyId: 'eccles2015', primary: true, result: 'no_difference' },
    ] satisfies ClaimEvidence[],
    note: 'NOT sea moss: a purified extract sprayed in the nose, for colds. One small trial (35 people) met its main measure; three larger ones did not, though each reported less virus in nasal fluid or other secondary benefits. It says nothing about eating sea moss or about lungs.',
  },
];
