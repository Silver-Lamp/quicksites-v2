// lib/evidence/topics/redLight.ts — red and near-infrared light therapy ("photobiomodulation",
// "low-level laser therapy"), read 2026-10-24 from PubMed (E-utilities efetch of each abstract).
// Prompted by a Facebook advert for the InfraBeam pen (owner, 2026-10-24); the page quotes that
// advert's claims and sets each beside these records.
//
// ⚠️ The trials that found something used CLINIC lasers at MEASURED doses — the 2019 meta-analysis
// names 4–8 J per spot at 785–860 nm, or 1–3 J at 904 nm. A consumer pen that states no wavelength
// and no power cannot be matched to those doses, so no record here is evidence for any one pen;
// that claim gets its own row with no evidence. Each record carries only what its abstract states.
import type { Study } from '@/lib/evidence/grade';
import type { TopicClaim } from '@/lib/evidence/topics/mullein';

export const RED_LIGHT_EVIDENCE_CHECKED = '2026-10-24';

export const RED_LIGHT_STUDIES: Study[] = [
  {
    id: 'stausholm2019',
    title: 'Low-level laser therapy for knee osteoarthritis: meta-analysis of 22 placebo-controlled trials (BMJ Open 2019;9:e031142)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31662383/',
    year: 2019,
    design: 'meta_analysis_rct',
    n: 1063,
    population: 'people with knee osteoarthritis; clinic laser vs placebo laser applied to the knee',
    funder: 'independent', // authors declare no funding from the laser association two of them once led
    peerReviewed: true,
    preRegistered: true,
  },
  {
    id: 'oliveira2024',
    title: 'Photobiomodulation for knee osteoarthritis: meta-analysis of 10 placebo-controlled trials (Phys Ther 2024;104:pzae073)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/38775202/',
    year: 2024,
    design: 'meta_analysis_rct',
    n: 542,
    population: 'people with knee osteoarthritis; light therapy vs placebo — the authors rate the certainty "very low"',
    funder: 'unknown',
    peerReviewed: true,
  },
  {
    id: 'brosseau2004',
    title: 'Low level laser therapy for osteoarthritis — Cochrane review of 7 trials (Cochrane Database Syst Rev 2004;CD002046)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/15266461/',
    year: 2004,
    design: 'meta_analysis_rct',
    n: 345,
    population: 'people with osteoarthritis; laser vs placebo laser — pooled pain showed no effect, results conflicting',
    funder: 'independent',
    peerReviewed: true,
  },
  {
    id: 'hinman2014',
    title: 'Laser and needle acupuncture for chronic knee pain (JAMA 2014;312:1313)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/25268438/',
    year: 2014,
    design: 'rct_blinded',
    n: 282,
    durationWeeks: 12,
    population: 'adults over 50 with chronic knee pain; laser acupuncture vs sham laser (blinded), plus needle and no-treatment arms',
    funder: 'unknown',
    peerReviewed: true,
    preRegistered: true,
  },
  {
    id: 'wunsch2014',
    title: 'Red and near-infrared light for fine lines, wrinkles and collagen density (Photomed Laser Surg 2014;32:93)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/24286286/',
    year: 2014,
    design: 'rct_open', // randomised against untreated controls, not a sham light; photo ratings were blinded
    n: 136,
    durationWeeks: 15,
    population: 'adult volunteers; 30 full-face light sessions vs untreated controls',
    funder: 'unknown',
    peerReviewed: true,
  },
];

export const RED_LIGHT_CLAIMS: TopicClaim[] = [
  {
    id: 'knee-oa-pain',
    claim: 'Red or near-infrared light from a clinic laser eases knee arthritis pain',
    evidence: [
      { studyId: 'stausholm2019', primary: true, result: 'improved' },
      { studyId: 'oliveira2024', primary: true, result: 'improved' },
      { studyId: 'brosseau2004', primary: true, result: 'no_difference' },
    ],
    note: 'Clinic lasers at measured doses, applied to the knee, over weeks. The 2019 review found pain fell more than with placebo at 4–8 J per spot (785–860 nm, near-infrared — not visible red); the 2024 review agreed but rated the certainty "very low"; the older Cochrane review found conflicting trials. Major arthritis guidelines did not recommend it as of 2019.',
  },
  {
    id: 'laser-acupuncture',
    claim: 'Laser light on acupuncture points eases chronic knee pain',
    evidence: [{ studyId: 'hinman2014', primary: true, result: 'no_difference' }],
    note: 'A blinded trial of 282 people: laser acupuncture did no better than a sham laser for pain or function at 12 weeks.',
  },
  {
    id: 'infrabeam-pen',
    claim: 'The InfraBeam pen erases arthritis pain (“NASA’s Arthritis Pain-Erasing Miracle Pen”)',
    evidence: [],
    note: 'No trial of this device. The advert states no wavelength and no power output, so it cannot be matched to the doses the trials used. We found no FDA clearance or listing under its name (searched 2026-10-24).',
  },
  {
    id: 'skin-collagen',
    claim: 'Red light improves skin texture and collagen density',
    evidence: [{ studyId: 'wunsch2014', primary: true, result: 'improved' }],
    note: 'One randomised trial against untreated controls (no sham light), 30 full-face sessions with large panels — not a pen. Photo ratings were blinded; participants were not.',
  },
];
