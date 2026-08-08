import {
  defaultContactHeading,
  industryOfTemplate,
  isPersonIndustry,
  isPersonTemplate,
} from '../personSite';

describe('isPersonIndustry', () => {
  it('is true for the two industries that are about a human', () => {
    expect(isPersonIndustry('personal')).toBe(true);
    expect(isPersonIndustry('author')).toBe(true);
  });

  it('is false for businesses and for nothing at all', () => {
    expect(isPersonIndustry('towing')).toBe(false);
    expect(isPersonIndustry('restaurant')).toBe(false);
    expect(isPersonIndustry(null)).toBe(false);
    expect(isPersonIndustry(undefined)).toBe(false);
  });
});

describe('industryOfTemplate', () => {
  it('reads what industryScaffold stored', () => {
    expect(industryOfTemplate({ meta: { industry: 'personal' } })).toBe('personal');
  });

  it('returns null rather than an empty string', () => {
    expect(industryOfTemplate({ meta: { industry: '  ' } })).toBeNull();
    expect(industryOfTemplate({})).toBeNull();
    expect(industryOfTemplate(null)).toBeNull();
  });
});

describe('isPersonTemplate', () => {
  it('honours an explicit override in both directions', () => {
    expect(isPersonTemplate({ meta: { industry: 'towing', person: { enabled: true } } })).toBe(true);
    expect(isPersonTemplate({ meta: { industry: 'personal', person: { enabled: false } } })).toBe(
      false,
    );
  });
});

describe('defaultContactHeading', () => {
  it('speaks in the first person on a person site', () => {
    expect(defaultContactHeading({ meta: { industry: 'personal' } })).toBe('Get in Touch');
    expect(defaultContactHeading({ meta: { industry: 'author' } }, 'Sandon Jurowski')).toBe(
      'Get in Touch',
    );
  });

  it('keeps the business voice for a business', () => {
    expect(defaultContactHeading({ meta: { industry: 'towing' } }, 'Grafton Towing')).toBe(
      'Contact Grafton Towing',
    );
    expect(defaultContactHeading({})).toBe('Contact Us');
  });
});
