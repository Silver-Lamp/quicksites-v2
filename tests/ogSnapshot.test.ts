import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { toMatchImageSnapshot } from 'jest-image-snapshot';

expect.extend({ toMatchImageSnapshot });

describe('OG Image Snapshot Rendering', () => {
  const TEST_IDS = {
    hero: 'snapshot-id-hero',
    features: 'snapshot-id-features',
    testimonials: 'snapshot-id-testimonials',
    cta: 'snapshot-id-cta',
    invalid: 'invalid-id',
  };

  const BASE_URL = 'http://localhost:3000/api/og/snapshot';

  for (const [blockType, id] of Object.entries(TEST_IDS)) {
    it(`renders valid OG image for block type: ${blockType}`, async () => {
      const res = await fetch(`${BASE_URL}?snapshotId=${id}`);
      expect(res.status).toBe(200);
      const buffer = await res.buffer();

      // Save the image to disk for manual inspection (optional)
      const outPath = path.join(__dirname, '__output__', `${blockType}.png`);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, buffer);

      expect(buffer).toMatchSnapshot();
    });
  }
});
