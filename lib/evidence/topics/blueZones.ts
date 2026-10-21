// lib/evidence/topics/blueZones.ts — the habits popularised by the Blue Zones research, as evidence
// records (lib/evidence/grade.ts). Each study below was looked up on PubMed on 2026-10-21 and carries
// only what its abstract states (design, size where given, the outcome that was primary). A size the
// abstract did not state is left out, never estimated.
//
// "Blue Zones" and "Power 9" are trademarks of Blue Zones, LLC; they are named here only to say what
// is being graded (nominative use). We are not affiliated with or endorsed by Blue Zones, LLC.
//
// ⚠️ Only habits with at least one study entered are listed as claims. A habit with no record yet
// ("downshift", "loved ones first") is NOT a claim here — gradeClaim([]) says "No real evidence",
// which would be a statement about the research when it is only a statement about our records.
// The page names them as "not yet graded" instead.
import type { Study } from '@/lib/evidence/grade';
import type { TopicClaim } from '@/lib/evidence/topics/mullein';

export const BLUE_ZONES_EVIDENCE_CHECKED = '2026-10-21';

export const BLUE_ZONES_STUDIES: Study[] = [
  {
    id: 'alimujiang2019',
    title: 'Association between life purpose and mortality among US adults older than 50 (JAMA Netw Open 2019;2:e194270)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31125099/',
    year: 2019,
    design: 'observational',
    n: 6985,
    population: 'US adults over 50, Health and Retirement Study',
    funder: 'unknown',
    peerReviewed: true,
  },
  {
    id: 'holtlunstad2010',
    title: 'Social relationships and mortality risk: a meta-analytic review (PLoS Med 2010;7:e1000316)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/20668659/',
    year: 2010,
    design: 'observational',
    n: 308849,
    population: '148 observational studies pooled',
    funder: 'unknown',
    peerReviewed: true,
  },
  {
    id: 'paluch2022',
    title: 'Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts (Lancet Public Health 2022;7:e219)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35247352/',
    year: 2022,
    design: 'observational',
    population: '15 cohorts, participant-level data pooled',
    funder: 'independent',
    peerReviewed: true,
  },
  {
    id: 'li2016',
    title: 'Association of religious service attendance with mortality among women (JAMA Intern Med 2016;176:777)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/27183175/',
    year: 2016,
    design: 'observational',
    n: 74534,
    population: "women in the Nurses' Health Study",
    funder: 'unknown',
    peerReviewed: true,
  },
  {
    id: 'zhao2023',
    title: 'Association between daily alcohol intake and risk of all-cause mortality: systematic review and meta-analyses (JAMA Netw Open 2023;6:e236185)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/37000449/',
    year: 2023,
    design: 'observational',
    n: 4838825,
    population: '107 cohort studies pooled, adjusted for former-drinker and other biases',
    funder: 'unknown',
    peerReviewed: true,
  },
  {
    id: 'estruch2018',
    title: 'Primary prevention of cardiovascular disease with a Mediterranean diet supplemented with extra-virgin olive oil or nuts (NEJM 2018;378:e34 — PREDIMED, republished)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29897866/',
    year: 2018,
    design: 'rct_open',
    n: 7447,
    population: 'adults 55–80 at high cardiovascular risk, Spain; withdrawn and re-analysed after randomization deviations',
    funder: 'independent',
    peerReviewed: true,
  },
  {
    id: 'darmadi2004',
    title: 'Legumes: the most important dietary predictor of survival in older people of different ethnicities (Asia Pac J Clin Nutr 2004;13:217)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/15228991/',
    year: 2004,
    design: 'observational',
    population: 'older people in several countries',
    funder: 'unknown',
    peerReviewed: true,
  },
  {
    id: 'kraus2019',
    title: '2 years of calorie restriction and cardiometabolic risk (CALERIE): exploratory outcomes of a randomised controlled trial (Lancet Diabetes Endocrinol 2019;7:673)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31303390/',
    year: 2019,
    design: 'rct_open',
    durationWeeks: 104,
    population: 'healthy non-obese adults 21–50, USA; 25% calorie restriction prescribed',
    funder: 'independent',
    peerReviewed: true,
  },
  {
    id: 'christakis2007',
    title: 'The spread of obesity in a large social network over 32 years (NEJM 2007;357:370)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/17652652/',
    year: 2007,
    design: 'observational',
    n: 12067,
    population: 'Framingham Heart Study social network, 1971–2003',
    funder: 'unknown',
    peerReviewed: true,
  },
];

export const BLUE_ZONES_CLAIMS: TopicClaim[] = [
  {
    id: 'move',
    claim: 'Moving more through the day goes with a longer life',
    evidence: [{ studyId: 'paluch2022', primary: true, result: 'improved' }],
    note: 'More daily steps went with lower death rates, up to a level that varied by age. Observational: active people differ from inactive people in many ways.',
  },
  {
    id: 'purpose',
    claim: 'A sense of purpose goes with a longer life',
    evidence: [{ studyId: 'alimujiang2019', primary: true, result: 'improved' }],
    note: 'Stronger purpose in life was associated with lower mortality in adults over 50. An association, not proof that purpose causes it.',
  },
  {
    id: 'plants',
    claim: 'A plant-heavy, Mediterranean-style diet lowers heart attacks and strokes',
    evidence: [
      { studyId: 'estruch2018', primary: true, result: 'improved' },
      { studyId: 'darmadi2004', primary: true, result: 'improved' },
    ],
    note: 'The PREDIMED trial found fewer major cardiovascular events with a Mediterranean diet plus olive oil or nuts, compared with a low-fat diet. Participants knew their diet (not blinded), and the trial was re-analysed after randomization problems. Beans: one observational study.',
  },
  {
    id: 'eighty-percent',
    claim: 'Eating a little less (the "80% rule") improves heart and metabolic health',
    evidence: [{ studyId: 'kraus2019', primary: false, result: 'improved' }],
    note: 'Two years of calorie restriction in healthy adults improved several heart and metabolic risk markers — results the trial reported as exploratory, not its main outcome. Nobody has shown it adds years in people.',
  },
  {
    id: 'wine',
    claim: 'A daily glass of wine helps you live longer',
    evidence: [{ studyId: 'zhao2023', primary: true, result: 'no_difference' }],
    note: 'Pooling 107 studies and correcting for the biases that made older studies look positive, low or moderate drinking was not linked to lower mortality; risk rose at higher amounts.',
  },
  {
    id: 'belong',
    claim: 'Belonging to a faith community goes with a longer life',
    evidence: [{ studyId: 'li2016', primary: true, result: 'improved' }],
    note: 'Women attending services more than once a week had lower mortality than those who never attended. Observational; social support explained part of it.',
  },
  {
    id: 'social-ties',
    claim: 'Strong social ties go with a longer life',
    evidence: [{ studyId: 'holtlunstad2010', primary: true, result: 'improved' }],
    note: 'Across 148 studies, people with stronger social relationships were more likely to survive over the follow-up. Observational.',
  },
  {
    id: 'right-tribe',
    claim: 'The people around you shape your health habits',
    evidence: [{ studyId: 'christakis2007', primary: true, result: 'improved' }],
    note: 'In the Framingham network, a person’s chance of becoming obese rose when a friend did. “Improved” here means the link was found — the effect described is the spread of a habit, good or bad.',
  },
];

/** Habits the Blue Zones work names that have no study entered here yet — shown as "not yet graded", never as "no evidence". */
export const BLUE_ZONES_NOT_YET_GRADED = ['Downshift (a daily routine to shed stress)', 'Loved ones first (family close by, committed partner)'];
