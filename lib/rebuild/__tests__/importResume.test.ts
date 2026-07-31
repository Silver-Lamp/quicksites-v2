/** @jest-environment node */
// importProfile pulls in scrapeSite → cheerio → undici, which needs ReadableStream; the
// default jsdom env doesn't provide it. Nothing here touches the DOM.
import { profileFromResume } from '../importResume';
import { rebuildSpecFromProfile } from '../importProfile';
import { buildResumeSite } from '../buildResumeSite';

// The worked example from the proposal — a real person's real CV, supplied for this purpose.
// Using it rather than a synthetic fixture is the point: invented résumés are tidy in exactly
// the ways real ones aren't.
const SILVER = `Silver Zhao — Senior Web & Mobile Developer · React Native Lead
silveriron86@gmail.com · Telegram: silveriron86 · Shenyang, China

Summary
Senior web & mobile developer, 18+ years across a wide range of technologies.
Deep experience in PHP, JavaScript, and ASP.NET/C# on the web, and both hybrid and native mobile.

Key skills
Mobile: React Native · Expo · Flutter · Ionic
Back-end: Node · Django · Flask · Laravel

Recent experience
ZenHut (London, Web & Mobile, 2023–26) — CodeIgniter/WordPress + React Native
Manyfolds (Munich, Web & Mobile, 2021–23) — Laravel/WordPress/Angular/React
Curecall (Paris, Web, 2020–21) — React
past work: zenhut.co, curecall.fr`;

const SINCE =
  'Wrote the original React Native HiveJournal app by hand — before reaching for React Native ' +
  'was the obvious choice — and has re-joined Point Seven Studio to lead React Native development.';

describe('profileFromResume', () => {
  const spec = profileFromResume({ resumeText: SILVER, sinceParagraph: SINCE });

  it('takes the name from the first line, without the trailing title', () => {
    expect(spec.name).toBe('Silver Zhao');
  });

  it('finds the email without treating it as a link', () => {
    expect(spec.email).toBe('silveriron86@gmail.com');
    expect(spec.links.some((l) => l.href.includes('@'))).toBe(false);
  });

  it('leads the bio with their own "since" paragraph, then the résumé summary', () => {
    expect(spec.bio?.startsWith('Wrote the original React Native')).toBe(true);
    expect(spec.bio).toContain('18+ years');
  });

  it('splits skills on the separators people actually type', () => {
    expect(spec.skills).toEqual(expect.arrayContaining(['React Native', 'Expo', 'Flutter', 'Django']));
  });

  it('keeps each role separate rather than flattening employers together', () => {
    expect(spec.experience?.length).toBeGreaterThanOrEqual(3);
    expect(spec.experience?.[0].heading).toContain('ZenHut');
    expect(spec.experience?.[0].body).toContain('React Native');
  });

  it('picks up bare domains as links', () => {
    const hrefs = spec.links.map((l) => l.href);
    expect(hrefs.some((h) => h.includes('zenhut.co'))).toBe(true);
  });

  // ⚠️ The load-bearing property: this parser rearranges, it never fills. A CV is a factual
  // claim about someone's employment — an invented line here is a different order of wrong
  // from invented marketing copy.
  it('invents nothing when a section is missing', () => {
    const bare = profileFromResume({ resumeText: 'Jane Roe\n\nSummary\nI build things.' });
    expect(bare.skills).toBeUndefined();
    expect(bare.experience).toBeUndefined();
    expect(bare.headline).toBeNull();
    expect(bare.photoUrl).toBeNull(); // never an invented image of a person
  });

  it('refuses to guess a name it cannot read', () => {
    expect(profileFromResume({ resumeText: 'CV 2026 v3 final\n\nSummary\nHi.' }).name).toBeNull();
  });
});

describe('résumé → draft, through the existing pipeline', () => {
  it('maps skills to services and roles to story panels, with no new block types', () => {
    const rs = rebuildSpecFromProfile(profileFromResume({ resumeText: SILVER, sinceParagraph: SINCE }));
    expect(rs.industryKey).toBe('personal');
    expect(rs.businessName).toBe('Silver Zhao');
    expect(rs.services).toEqual(expect.arrayContaining(['React Native']));
    expect(rs.story?.length).toBeGreaterThan(0);
    expect((rs as any).contact?.email).toBe('silveriron86@gmail.com');
  });

  it('leaves the URL path unchanged — no skills, no story', () => {
    const rs = rebuildSpecFromProfile({
      name: 'Ada', headline: 'Engineer', bio: 'Hello.', photoUrl: null, location: null, links: [],
    });
    expect(rs.services).toEqual([]);
    expect(rs.story).toBeUndefined();
  });
});

describe('buildResumeSite', () => {
  it('produces a draft and reports what the résumé did NOT contain', () => {
    const { profile, template, gaps } = buildResumeSite({ resumeText: SILVER, sinceParagraph: SINCE });
    expect(profile.name).toBe('Silver Zhao');
    expect(template).toBeTruthy();
    // Headline is never inferred — a job title is a claim about someone, so it stays a gap
    // until they type it.
    expect(gaps).toContain('headline');
    expect(gaps).not.toContain('skills');
    expect(gaps).not.toContain('experience');
  });

  it('reports the gaps loudly on a thin résumé rather than filling them', () => {
    const { gaps } = buildResumeSite({ resumeText: 'Jane Roe' });
    expect(gaps).toEqual(expect.arrayContaining(['headline', 'skills', 'experience', 'links']));
  });

  it('never puts a generated face on a real person', () => {
    const { profile } = buildResumeSite({ resumeText: SILVER });
    expect(profile.photoUrl).toBeNull();
  });
});
