// lib/evidence/topics/functionalSpirits.ts — "functional" non-alcoholic spirits, starting with
// Little Saints St. Ember and St. Juniper (owner, 2026-10-24: "non-alcoholic spirits for health
// effects … I have lion's mane w/ other things in the product"). The maker's own copy, read
// 2026-10-24 from littlesaints.com product data: St. Ember "Enhanced with organic Lion's Mane for
// clarity and elevated presence"; St. Juniper "Lion's Mane for clarity and Damiana for
// heart-opening presence … crafted to soften your edges and lift your spirits"; the canned
// cocktails use reishi "for a grounded calm". A retailer listing gives St. Ember 100 mg lion's
// mane per serving; the maker's pages we read state no amount.
//
// ⚠️ DOSE IS THE WHOLE STORY. The trials that found anything gave grams a day for weeks (Mori:
// 3 g of powder daily for 16 weeks; reishi: 5.4 g of extract daily for 8 weeks). One serving of a
// spirit is a small fraction of that, once, so no record here is evidence for a drink — that claim
// gets its own row with no evidence. Every abstract read via PubMed efetch.
import type { Study } from '@/lib/evidence/grade';
import type { TopicClaim } from '@/lib/evidence/topics/mullein';

export const FUNCTIONAL_SPIRITS_EVIDENCE_CHECKED = '2026-10-24';

export const FUNCTIONAL_SPIRITS_STUDIES: Study[] = [
  {
    id: 'mori2009',
    title: 'Lion’s mane (Yamabushitake) in mild cognitive impairment (Phytother Res 2009;23:367)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/18844328/',
    year: 2009, design: 'rct_blinded', n: 30, durationWeeks: 16,
    population: 'Japanese adults aged 50–80 with mild cognitive impairment; 3 g a day of dried mushroom powder vs placebo — scores fell again 4 weeks after stopping',
    funder: 'unknown', peerReviewed: true,
  },
  {
    id: 'saitsu2019',
    title: 'Lion’s mane and cognitive function over 12 weeks (Biomed Res 2019;40:125)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31413233/',
    year: 2019, design: 'rct_blinded', durationWeeks: 12,
    population: 'adults taking fruiting-body supplements vs placebo; one of three cognitive tests (MMSE) improved, two did not',
    funder: 'unknown', peerReviewed: true,
  },
  {
    id: 'docherty2023',
    title: 'Lion’s mane, cognition, stress and mood in young adults (Nutrients 2023;15:4842)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/38004235/',
    year: 2023, design: 'rct_blinded', n: 41, durationWeeks: 4,
    population: 'healthy adults 18–45; 1.8 g a day for 28 days; faster on one task an hour after the first dose, a non-significant trend toward less stress at 28 days, and null findings',
    funder: 'independent', // the supplier gave the product only and had no role, per the authors
    peerReviewed: true,
  },
  {
    id: 'surendran2025',
    title: 'One dose of lion’s mane extract on cognition and mood in young adults (Front Nutr 2025;12:1405796)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/40276537/',
    year: 2025, design: 'rct_blinded', n: 18,
    population: 'healthy adults 18–35; one 3 g dose of 10:1 extract vs placebo, crossover — no overall effect on cognition or mood',
    funder: 'manufacturer', // two authors employed by a functional non-alcoholic drinks company using lion's mane
    peerReviewed: true, preRegistered: false,
  },
  {
    id: 'grozier2022',
    title: 'Four weeks of lion’s mane and cognition (Int J Exerc Sci 2022;15:1366)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/36582308/',
    year: 2022, design: 'rct_open', n: 24, durationWeeks: 4, // single-blind placebo
    population: 'college-age adults; 10 g a day in muffins vs placebo muffins — no effect on cognition',
    funder: 'unknown', peerReviewed: true,
  },
  {
    id: 'nagano2010',
    title: 'Lion’s mane cookies, depression and anxiety over 4 weeks (Biomed Res 2010;31:231)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/20834180/',
    year: 2010, design: 'rct_open', n: 30, durationWeeks: 4, // placebo cookies; blinding not stated
    population: '30 women; depression scores fell within the lion’s mane group, and two minor complaint items differed from placebo',
    funder: 'unknown', peerReviewed: true,
  },
  {
    id: 'tang2005',
    title: 'Reishi polysaccharide extract in neurasthenia (J Med Food 2005;8:53)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/15857210/',
    year: 2005, design: 'rct_blinded', n: 132, durationWeeks: 8,
    population: 'patients diagnosed with neurasthenia (fatigue, poor wellbeing); 1,800 mg three times a day vs placebo',
    funder: 'unknown', peerReviewed: true,
  },
];

export const FUNCTIONAL_SPIRITS_CLAIMS: TopicClaim[] = [
  {
    id: 'little-saints-serving',
    claim: 'A serving of a lion’s mane spirit brings “clarity” (Little Saints St. Ember and St. Juniper)',
    evidence: [],
    note: 'No study of these drinks or of any lion’s mane drink. The trials that found anything gave grams a day for weeks; a retailer lists St. Ember at 100 mg per serving.',
  },
  {
    id: 'lions-mane-mci',
    claim: 'Lion’s mane improves memory in older adults with mild cognitive impairment',
    evidence: [
      { studyId: 'mori2009', primary: true, result: 'improved' },
      { studyId: 'saitsu2019', primary: false, result: 'improved' },
    ],
    note: 'One small double-blind trial (30 people, 3 g a day for 16 weeks) — and the benefit faded within 4 weeks of stopping. A second trial improved on one test of three.',
  },
  {
    id: 'lions-mane-healthy-focus',
    claim: 'Lion’s mane sharpens focus in healthy adults',
    evidence: [
      { studyId: 'surendran2025', primary: true, result: 'no_difference' },
      { studyId: 'docherty2023', primary: false, result: 'improved' },
      { studyId: 'grozier2022', primary: true, result: 'no_difference' },
    ],
    note: 'A double-blind trial of one 3 g extract dose found no overall effect on cognition or mood. Ten grams a day for four weeks did nothing either. One task got faster an hour after a 1.8 g dose.',
  },
  {
    id: 'lions-mane-mood',
    claim: 'Lion’s mane eases low mood and anxiety',
    evidence: [
      { studyId: 'nagano2010', primary: false, result: 'improved' },
      { studyId: 'docherty2023', primary: false, result: 'no_difference' },
    ],
    note: 'Small, short studies with hints and nulls; nothing designed and powered to answer it.',
  },
  {
    id: 'damiana-mood',
    claim: 'Damiana lifts mood (“heart-opening presence”)',
    evidence: [],
    note: 'Damiana has only been tested inside multi-ingredient products for sexual function, so no result can be put down to damiana. We found no trial of it for mood.',
  },
  {
    id: 'reishi-calm',
    claim: 'Reishi eases fatigue and brings calm',
    evidence: [{ studyId: 'tang2005', primary: true, result: 'improved' }],
    note: 'One double-blind trial in patients diagnosed with neurasthenia, at 5.4 g of extract a day for 8 weeks. Not tested in healthy people, or in a drink.',
  },
];
