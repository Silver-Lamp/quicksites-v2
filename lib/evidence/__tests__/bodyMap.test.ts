/**
 * @jest-environment node
 */
// The body map places every graded claim on the body and derives every grade (2026-10-24).
import { readFileSync } from 'fs';
import path from 'path';
import { BODY_REGIONS, CLAIM_REGIONS, TOPIC_PAGE, bodyMapEntries, entriesByRegion } from '@/lib/evidence/bodyMap';
import { EVIDENCE_TOPICS } from '@/lib/evidence/topics';
import { gradeClaim } from '@/lib/evidence/grade';
import { GUIDE_PAGES } from '@/lib/guide/triedAndGraded';

it('every claim of every topic is on the map exactly once, and every mapping names a real claim', () => {
  const regionIds = new Set(BODY_REGIONS.map((r) => r.id));
  for (const t of Object.values(EVIDENCE_TOPICS)) {
    const map = CLAIM_REGIONS[t.key];
    expect(map).toBeDefined();
    expect(Object.keys(map).sort()).toEqual(t.claims.map((c) => c.id).sort());
    for (const r of Object.values(map)) expect(regionIds.has(r)).toBe(true);
    expect(TOPIC_PAGE[t.key]).toMatch(/^\//);
  }
});

it('grades are derived from the records, never stored on the map', () => {
  for (const e of bodyMapEntries()) {
    if (e.kind !== 'graded') continue;
    const t = EVIDENCE_TOPICS[e.topic];
    expect(e.grade).toBe(gradeClaim(t.claims.find((c) => c.id === e.claimId)!.evidence, t.studies));
  }
  const src = readFileSync(path.join(process.cwd(), 'lib/evidence/bodyMap.ts'), 'utf8');
  expect(src).not.toMatch(/'(established|promising|early|lab_only|tested_no_effect|no_evidence)'/);
});

it('every region on the body has something to show, and the guide links the map from home', () => {
  const by = entriesByRegion();
  for (const r of BODY_REGIONS) expect(by[r.id].length).toBeGreaterThan(0);
  const page = GUIDE_PAGES.find((p) => p.slug === 'body-map')!;
  expect(page.blocks.some((b) => b.kind === 'body_map')).toBe(true);
  const home = GUIDE_PAGES.find((p) => p.slug === 'home')!;
  expect(home.blocks.some((b) => b.kind === 'text' && b.html.includes('href="/body-map"'))).toBe(true);
});
