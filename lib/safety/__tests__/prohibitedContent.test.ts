// lib/safety/__tests__/prohibitedContent.test.ts
//
// The screen must catch high-confidence illegal listings AND — just as important —
// let legitimate local-business listings through (false positives block real customers).

import { screenListing } from '../prohibitedContent';

describe('screenListing — blocks prohibited', () => {
  const blocked: Array<[string, string]> = [
    ['Cocaine — top quality', ''],
    ['Fentanyl powder for sale', 'discreet shipping'],
    ['Oxycodone', 'buy oxycontin online no prescription cheap'],
    ['Ghost gun kit', 'untraceable, no serial'],
    ['Replica Rolex Submariner', '1:1 quality designer watch'],
    ['Fake drivers license', 'novelty id, looks real'],
    ['CVV shop', 'fresh fullz and cc dumps'],
    ['Instagram hacking service', 'hacker for hire, any account'],
    ['Rhino horn powder', ''],
    ['Escort — full service GFE incall', ''],
  ];
  it.each(blocked)('flags %s', (title, description) => {
    const r = screenListing({ title, description });
    expect(r.ok).toBe(false);
    expect(r.category).toBeTruthy();
  });
});

describe('screenListing — allows legitimate local-business listings', () => {
  const allowed: Array<[string, string]> = [
    ['Chef’s Knife — 8 inch', 'High-carbon steel kitchen knife, full tang.'],
    ['Caulking gun', 'Heavy-duty caulk gun for sealing.'],
    ['Lawn mowing — front + back', 'Weekly service, $49.'],
    ['Composite deck build', 'Freestanding 20x16 deck, includes railing and one stair flight.'],
    ['Coca-Cola 12-pack', 'Classic soda, cold.'],
    ['Meth lab cleanup service', 'Certified biohazard remediation for property owners.'], // legit remediation
    ['Gun cleaning kit', 'Bore brushes and solvent for firearm maintenance.'], // ambiguous but not a sale of a prohibited weapon
    ['Vintage handbag — authentic Gucci', 'Pre-owned, comes with authenticity card.'],
    ['Escort service to the airport', 'Private car, we escort you curb to gate.'], // "escort" without sexual phrasing
    ['Deep tissue massage', '60-minute therapeutic massage.'],
    ['Sausage & peppers', 'House-made Italian sausage.'],
    ['Bar & grill — craft cocktails', 'Full bar, happy hour 4–6.'],
  ];
  it.each(allowed)('allows %s', (title, description) => {
    const r = screenListing({ title, description });
    expect(r.ok).toBe(true);
  });
});

describe('screenListing — edge behavior', () => {
  it('is empty-safe', () => {
    expect(screenListing({}).ok).toBe(true);
    expect(screenListing({ title: '', description: null }).ok).toBe(true);
  });
  it('scans extra fields too', () => {
    const r = screenListing({ title: 'Special', description: 'ask me', extra: ['fresh heroin, black tar'] });
    expect(r.ok).toBe(false);
    expect(r.category).toBe('controlled_substances');
  });
});
