import { exportProfileHtml, exportFilename, esc } from '../exportProfile';
import type { ProfileSpec } from '@/lib/rebuild/importProfile';

const spec = (over: Partial<ProfileSpec> = {}): ProfileSpec => ({
  name: 'Dana Okonkwo',
  headline: 'Warehouse supervisor',
  bio: 'Twelve years keeping a floor running.',
  photoUrl: null,
  location: 'Renton, WA',
  links: [{ label: 'LinkedIn', href: 'https://linkedin.com/in/example' }],
  skills: ['Forklift certified', 'Inventory control'],
  experience: [{ heading: 'Shift Lead — Acme', body: 'Ran a team of nine.' }],
  email: 'dana@example.com',
  ...over,
});

describe('exportProfileHtml', () => {
  it('is self-contained: no external resource of any kind', () => {
    const html = exportProfileHtml(spec(), []);
    // The whole promise is that this opens from a USB stick in ten years. Any of these would
    // make the file depend on a network — and on us.
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link[^>]+rel=["']?stylesheet/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toMatch(/@import/i);
    expect(html).not.toMatch(/fonts\.googleapis|cdn\.|https?:\/\/[^"']*\.(css|js|woff2?)/i);
  });

  it('carries no branding, tracking, or link back to us', () => {
    const html = exportProfileHtml(spec(), []);
    // A "made with" badge on a document someone sends to a hiring manager is us advertising
    // through their job search. The only URLs in the file must be the person's own.
    expect(html.toLowerCase()).not.toContain('quicksites');
    expect(html.toLowerCase()).not.toContain('verbatim');
    expect(html).not.toMatch(/utm_|analytics|gtag|plausible/i);
  });

  it('escapes the résumé text — it is a stranger\'s input that they will email to people', () => {
    const html = exportProfileHtml(
      spec({ name: '<script>alert(1)</script>', bio: 'a & b "quoted"' }),
      [],
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a &amp; b &quot;quoted&quot;');
  });

  it('renders the gaps, and hides them from print', () => {
    const html = exportProfileHtml(spec({ headline: null }), ['headline', 'links']);
    expect(html).toContain('a title for yourself');
    // Visible while they work on it, absent from the document a hiring manager receives.
    expect(html).toMatch(/@media print[\s\S]*\.gaps\s*\{\s*display:\s*none/);
  });

  it('omits every section the résumé did not yield, rather than emitting empty headings', () => {
    const html = exportProfileHtml(
      spec({ skills: [], experience: [], bio: null, links: [], location: null, email: null }),
      [],
    );
    expect(html).not.toContain('<h2>Skills</h2>');
    expect(html).not.toContain('<h2>Experience</h2>');
    expect(html).not.toContain('<h2>About</h2>');
    expect(html).toContain('Dana Okonkwo'); // what it DID have still renders
  });

  it('is deterministic — same input, same bytes (so it needs no storage)', () => {
    expect(exportProfileHtml(spec(), ['links'])).toBe(exportProfileHtml(spec(), ['links']));
  });

  it('pins the light colour scheme so a dark-mode browser cannot invert a printable page', () => {
    expect(exportProfileHtml(spec(), [])).toContain('color-scheme: only light');
  });
});

describe('exportFilename', () => {
  it('slugifies a name', () => {
    expect(exportFilename('Dana Okonkwo')).toBe('dana-okonkwo.html');
  });

  it('never yields an empty or hidden filename', () => {
    expect(exportFilename(null)).toBe('profile.html');
    expect(exportFilename('   ')).toBe('profile.html');
    expect(exportFilename('...')).toBe('profile.html'); // would otherwise be ".html"
  });

  it('strips characters that break filesystems or quote out of the header', () => {
    expect(exportFilename('Ana "Nan" O\'Brien/Smith')).toBe('ana-nan-obriensmith.html');
    expect(exportFilename('Zoë Müller')).toBe('zoe-muller.html');
  });
});

describe('esc', () => {
  it('escapes all five', () => {
    expect(esc(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});
