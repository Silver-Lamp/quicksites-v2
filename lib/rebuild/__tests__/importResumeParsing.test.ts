import { profileFromResume } from '../importResume';

/**
 * Every case here came from running ONE real senior engineer's résumé through the parser and
 * looking at what came out — the first time it had been pointed at a document nobody wrote for it.
 * All four defects were invisible to `tsc`, invisible in the block JSON, and would have been
 * visible to a hiring manager on the published page.
 */
describe('importResume — defects found by dogfooding a real CV', () => {
  it('recognises "TECHNICAL SKILLS", not just "SKILLS"', () => {
    // The heading regex was anchored at ^(key skills|skills|…), so the commonest heading on an
    // engineering CV matched nothing and the whole section was dropped. It reported `skills` as a
    // gap — honest, and still blind.
    const p = profileFromResume({
      resumeText: 'Jane Doe\n\nTECHNICAL SKILLS\nLanguages: TypeScript, Go\n',
    });
    expect(p.skills ?? []).toEqual(expect.arrayContaining(['TypeScript', 'Go']));
  });

  it('does not turn Next.js or Node.js into websites', () => {
    // URL_RX accepts any word.word with a 2+ char tail, which is the exact shape of a JS
    // framework. The published page carried clickable links to https://Next.js — broken links
    // labelled with the technologies the person is best at.
    const p = profileFromResume({
      resumeText: 'Jane Doe\n\nSKILLS\nJavaScript (React, Next.js, Node.js), ASP.NET\n',
    });
    const hrefs = p.links.map((l) => l.href);
    expect(hrefs).not.toContain('https://Next.js');
    expect(hrefs).not.toContain('https://Node.js');
    expect(hrefs.some((h) => /\.js$/i.test(h))).toBe(false);
  });

  it('does not mine an email address for two fake domains', () => {
    // The per-match email guard could not help: the URL pattern matches INSIDE an address, so
    // "sandon.jurowski@pointsevenstudio.com" yielded `sandon.jurowski` and `pointsevenstudio.com`
    // as separate "links", neither of which is an email on its own.
    const p = profileFromResume({
      resumeText: 'Jane Doe\njane.doe@example.com · github.com/janedoe\n',
    });
    const hrefs = p.links.map((l) => l.href);
    expect(hrefs).toContain('https://github.com/janedoe');
    expect(hrefs).not.toContain('https://jane.doe');
    expect(hrefs).not.toContain('https://example.com');
  });

  it('keeps a parenthesised qualifier attached to its skill', () => {
    // A naive comma split produced the chips "JavaScript (React" … "Express)" — literal
    // unbalanced brackets on the page.
    const p = profileFromResume({
      resumeText:
        'Jane Doe\n\nTECHNICAL SKILLS\nLanguages: JavaScript (React, Next.js, Express), Python\n',
    });
    const skills = p.skills ?? [];
    expect(skills).toContain('JavaScript (React, Next.js, Express)');
    expect(skills).toContain('Python');
    for (const s of skills) {
      expect((s.match(/\(/g) ?? []).length).toBe((s.match(/\)/g) ?? []).length);
    }
  });

  it('strips a long category label instead of shipping it as a skill', () => {
    // The cap was 24 characters. "State Management & Data Fetching:" is 32, so it survived and
    // rendered as a chip reading "State Management & Data Fetching: Zustand".
    const p = profileFromResume({
      resumeText:
        'Jane Doe\n\nTECHNICAL SKILLS\nState Management & Data Fetching: Zustand, React Query\n',
    });
    const skills = p.skills ?? [];
    expect(skills).toContain('Zustand');
    expect(skills.some((s) => s.includes(':'))).toBe(false);
  });

  it('still invents nothing — an absent headline stays absent', () => {
    // The point of every fix above is to stop DROPPING real content. None of them may start
    // MANUFACTURING it: a job title is a claim about a person.
    const p = profileFromResume({ resumeText: 'Jane Doe\n\nSKILLS\nGo, Rust\n' });
    expect(p.headline).toBeNull();
    expect(p.bio == null || typeof p.bio === 'string').toBe(true);
  });
});
