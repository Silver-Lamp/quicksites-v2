/**
 * @jest-environment node
 */
// "Too many white vans in generated images" (owner, 2026-10-23).
import { readFileSync } from 'fs';
import path from 'path';
import { wantsVehicles } from '@/lib/images/vehicleGuard';

it('a vehicle is allowed only when the words call for one', () => {
  expect(wantsVehicles('Web Hosting Consulting', 'Consulting', '')).toBe(false);
  expect(wantsVehicles('quiet office desk', 'Salon & Spa', 'Haircuts, Color')).toBe(false);
  expect(wantsVehicles('', 'Towing', '')).toBe(true);
  expect(wantsVehicles('a white van at a job site', 'Other', '')).toBe(true);
  expect(wantsVehicles('', 'Moving', 'Local Moving')).toBe(true);
  expect(wantsVehicles('careful scan of records', 'Accounting', '')).toBe(false); // "car"/"van" inside words
});

it('the hero route applies the rule and never feeds the generic service list into the prompt', () => {
  const src = readFileSync(path.join(process.cwd(), 'app/api/hero/generate-image/route.ts'), 'utf8');
  expect(src).toMatch(/vehiclesOk \? '' : NO_VEHICLES_INSTRUCTION/);
  expect(src).toMatch(/genericServiceNames\(\)/);
});

it('the cross-user industry library is generated images only', () => {
  const src = readFileSync(path.join(process.cwd(), 'lib/media/mediaAssets.ts'), 'utf8');
  const branch = src.slice(src.indexOf("opts.scope === 'industry'"), src.indexOf("} else {", src.indexOf("opts.scope === 'industry'")));
  expect(branch).toMatch(/\.eq\('source', 'generated'\)/);
});
