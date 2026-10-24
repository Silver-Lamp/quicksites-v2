// lib/evidence/topics/index.ts — every graded topic, by key. The `evidence_claims` block reads a
// topic from here at render time, so a published page always shows the grade the current records
// produce — a grade is never stored in page content (lib/evidence/grade.ts).
import type { Study } from '@/lib/evidence/grade';
import { MULLEIN_CLAIMS, MULLEIN_EVIDENCE_CHECKED, MULLEIN_STUDIES, type TopicClaim } from '@/lib/evidence/topics/mullein';
import { BLUE_ZONES_CLAIMS, BLUE_ZONES_EVIDENCE_CHECKED, BLUE_ZONES_STUDIES } from '@/lib/evidence/topics/blueZones';
import { HARITAKI_PINEAL_CLAIMS, HARITAKI_PINEAL_EVIDENCE_CHECKED, HARITAKI_PINEAL_STUDIES } from '@/lib/evidence/topics/haritakiPineal';
import { OREGANO_PARASITES_CLAIMS, OREGANO_PARASITES_EVIDENCE_CHECKED, OREGANO_PARASITES_STUDIES } from '@/lib/evidence/topics/oreganoParasites';
import { RED_LIGHT_CLAIMS, RED_LIGHT_EVIDENCE_CHECKED, RED_LIGHT_STUDIES } from '@/lib/evidence/topics/redLight';
import { SEA_MOSS_CLAIMS, SEA_MOSS_EVIDENCE_CHECKED, SEA_MOSS_STUDIES } from '@/lib/evidence/topics/seaMoss';
import { UROLITHIN_A_CLAIMS, UROLITHIN_A_EVIDENCE_CHECKED, UROLITHIN_A_STUDIES } from '@/lib/evidence/topics/urolithinA';

export type EvidenceTopic = { key: string; label: string; checked: string; studies: Study[]; claims: TopicClaim[] };

export const EVIDENCE_TOPICS: Record<string, EvidenceTopic> = {
  mullein: { key: 'mullein', label: 'Mullein', checked: MULLEIN_EVIDENCE_CHECKED, studies: MULLEIN_STUDIES, claims: MULLEIN_CLAIMS },
  'urolithin-a': { key: 'urolithin-a', label: 'Urolithin A (Mitopure)', checked: UROLITHIN_A_EVIDENCE_CHECKED, studies: UROLITHIN_A_STUDIES, claims: UROLITHIN_A_CLAIMS },
  'haritaki-pineal': { key: 'haritaki-pineal', label: 'Haritaki & the pineal gland', checked: HARITAKI_PINEAL_EVIDENCE_CHECKED, studies: HARITAKI_PINEAL_STUDIES, claims: HARITAKI_PINEAL_CLAIMS },
  'oregano-parasites': { key: 'oregano-parasites', label: 'Oregano & black seed oil (parasites)', checked: OREGANO_PARASITES_EVIDENCE_CHECKED, studies: OREGANO_PARASITES_STUDIES, claims: OREGANO_PARASITES_CLAIMS },
  'red-light': { key: 'red-light', label: 'Red light therapy', checked: RED_LIGHT_EVIDENCE_CHECKED, studies: RED_LIGHT_STUDIES, claims: RED_LIGHT_CLAIMS },
  'sea-moss': { key: 'sea-moss', label: 'Sea moss (Irish moss)', checked: SEA_MOSS_EVIDENCE_CHECKED, studies: SEA_MOSS_STUDIES, claims: SEA_MOSS_CLAIMS },
  'blue-zones': { key: 'blue-zones', label: 'Blue Zones habits', checked: BLUE_ZONES_EVIDENCE_CHECKED, studies: BLUE_ZONES_STUDIES, claims: BLUE_ZONES_CLAIMS },
};

export function evidenceTopic(key: string | null | undefined): EvidenceTopic | null {
  return (key && EVIDENCE_TOPICS[key]) || null;
}
