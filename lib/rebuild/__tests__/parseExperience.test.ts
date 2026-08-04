import { parseExperience, profileFromResume } from '../importResume';

describe('parseExperience', () => {
  it('recognises a PLAIN HYPHEN as the role separator, which is how people actually type', () => {
    // The bug this file exists for: the separator was em/en dash only, so an ordinary résumé
    // produced heading: '' on every line and the page rendered blank headings.
    const out = parseExperience(['Shift Lead - Acme Distribution, 2019-2026']);
    expect(out).toEqual([{ heading: 'Shift Lead', body: 'Acme Distribution, 2019-2026' }]);
  });

  it('does not split the hyphen inside a date range', () => {
    // " - " (spaced) is the separator; "2019-2026" is one token. If this ever breaks, every
    // date range becomes a fake employer.
    const [role] = parseExperience(['Warehouse Associate - Cascade Freight, 2014-2019']);
    expect(role.body).toBe('Cascade Freight, 2014-2019');
  });

  it.each([
    ['em dash', 'Lead — Acme'],
    ['en dash', 'Lead – Acme'],
    ['pipe', 'Lead | Acme'],
    ['at', 'Lead @ Acme'],
  ])('handles %s', (_label, line) => {
    expect(parseExperience([line])[0]).toEqual({ heading: 'Lead', body: 'Acme' });
  });

  it('attaches a description line to the role above instead of making a headingless entry', () => {
    const out = parseExperience([
      'Shift Lead - Acme Distribution, 2019-2026',
      'Ran a team of nine across two shifts.',
      'Cut pick errors by a third.',
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].heading).toBe('Shift Lead');
    expect(out[0].body).toBe(
      'Acme Distribution, 2019-2026\nRan a team of nine across two shifts.\nCut pick errors by a third.',
    );
  });

  it('starts a new role after a blank line rather than gluing it to the previous employer', () => {
    const out = parseExperience([
      'Shift Lead - Acme',
      'Ran a team of nine.',
      '',
      'Warehouse Associate - Cascade',
      'Receiving and cycle counts.',
    ]);
    expect(out.map((r) => r.heading)).toEqual(['Shift Lead', 'Warehouse Associate']);
    expect(out[1].body).toBe('Cascade\nReceiving and cycle counts.');
  });

  it('strips Word bullet glyphs, including the bare "o"', () => {
    const out = parseExperience(['Shift Lead - Acme', 'o Ran a team of nine', '• Cut errors']);
    expect(out[0].body).toBe('Acme\nRan a team of nine\nCut errors');
  });

  it('keeps an unattributable line rather than dropping it', () => {
    // We rearrange what someone wrote; we never silently discard it.
    expect(parseExperience(['Various contract work, 2020'])).toEqual([
      { heading: '', body: 'Various contract work, 2020' },
    ]);
  });

  it('emits nothing for an empty section', () => {
    expect(parseExperience([])).toEqual([]);
    expect(parseExperience(['', '  '])).toEqual([]);
  });
});

describe('regression: a plain-hyphen résumé through the real parser', () => {
  const RESUME = `Dana Okonkwo
Warehouse Supervisor
Renton, WA | dana@example.com

SUMMARY
Twelve years keeping a distribution floor running.

SKILLS
Forklift certified, Inventory control

EXPERIENCE
Shift Lead - Acme Distribution, 2019-2026
Ran a team of nine across two shifts.

Warehouse Associate - Cascade Freight, 2014-2019
Receiving, put-away, cycle counts.
`;

  it('produces two roles with real headings, not four with none', () => {
    const spec = profileFromResume({ resumeText: RESUME });
    expect(spec.experience).toHaveLength(2);
    expect(spec.experience?.map((r) => r.heading)).toEqual(['Shift Lead', 'Warehouse Associate']);
    // The thing a visitor would have seen: an entry with no heading at all.
    expect(spec.experience?.some((r) => !r.heading)).toBe(false);
  });
});

describe('location in the contact line', () => {
  const withContact = (contact: string) =>
    profileFromResume({ resumeText: `Dana Okonkwo\n${contact}\n\nSUMMARY\nTwelve years on a floor.\n` });

  it('moves "City, ST" out of the biography and into location', () => {
    const spec = withContact('Renton, WA | dana@example.com');
    expect(spec.location).toBe('Renton, WA');
    // The defect this fixes: the About paragraph opened with the person's own address line.
    expect(spec.bio).toBe('Twelve years on a floor.');
    expect(spec.bio).not.toContain('dana@example.com');
  });

  it('does NOT take a city out of a sentence — over-matching would invent an address', () => {
    const spec = profileFromResume({
      resumeText: 'Dana Okonkwo\n\nSUMMARY\nI worked in Portland, OR for eleven years.\n',
    });
    expect(spec.location).toBeNull();
    expect(spec.bio).toContain('Portland, OR');
  });

  it('leaves location null when there is nothing that looks like one', () => {
    expect(withContact('dana@example.com').location).toBeNull();
  });

  it('prefers what the person typed over what we read', () => {
    const spec = profileFromResume({
      resumeText: 'Dana Okonkwo\nRenton, WA | dana@example.com\n\nSUMMARY\nTwelve years.\n',
      location: 'Seattle, WA',
    });
    expect(spec.location).toBe('Seattle, WA');
  });
});
