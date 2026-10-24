// lib/evidence/bodyMap.ts — every graded claim placed on a body region, for the Tried & Graded
// body map (owner, 2026-10-24: "an interactive human body diagram … where all of the products
// that we're discussing can be mapped to areas of the human body").
//
// ⚠️ A REGION IS WHERE A CLAIM IS ABOUT, NEVER WHAT A PRODUCT DOES. "Sea moss → lungs" means "the
// claim people make about sea moss concerns the lungs", and the map shows that claim beside its
// grade ("No real evidence"). So this file stores only (topic, claim, region); every grade is
// derived at render from the study records, exactly as the evidence_claims block does, and a
// test fails if a claim is left off the map or a mapping names a claim that does not exist.
import { gradeClaim, type EvidenceGrade } from '@/lib/evidence/grade';
import { EVIDENCE_TOPICS } from '@/lib/evidence/topics';

export type BodyRegionId =
  | 'head' | 'ears' | 'nose' | 'throat' | 'lungs' | 'heart' | 'gut' | 'immune' | 'muscles' | 'joints' | 'skin' | 'whole_life';

export type BodyRegion = { id: BodyRegionId; label: string; blurb: string };

/** In display order. `whole_life` is not a body part and is drawn beside the figure, not on it. */
export const BODY_REGIONS: BodyRegion[] = [
  { id: 'head', label: 'Head & brain', blurb: 'Claims about the brain, the pineal gland, dreams and sleep.' },
  { id: 'ears', label: 'Ears', blurb: 'Claims about ear pain.' },
  { id: 'nose', label: 'Nose', blurb: 'Claims about colds and the nose.' },
  { id: 'throat', label: 'Throat', blurb: 'Claims about cough and the throat.' },
  { id: 'lungs', label: 'Lungs & chest', blurb: 'Claims about the lungs, mucus and a smoker’s chest.' },
  { id: 'heart', label: 'Heart & blood vessels', blurb: 'Claims about the heart, circulation and stroke.' },
  { id: 'gut', label: 'Gut & digestion', blurb: 'Claims about the gut, digestion and parasites.' },
  { id: 'immune', label: 'Immune system', blurb: 'Claims about immune cells.' },
  { id: 'muscles', label: 'Muscles & movement', blurb: 'Claims about strength, endurance and walking.' },
  { id: 'joints', label: 'Joints & arthritis', blurb: 'Claims about joint pain and arthritis.' },
  { id: 'skin', label: 'Skin & wound healing', blurb: 'Claims about wounds and skin.' },
  { id: 'whole_life', label: 'Whole body & life', blurb: 'Claims about the whole body, and habits studied against how long people live.' },
];

/** topic key → (claim id → region). Every claim of every topic must appear exactly once. */
export const CLAIM_REGIONS: Record<string, Record<string, BodyRegionId>> = {
  mullein: { cough: 'throat', 'smokers-lungs': 'lungs', 'ear-pain-combo': 'ears', 'episiotomy-cream': 'skin' },
  'haritaki-pineal': { 'calcification-sleep': 'head', 'fluoride-free-diet': 'head', 'haritaki-decalcifies': 'head', 'haritaki-fluoride-metals': 'whole_life', 'haritaki-dreams': 'head' },
  'oregano-parasites': { 'symptom-signs': 'gut', 'oregano-parasites': 'gut', 'black-seed-parasites': 'gut', 'maju-softgels': 'gut' },
  'functional-spirits': { 'little-saints-serving': 'head', 'lions-mane-mci': 'head', 'lions-mane-healthy-focus': 'head', 'lions-mane-mood': 'head', 'damiana-mood': 'head', 'reishi-calm': 'head' },
  'red-light': { 'knee-oa-pain': 'joints', 'laser-acupuncture': 'joints', 'infrabeam-pen': 'joints', 'skin-collagen': 'skin' },
  'sea-moss': { 'smokers-lungs': 'lungs', mucus: 'lungs', 'carrageenan-spray': 'nose' },
  'urolithin-a': { endurance: 'muscles', walking: 'muscles', strength: 'muscles', power: 'muscles', immune: 'immune', 'blood-vessels': 'heart' },
  'blue-zones': {
    move: 'muscles', plants: 'heart', 'eighty-percent': 'heart', wine: 'heart',
    purpose: 'whole_life', belong: 'whole_life', 'social-ties': 'whole_life', 'right-tribe': 'whole_life',
  },
};

/** Where a reader goes for the full evidence on a topic. */
export const TOPIC_PAGE: Record<string, string> = {
  mullein: '/does-mullein-work',
  'sea-moss': '/sea-moss-for-smokers',
  'red-light': '/red-light-therapy',
  'functional-spirits': '/non-alcoholic-spirits',
  'oregano-parasites': '/oregano-oil-parasites',
  'haritaki-pineal': '/decalcify-pineal-gland',
  'urolithin-a': '/urolithin-a',
  'blue-zones': '/blue-zones-habits-graded',
};

/** Claims nobody has tested — shown on the map as "Not yet tested", never with a grade. */
export const BODY_EXPERIMENTS: Array<{ region: BodyRegionId; label: string; claim: string; href: string }> = [
  { region: 'head', label: 'HAVN hat', claim: 'The maker’s claims about the hat (quoted on its page)', href: '/havn-hat' },
];

export type BodyMapEntry =
  | { kind: 'graded'; region: BodyRegionId; topic: string; topicLabel: string; claimId: string; claim: string; grade: EvidenceGrade; href: string }
  | { kind: 'untested'; region: BodyRegionId; topicLabel: string; claim: string; href: string };

/** Every entry, grades derived now from the records. */
export function bodyMapEntries(): BodyMapEntry[] {
  const out: BodyMapEntry[] = [];
  for (const t of Object.values(EVIDENCE_TOPICS)) {
    const regions = CLAIM_REGIONS[t.key] ?? {};
    for (const c of t.claims) {
      const region = regions[c.id];
      if (!region) continue;
      out.push({ kind: 'graded', region, topic: t.key, topicLabel: t.label, claimId: c.id, claim: c.claim, grade: gradeClaim(c.evidence, t.studies), href: TOPIC_PAGE[t.key] ?? '/' });
    }
  }
  for (const e of BODY_EXPERIMENTS) out.push({ kind: 'untested', region: e.region, topicLabel: e.label, claim: e.claim, href: e.href });
  return out;
}

export function entriesByRegion(entries = bodyMapEntries()): Record<BodyRegionId, BodyMapEntry[]> {
  const by = Object.fromEntries(BODY_REGIONS.map((r) => [r.id, [] as BodyMapEntry[]])) as Record<BodyRegionId, BodyMapEntry[]>;
  for (const e of entries) by[e.region].push(e);
  return by;
}
