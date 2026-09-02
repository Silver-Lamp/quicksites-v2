/**
 * The committed lane artifact must equal what we would actually send.
 *
 * ⚠️ A stale artifact is worse than no artifact, and this is the specific reason: HiveJournal's
 * golden test parses this file as the fixture for their engine. If it drifts from
 * toEngineLaneSpec(), their suite goes green against a shape we no longer send — which is
 * exactly the failure the artifact was introduced to end, restored with an extra step.
 *
 * Regenerate with `npm run emit:lanes`.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { GEO_DOMAIN_RENTAL_LANE } from '@/lib/sales/lanes/geoDomainRental';
import { toEngineLaneSpec } from '@/lib/sales/laneSpec';

const ARTIFACT = join(process.cwd(), 'artifacts/rehearsal/geo-domain-rental.lane.json');

describe('lane artifact', () => {
  it('is byte-identical to what we would send', () => {
    const onDisk = readFileSync(ARTIFACT, 'utf8');
    const expected = JSON.stringify(toEngineLaneSpec(GEO_DOMAIN_RENTAL_LANE), null, 2) + '\n';
    // Compared as bytes, not as parsed objects: HJ reads this file, and a formatting change that
    // survives JSON.parse still changes what a diff of their fixture shows.
    expect(onDisk).toBe(expected);
  });

  it('is the wire shape, not our internal one', () => {
    // The bug this whole artifact exists to prevent was a casing mismatch nobody's tests caught.
    const parsed = JSON.parse(readFileSync(ARTIFACT, 'utf8'));
    expect(parsed.lane.id).toBe('geo-domain-rental');
    expect(Array.isArray(parsed.archetypes)).toBe(true);
    expect(parsed.archetypes.length).toBeGreaterThan(1); // HJ's reader held ONE until they parsed this
    expect(parsed.objections[0]).toHaveProperty('good_move');
    expect(parsed.honesty_rules[0]).toHaveProperty('violating_examples');
    expect(JSON.stringify(parsed)).not.toContain('goodMove');
  });
});
