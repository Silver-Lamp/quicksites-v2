/**
 * @jest-environment node
 */
import { builderQuestions, estimate, formatRange, anchorsUsed } from '@/lib/treehouseBuilders/estimate';
import { ADD_ON_ANCHORS, COST_FACTORS, PRICE_ANCHORS } from '@/lib/treehouseBuilders/costData';

const base = { scale: 'kids' as const, enclosed: false, access: 'easy' as const, materials: 'standard' as const, engineered: false, addOns: [] };

describe('every figure is a published one, attributed', () => {
  it('each price anchor names a builder, a url, a date and their exact words', () => {
    for (const a of PRICE_ANCHORS) {
      expect(a.builder.length).toBeGreaterThan(2);
      expect(a.url).toMatch(/^https:\/\//);
      expect(a.read).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.quote).toMatch(/\$[\d,]/);
    }
  });

  it('a band cites whose figures its bounds came from', () => {
    for (const scale of ['platform', 'kids', 'family', 'habitable'] as const) {
      const r = estimate({ ...base, scale });
      expect(r.basis).toMatch(/Treehouse Experts|Tree Top Builders|Nelson Treehouse/);
      // The bound must actually appear in an anchor — no interpolated numbers.
      const bounds = PRICE_ANCHORS.flatMap((a) => [a.lowUsd, a.highUsd]).filter(Boolean);
      expect(bounds).toContain(r.lowUsd);
    }
  });

  it('⚠️ never averages the builders into a market rate', () => {
    // Three builders is not a dataset. An average would be a number none of them said.
    const src = require('node:fs').readFileSync(require('node:path').join(process.cwd(), 'lib/treehouseBuilders/estimate.ts'), 'utf8');
    expect(src).not.toMatch(/\baverage\b|\bmean\b|reduce\(.*\/\s*(anchors|PRICE_ANCHORS)\.length/i);
  });
});

describe('the output can never read as a quote', () => {
  it('is always a range, never one number', () => {
    const r = estimate(base);
    expect(r.highUsd).toBeGreaterThan(r.lowUsd);
    expect(formatRange(r.lowUsd, r.highUsd)).toMatch(/\$[\d,]+ – \$[\d,]+/);
  });

  it('carries the builders’ own reason that a quote is impossible', () => {
    expect(estimate(base).noQuoteReason).toMatch(/without knowing the trees/i);
  });

  it('always returns the nine cost factors, whatever the inputs', () => {
    expect(estimate(base).factors).toEqual(COST_FACTORS);
    expect(estimate({ ...base, scale: 'habitable', enclosed: true }).factors).toHaveLength(9);
  });
});

describe('adjustments are explained, not silently applied', () => {
  it('each adjustment that moves a bound also states why', () => {
    const plain = estimate(base);
    const fancy = estimate({ ...base, enclosed: true, materials: 'premium', access: 'tight' });
    expect(fancy.highUsd).toBeGreaterThan(plain.highUsd);
    expect(fancy.lowUsd).toBeGreaterThan(plain.lowUsd);
    expect(fancy.adjustments).toHaveLength(3);
    for (const a of fancy.adjustments) expect(a.length).toBeGreaterThan(30);
  });

  it('nothing is adjusted when nothing was chosen', () => {
    expect(estimate(base).adjustments).toEqual([]);
  });

  it('a platform does not get the enclosure bump — you cannot enclose a deck', () => {
    const a = estimate({ ...base, scale: 'platform' });
    const b = estimate({ ...base, scale: 'platform', enclosed: true });
    expect(b.highUsd).toBe(a.highUsd);
  });
});

describe('add-ons come from the published list only', () => {
  it('sums only known keys and ignores anything invented', () => {
    const r = estimate({ ...base, addOns: ['zip', 'not-a-real-addon'] });
    const zip = ADD_ON_ANCHORS.find((a) => a.key === 'zip')!;
    expect(r.addOnLowUsd).toBe(zip.lowUsd);
    expect(r.addOnHighUsd).toBe(zip.highUsd);
  });
});

describe('the questions are the product', () => {
  it('always asks about the trees first', () => {
    expect(builderQuestions(base)[0]).toMatch(/species/i);
  });

  it('adds questions the answers earned', () => {
    expect(builderQuestions({ ...base, engineered: true }).join(' ')).toMatch(/permitted/i);
    expect(builderQuestions({ ...base, access: 'tight' }).join(' ')).toMatch(/reach the site/i);
    expect(builderQuestions({ ...base, scale: 'habitable' }).join(' ')).toMatch(/power, water or heat/i);
  });
});

describe('⚠️ nothing structural, ever', () => {
  it('no span, bolt, load or safety language anywhere in the planner', () => {
    const fs = require('node:fs'); const path = require('node:path');
    for (const f of ['estimate.ts', 'costData.ts']) {
      const src = fs.readFileSync(path.join(process.cwd(), 'lib/treehouseBuilders', f), 'utf8');
      // Comments explain WHY we refuse, so strip them before checking the code.
      const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code).not.toMatch(/\b(span|joist|bolt sizing|load rating|safe for|will hold)\b/i);
    }
  });

  it('exposes its sources for rendering', () => {
    expect(anchorsUsed().length).toBeGreaterThanOrEqual(5);
  });
});
