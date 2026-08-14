/**
 * @jest-environment node
 */
// The renderer must read industry + business_name off the TEMPLATE ROW on the draft path.
//
// ⚠️ THIS BUG SHIPPED TWICE. #789 gated the restaurant chrome on
// `needsMenu((normalized as any).industry ?? siteRow?.industry)` — but `loadDraftTemplate` never
// SELECTED industry, and `siteFields` drops it. So `siteIndustry` was always null on a draft,
// `needsMenu(null)` defaults to food, and an auto shop's page went on asking "Is this your
// restaurant?" and offering online orders. The fix read a field nobody populated.
//
// It survived my own check because I grepped for "Is this your" — which matches "Is this your
// restaurant?". A loose assertion passed over the exact string that was wrong.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(process.cwd(), 'app/sites/[slug]/[[...rest]]/page.tsx'), 'utf8');

describe('the draft loader supplies what the chrome needs', () => {
  it('selects industry and business_name', () => {
    const sel = SRC.match(/\.select\('id, slug, template_name, data[^']*'\)/)?.[0] ?? '';
    expect(sel).toMatch(/\bindustry\b/);
    expect(sel).toMatch(/\bbusiness_name\b/);
  });

  it('returns them from loadDraftTemplate', () => {
    expect(SRC).toMatch(/industry: \(data as any\)\?\.industry/);
    expect(SRC).toMatch(/businessName: \(data as any\)\?\.business_name/);
  });

  // ⚠️ The draft value must come FIRST. `normalized`/`siteRow` do not carry these on the draft
  // path, so a fallback-only chain resolves to null and silently means "restaurant".
  it('prefers the draft values over normalized/siteRow', () => {
    expect(SRC).toMatch(/draftIndustry \?\?[\s\S]{0,80}normalized/);
    expect(SRC).toMatch(/draftBusinessName \?\?[\s\S]{0,80}normalized/);
  });

  it('still decides the food chrome from that industry', () => {
    expect(SRC).toMatch(/isFoodSite = needsMenu\(siteIndustry\)/);
    expect(SRC).toMatch(/demandEnabled = showClaimBar && isFoodSite/);
    expect(SRC).toMatch(/isFood=\{isFoodSite\}/);
  });
});
