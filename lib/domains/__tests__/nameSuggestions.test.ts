import { coreName, domainCandidates, shortName } from '../nameSuggestions';

describe('coreName — real listing names from the Renton cohort', () => {
  it('drops a trailing city tag and a branch number, keeping the rest', () => {
    expect(coreName("Torero's Cocina Mexicana & Cantina - Renton")).toBe('toreroscocinamexicanacantina');
    expect(coreName('Taqueria Los Potrillos #5')).toBe('taquerialospotrillos');
  });

  it('drops a leading article', () => {
    expect(coreName('The Local 907')).toBe('local907');
  });

  it('is empty only when there was nothing to work with', () => {
    expect(coreName('')).toBe('');
    expect(coreName('   #4  ')).toBe('');
  });
});

describe('shortName — the version without category words', () => {
  it('offers the distinctive part when there is one', () => {
    expect(shortName('Wild Garlic Chinese Restaurant')).toBe('wildgarlic');
    expect(shortName("Torero's Cocina Mexicana & Cantina")).toBe('toreros');
  });

  // ⚠️ The guard that matters: "Enjoy Teriyaki" minus its category word is "enjoy", which is not
  // their name and would be a bad thing to have bought.
  it('returns nothing when trimming would go too far', () => {
    expect(shortName('Enjoy Teriyaki')).toBe('');
  });

  // ⚠️ shortName cannot catch this one — it does not know where the business is. "Renton Deli"
  // trims to `renton`, a city rather than a business. The caller drops it (see below), which is
  // the right layer: the fact that makes it wrong lives there.
  it('leaves the city case to the caller', () => {
    expect(shortName('Renton Deli')).toBe('renton');
  });

  it('returns nothing when there was nothing to drop', () => {
    expect(shortName('Wild Garlic')).toBe('');
  });
});

describe('domainCandidates', () => {
  const base = { businessName: 'Enjoy Teriyaki', city: 'Renton', category: 'teriyaki' };

  it('leads with the business\'s own name', () => {
    expect(domainCandidates(base)[0]).toEqual({ label: 'enjoyteriyaki', kind: 'their-name' });
  });

  // ⚠️ Which of these is "their name" is the owner's call, not ours — so both are offered when
  // both are usable. `toreroscocinamexicanacantina` is 28 characters and gets dropped by the
  // length cap, which is the right outcome: a domain nobody can say is not a second option.
  it('offers the short and the full form when both are usable', () => {
    const labels = domainCandidates({ businessName: 'Wild Garlic Cafe' }).map((c) => c.label);
    expect(labels).toContain('wildgarlic');
    expect(labels).toContain('wildgarliccafe');
    expect(labels.indexOf('wildgarlic')).toBeLessThan(labels.indexOf('wildgarliccafe'));
  });

  it('drops a form nobody could type rather than offering it', () => {
    const labels = domainCandidates({ businessName: "Torero's Cocina Mexicana & Cantina" }).map((c) => c.label);
    expect(labels).toContain('toreros');
    expect(labels.every((l) => l.length <= 24)).toBe(true);
  });

  // ⚠️ Both kinds are offered and LABELLED. The searchable one suits our ranking story; pushing it
  // as the default would be advice dressed as an ordering.
  it('offers a searchable option and says that is what it is', () => {
    const searchable = domainCandidates(base).find((c) => c.kind === 'searchable');
    expect(searchable?.label).toBe('rentonteriyaki');
  });

  it('never offers a bare city as the business name', () => {
    const labels = domainCandidates({ businessName: 'Renton Deli', city: 'Renton' }).map((c) => c.label);
    expect(labels).not.toContain('renton');
    expect(labels).toContain('rentondeli');
  });

  it('offers name-plus-city as a distinct kind', () => {
    expect(domainCandidates(base).find((c) => c.kind === 'name-and-city')?.label).toBe(
      'enjoyteriyakirenton',
    );
  });

  it('omits city/category variants when we do not have those facts', () => {
    const only = domainCandidates({ businessName: 'Enjoy Teriyaki' });
    expect(only.every((c) => c.kind === 'their-name')).toBe(true);
  });

  it('never emits a duplicate or an unusable length', () => {
    const out = domainCandidates({ businessName: 'A', city: 'Renton', category: 'thai' });
    expect(new Set(out.map((c) => c.label)).size).toBe(out.length);
    expect(out.every((c) => c.label.length >= 3 && c.label.length <= 40)).toBe(true);
  });

  it('returns nothing rather than a city-only domain when the name is unusable', () => {
    const out = domainCandidates({ businessName: '#4', city: 'Renton', category: 'tacos' });
    expect(out.every((c) => c.kind !== 'their-name')).toBe(true);
    // A domain with none of their name in it is not a suggestion for THEM.
    expect(out.some((c) => c.label === 'renton')).toBe(false);
  });
});
