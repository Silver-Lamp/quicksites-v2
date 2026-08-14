/** @jest-environment node */
import { INDUSTRY_MARKS, markFor, markSvg } from '@/lib/brand/industryMarks';
import { KEY_TO_LABEL } from '@/lib/industries';

describe('industry marks', () => {
  it('falls back to a storefront rather than nothing', () => {
    expect(markFor('a_trade_we_have_never_heard_of').label).toBe('Storefront');
    expect(markFor(null).label).toBe('Storefront');
    expect(markFor('').label).toBe('Storefront');
  });

  it('every industry key resolves to some mark', () => {
    for (const key of Object.keys(KEY_TO_LABEL)) {
      expect(markFor(key).path.length).toBeGreaterThan(10);
    }
  });

  it('no two marks share a path — a shared icon reads as a bug', () => {
    // ⚠️ A real defect the render sheet caught: `real_estate` and `roofing` were both a house and
    // were indistinguishable at 16px. Two industries with one icon teaches a visitor nothing, and
    // looks like the wrong icon rather than a deliberate one.
    const paths = Object.values(INDUSTRY_MARKS).map((m) => m.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('marks use currentColor so a site can tint with its own accent', () => {
    for (const [key, m] of Object.entries(INDUSTRY_MARKS)) {
      expect(`${key}:${m.path}`).toContain('currentColor');
      expect(m.path).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    }
  });

  it('emits a self-contained SVG with the requested colour', () => {
    const svg = markSvg('restaurant', '#ff8800', 32);
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('color:#ff8800');
    expect(svg).toContain('width="32"');
    expect(svg).not.toMatch(/<(script|image|foreignObject)/i);
  });

  it('stays stroke-only, which is what survives 16px', () => {
    for (const m of Object.values(INDUSTRY_MARKS)) {
      expect(m.path).toContain('stroke="currentColor"');
    }
  });
});
