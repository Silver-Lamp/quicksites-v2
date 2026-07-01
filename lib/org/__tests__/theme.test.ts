// lib/org/__tests__/theme.test.ts
import { pickAccentColor, normalizeHexColor } from '../theme';

describe('normalizeHexColor', () => {
  it('accepts 3- and 6-digit hex', () => {
    expect(normalizeHexColor('#0af')).toBe('#0af');
    expect(normalizeHexColor('#00AAFF')).toBe('#00AAFF');
    expect(normalizeHexColor('  #123abc  ')).toBe('#123abc');
  });
  it('rejects non-hex / unsafe values', () => {
    expect(normalizeHexColor('red')).toBeNull();
    expect(normalizeHexColor('#12')).toBeNull();
    expect(normalizeHexColor('rgb(0,0,0)')).toBeNull();
    expect(normalizeHexColor('#0af; background:url(x)')).toBeNull(); // no injection
    expect(normalizeHexColor(123 as any)).toBeNull();
    expect(normalizeHexColor(null)).toBeNull();
  });
});

describe('pickAccentColor', () => {
  it('reads primary, then accent, then colors.primary', () => {
    expect(pickAccentColor({ primary: '#0af' })).toBe('#0af');
    expect(pickAccentColor({ accent: '#f0a' })).toBe('#f0a');
    expect(pickAccentColor({ colors: { primary: '#abc' } })).toBe('#abc');
  });
  it('prefers primary over the others', () => {
    expect(pickAccentColor({ primary: '#111', accent: '#222', colors: { primary: '#333' } })).toBe('#111');
  });
  it('returns null for empty / invalid / non-object input', () => {
    expect(pickAccentColor(null)).toBeNull();
    expect(pickAccentColor({})).toBeNull();
    expect(pickAccentColor({ primary: 'blue' })).toBeNull();
    expect(pickAccentColor('#0af')).toBeNull(); // must be the theme object, not a string
  });
});
