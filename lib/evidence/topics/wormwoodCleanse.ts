// lib/evidence/topics/wormwoodCleanse.ts — the "hidden parasites" ad for a wormwood + black walnut
// + clove supplement (Sanlava Organics), written as a retired funeral director's story (owner,
// 2026-10-24). Read 2026-10-24 from PubMed (E-utilities): wormwood (Artemisia absinthium) AND
// parasites in people returned no trial; its parasite work is test-tube only. Black walnut and
// clove: no human or animal trial against intestinal parasites at all. Wormwood's one line of human
// trials is for Crohn's disease — cited in the page text, not graded here, because no one sells
// this product for Crohn's.
//
// ⚠️ The ad's true kernels are cited in the page text, not graded: the 2015 Nobel (artemisinin, from
// SWEET wormwood, against MALARIA; ivermectin, from a soil bacterium, against roundworm-borne
// diseases); "wormwood" in the Bible (a picture of bitterness, never of cleansing); 200,000 eggs a
// day (a female roundworm, CDC); and that one stool test can miss parasites (CDC: three samples).
import type { Study } from '@/lib/evidence/grade';
import type { TopicClaim } from '@/lib/evidence/topics/mullein';

export const WORMWOOD_CLEANSE_EVIDENCE_CHECKED = '2026-10-24';

export const WORMWOOD_CLEANSE_STUDIES: Study[] = [
  {
    id: 'baies2022',
    title: 'Plant extracts incl. wormwood on pig roundworm eggs in a dish (Pathogens 2022;11:1065)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/36145497/',
    year: 2022, design: 'in_vitro',
    population: 'Ascaris suum eggs from pigs, in culture plates with alcoholic plant extracts',
    funder: 'unknown', peerReviewed: true,
  },
  {
    id: 'ferreira2011',
    title: 'Plant extracts incl. wormwood on adult flukes in a dish (Parasitol Res 2011;109:1585)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/21562762/',
    year: 2011, design: 'in_vitro',
    population: 'adult flukes in culture; wormwood was slower than sweet wormwood and paw-paw',
    funder: 'independent', peerReviewed: true,
  },
];

export const WORMWOOD_CLEANSE_CLAIMS: TopicClaim[] = [
  {
    id: 'hidden-parasites',
    claim: 'Parasites hide in the gut wall where stool tests can’t find them',
    evidence: [],
    note: 'No study we found. What is true: one stool test can miss parasites, which is why the CDC recommends examining three samples a few days apart — a reason for better testing, not for a supplement.',
  },
  {
    id: 'wormwood-parasites',
    claim: 'Wormwood clears intestinal parasites in people',
    evidence: [
      { studyId: 'baies2022', primary: true, result: 'improved' },
      { studyId: 'ferreira2011', primary: true, result: 'improved' },
    ],
    note: 'Only in dishes: extracts slowed pig-roundworm eggs and killed flukes in culture. Never tested against parasites in a person.',
  },
  {
    id: 'black-walnut-clove',
    claim: 'Black walnut and clove kill intestinal parasites',
    evidence: [],
    note: 'We found no trial of either against intestinal parasites — in people or in animals.',
  },
  {
    id: 'sanlava-softgels',
    claim: 'Wormwood, black walnut and clove softgels “Flush Out Hidden Parasites & Larva” and “Target Adults, Larvae & Eggs”',
    evidence: [],
    note: 'No study of this product or this mix. Proven medicines for parasites exist, matched to the parasite a test finds.',
  },
  {
    id: 'cleanse-brain-fog',
    claim: 'A parasite cleanse clears brain fog and fatigue',
    evidence: [],
    note: 'No study. Tiredness and fogginess have many causes worth a doctor’s look.',
  },
  {
    id: 'cleanse-skin',
    claim: 'A parasite cleanse gives clearer, more youthful skin',
    evidence: [],
    note: 'No study.',
  },
];
