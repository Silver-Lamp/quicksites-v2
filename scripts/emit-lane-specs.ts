// scripts/emit-lane-specs.ts
//
// Emits each sales lane as the exact JSON we POST to HiveJournal's rehearsal engine, into
// artifacts/rehearsal/. Run: `npm run emit:lanes`.
//
// ⚠️ THIS FILE EXISTS BECAUSE OF A REAL BUG, NOT FOR TIDINESS.
// HJ's golden test used a hand-transcribed copy of our lane. The transcription silently
// performed a snake_case→camelCase conversion that no code performs, so their suite was green
// about a shape we have never sent — and our suite was green about a shape they could not read.
// Our first real call would have 400'd.
//
// The fix both sides agreed: **a cross-product fixture is the other side's bytes, never your
// typing of them.** This writes those bytes to a stable path so HJ's test can parse the artifact
// instead of a copy. lib/sales/__tests__/laneArtifact.test.ts fails if it goes stale.
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { GEO_DOMAIN_RENTAL_LANE } from '@/lib/sales/lanes/geoDomainRental';
import { toEngineLaneSpec } from '@/lib/sales/laneSpec';

export const LANE_ARTIFACTS = [
  { file: 'geo-domain-rental.lane.json', lane: GEO_DOMAIN_RENTAL_LANE },
] as const;

export const ARTIFACT_DIR = join(process.cwd(), 'artifacts', 'rehearsal');

/** The exact bytes we write and send — one place, so the test and the script cannot disagree. */
export function laneArtifactBytes(lane: (typeof LANE_ARTIFACTS)[number]['lane']): string {
  return JSON.stringify(toEngineLaneSpec(lane), null, 2) + '\n';
}

function main() {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  for (const { file, lane } of LANE_ARTIFACTS) {
    const path = join(ARTIFACT_DIR, file);
    writeFileSync(path, laneArtifactBytes(lane));
    console.log(`wrote ${path}`);
  }
}

main();
