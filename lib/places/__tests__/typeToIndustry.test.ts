/**
 * @jest-environment node
 */
// Places categories → our industry key.
//
// ⚠️ THE BUG THIS EXISTS FOR, AND WHY IT WAS INVISIBLE. The alias table is keyed on Google's raw
// type vocabulary (`car_repair`), but the Places DETAILS response returns DISPLAY LABELS — "Car
// Repair". Lowercasing alone left "car repair", which matched no alias and no synonym, so the
// function fell through to its `restaurant` default.
//
// Five real auto shops were then built with the RESTAURANT scaffold — menu block, order bar — while
// their AI copy correctly read "Your Trusted Mechanics". Nothing errored. A wrong industry and a
// correctly-detected restaurant are the same value.
import { typeToIndustryKey } from '../typeToIndustry';

describe('display labels resolve, not just raw types', () => {
  it.each([
    ['Car Repair', 'auto_repair'],
    ['Hair Care', 'salon_spa'],
    ['Roofing Contractor', 'roofing'],
    ['Plumber', 'plumbing'],
  ])('%s → %s', (label, want) => {
    expect(typeToIndustryKey([label])).toBe(want);
  });

  it('still resolves the raw underscore vocabulary', () => {
    expect(typeToIndustryKey(['car_repair'])).toBe('auto_repair');
    expect(typeToIndustryKey(['meal_takeaway'])).toBe('restaurant');
  });

  it('resolves food correctly rather than by accident of the fallback', () => {
    // ⚠️ Restaurants only ever "worked" because the fallback IS restaurant. This asserts the
    // mapping does it, so a future fallback change cannot silently break food.
    expect(typeToIndustryKey(['Restaurant'])).toBe('restaurant');
    expect(typeToIndustryKey(['Bakery'])).toBe('restaurant');
  });
});

describe('the fallback', () => {
  // ⚠️ Documented, not endorsed. Defaulting an unrecognised business to `restaurant` puts a menu
  // block and an order bar on whatever it is. The normalisation above is what keeps real
  // categories from reaching it; this test pins the behaviour so a change is deliberate.
  it('is restaurant when nothing matches, and is overridable', () => {
    expect(typeToIndustryKey(['zzz_unknown_thing'])).toBe('restaurant');
    expect(typeToIndustryKey(['zzz_unknown_thing'], 'auto_repair')).toBe('auto_repair');
  });

  it('is used for an empty or missing list', () => {
    expect(typeToIndustryKey([])).toBe('restaurant');
    expect(typeToIndustryKey(null)).toBe('restaurant');
  });

  // Generic Google types carry no signal and must not decide the scaffold.
  it('ignores generic types', () => {
    expect(typeToIndustryKey(['point_of_interest', 'establishment', 'Car Repair'])).toBe('auto_repair');
  });
});
