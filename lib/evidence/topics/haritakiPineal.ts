// lib/evidence/topics/haritakiPineal.ts — "decalcify your pineal gland" with haritaki (Terminalia
// chebula), prompted by Facebook ads for Peptiques "Haritaki Third Eye" capsules (owner,
// 2026-10-24). Read 2026-10-24 from PubMed (E-utilities): "haritaki OR Terminalia chebula" AND
// (pineal OR calcification OR fluoride) returned ZERO records. Haritaki's human trials are of
// mouthwash, toothpaste and joint-comfort products — none measured the pineal gland.
//
// ⚠️ The ads' premise has a TRUE kernel and the page says so: the pineal gland does calcify with
// age, and fluoride does collect in that calcified tissue. What has never been shown is that any
// supplement removes either. Those two facts are cited in the page text (PMID 34866062, 11275672),
// not graded here — a grade answers "does it work?", and an anatomical fact is not a claim of
// benefit. Each record carries only what its abstract states.
import type { Study } from '@/lib/evidence/grade';
import type { TopicClaim } from '@/lib/evidence/topics/mullein';

export const HARITAKI_PINEAL_EVIDENCE_CHECKED = '2026-10-24';

export const HARITAKI_PINEAL_STUDIES: Study[] = [
  {
    id: 'kunz1998',
    title: 'Pineal calcification and subjective sleep (Psychiatry Res 1998;82:187)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/9754443/',
    year: 1998,
    design: 'observational',
    n: 36,
    population: '36 patients; degree of pineal calcification on CT vs a sleep questionnaire (a pilot)',
    funder: 'unknown',
    peerReviewed: true,
  },
  {
    id: 'mrvelj2020',
    title: 'Fluoride-free diet and the pineal gland in aged rats (Biol Trace Elem Res 2020;197:175)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31713773/',
    year: 2020,
    design: 'animal',
    population: 'aged male rats moved from fluoridated food and water to a fluoride-free diet for 4–8 weeks',
    funder: 'unknown',
    peerReviewed: true,
  },
];

export const HARITAKI_PINEAL_CLAIMS: TopicClaim[] = [
  {
    id: 'calcification-sleep',
    claim: 'A more calcified pineal gland goes with poorer sleep',
    evidence: [{ studyId: 'kunz1998', primary: true, result: 'improved' }],
    note: 'One pilot study of 36 patients found an association with daytime tiredness. An association in a small group, not proof that calcification causes poor sleep.',
  },
  {
    id: 'fluoride-free-diet',
    claim: 'Cutting fluoride from the diet lets the pineal gland grow back',
    evidence: [{ studyId: 'mrvelj2020', primary: true, result: 'improved' }],
    note: 'In aged rats, a fluoride-free diet for 4–8 weeks increased pineal cell counts. Rats, not people — and it was removing fluoride from the diet, not taking a supplement.',
  },
  {
    id: 'haritaki-decalcifies',
    claim: 'Haritaki dissolves calcification on the pineal gland',
    evidence: [],
    note: 'No study of haritaki and the pineal gland exists — not in people, not in animals. No treatment of any kind has been shown to reverse pineal calcification.',
  },
  {
    id: 'haritaki-fluoride-metals',
    claim: 'Haritaki pulls fluoride and heavy metals out of the body',
    evidence: [],
    note: 'No study measured fluoride or metals leaving the body after haritaki. Heavy-metal poisoning is diagnosed by a blood test and treated by a doctor.',
  },
  {
    id: 'haritaki-dreams',
    claim: 'Haritaki brings back vivid dreams',
    evidence: [],
    note: 'No study has measured dreams after haritaki.',
  },
];
