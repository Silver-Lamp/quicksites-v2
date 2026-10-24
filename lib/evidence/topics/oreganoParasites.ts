// lib/evidence/topics/oreganoParasites.ts — oregano oil + black seed oil sold as a "parasite
// cleanse", prompted by a Facebook advertorial for Maju Superfoods "Oregano Oil + Black Seed Oil"
// softgels (owner, 2026-10-24). Read 2026-10-24 from PubMed (E-utilities efetch of each abstract):
// oregano/carvacrol AND parasites in people returned ONE human study (Force 2000, 14 adults, no
// control group); everything else on oregano and on black seed is test-tube or animal work, plus
// one field trial of black SEEDS (not oil) in children with tapeworms.
//
// ⚠️ The ad's one true kernel is pinworm: itching at night is its typical sign (CDC), and it is
// diagnosed with a tape test and treated with over-the-counter or prescription medicine. That is
// cited in the page text, not graded — it is not a claim about this product.
import type { Study } from '@/lib/evidence/grade';
import type { TopicClaim } from '@/lib/evidence/topics/mullein';

export const OREGANO_PARASITES_EVIDENCE_CHECKED = '2026-10-24';

export const OREGANO_PARASITES_STUDIES: Study[] = [
  {
    id: 'force2000',
    title: 'Emulsified oil of oregano and enteric parasites in 14 adults (Phytother Res 2000;14:213)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/10815019/',
    year: 2000,
    design: 'case_series',
    n: 14,
    durationWeeks: 6,
    population: 'adults whose stool tests showed Blastocystis, Entamoeba hartmanni or Endolimax nana; 600 mg oregano oil a day, no comparison group',
    funder: 'manufacturer', // authors from Biotics Research Corporation, a supplement maker
    peerReviewed: true,
  },
  {
    id: 'akhtar1991',
    title: 'Field trial of black seed (Nigella sativa) against tapeworms in children (J Pak Med Assoc 1991;41:185)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/1942479/',
    year: 1991,
    design: 'case_series', // compared with a drug (niclosamide); no placebo, assignment not described
    population: 'children with tapeworm eggs in their stool; one dose of 40 mg per kg of black seed (seeds, not oil)',
    funder: 'unknown',
    peerReviewed: true,
  },
  {
    id: 'elwakil2007',
    title: 'Black seed extract on Blastocystis in the lab (J Egypt Soc Parasitol 2007;37:801)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/18383782/',
    year: 2007,
    design: 'in_vitro',
    population: 'Blastocystis isolates in culture dishes',
    funder: 'unknown',
    peerReviewed: true,
  },
  {
    id: 'mady2016',
    title: 'Black seed oil in mice infected with Toxoplasma (Parasitol Res 2016;115:379)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/26446086/',
    year: 2016,
    design: 'animal',
    n: 100,
    population: 'mice; black seed oil alone did NOT reduce the parasite — only combined with the drug pyrimethamine',
    funder: 'unknown',
    peerReviewed: true,
  },
];

export const OREGANO_PARASITES_CLAIMS: TopicClaim[] = [
  {
    id: 'symptom-signs',
    claim: 'Bloating, sugar cravings, low energy and brain fog are signs of gut parasites',
    evidence: [],
    note: 'These are common, non-specific symptoms with many causes. Gut parasites are found with a stool test (or, for pinworm, a tape test) — not from a symptom list.',
  },
  {
    id: 'oregano-parasites',
    claim: 'Oregano oil clears gut parasites',
    evidence: [{ studyId: 'force2000', primary: true, result: 'improved' }],
    note: 'One study, 14 adults, no comparison group, run by a supplement company: after 600 mg a day for six weeks some parasites were gone from stool tests. Without a control group, nobody can say how many would have cleared anyway. The softgels in the ad contain 300 mg.',
  },
  {
    id: 'black-seed-parasites',
    claim: 'Black seed clears intestinal worms',
    evidence: [
      { studyId: 'akhtar1991', primary: true, result: 'improved' },
      { studyId: 'elwakil2007', primary: true, result: 'improved' },
      { studyId: 'mady2016', primary: true, result: 'no_difference' },
    ],
    note: 'A 1991 field trial gave children ONE dose of 40 mg per kg of black SEEDS for tapeworms, with no placebo. Lab dishes show an effect on one parasite; in mice, the oil alone did nothing to another. The ad’s softgel holds 200 mg of oil.',
  },
  {
    id: 'maju-softgels',
    claim: 'Oregano + black seed oil softgels clear parasites (“Powerful 2-in-1 for Parasite Defense”)',
    evidence: [],
    note: 'No study of this product or this combination. A certificate of analysis shows what is (or isn’t) in a batch — it does not test whether the product does anything.',
  },
];
