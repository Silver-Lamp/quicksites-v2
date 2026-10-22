/**
 * @jest-environment node
 */
// The guide's copy rules (docs/longevity/MULLEIN_PAGES.md). A health page is the one place a phrase
// is a claim; these fail before a page ships.
import { AFFILIATE_LINKS_LIVE, COMMISSION_LINE, GUIDE_NAME, GUIDE_PAGES, GUIDE_THEME, guidePages, guideStats, NOT_AFFILIATED_BZ, QUIT_LINE, RIFE_HISTORY } from '@/lib/guide/triedAndGraded';
import { gradeClaim } from '@/lib/evidence/grade';
import { BLUE_ZONES_CLAIMS, BLUE_ZONES_STUDIES } from '@/lib/evidence/topics/blueZones';
import { UROLITHIN_A_CLAIMS, UROLITHIN_A_STUDIES } from '@/lib/evidence/topics/urolithinA';

const html = (p: (typeof GUIDE_PAGES)[number]) =>
  p.blocks.map((b) => (b.kind === 'text' ? b.html : b.kind === 'hero' ? `${b.headline} ${b.subheadline}` : '')).join(' ') + ` ${p.title} ${p.description}`;
const text = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// Affirmative claim shapes. The pages may ASK "does mullein detox your lungs?" and answer it; they
// may never assert it.
const FORBIDDEN = [
  /\b(mullein|it|this|our product)\s+(detoxes|cleanses|repairs|heals|protects|clears|strengthens|supports)\b/i,
  /\b(lung|respiratory)\s+(support|health support|cleanse|detox formula)\b/i,
  /\bclinically (proven|tested)\b/i,
  /\bproven to\b/i,
  /\bboosts? (lung|immune)\b/i,
  /\b(undo|reverse)s? (the )?(damage|effects) of smoking\b/i,
];

describe('Tried & Graded copy rules', () => {
  it('has the pages the plan names, each with a title and description', () => {
    const slugs = GUIDE_PAGES.map((p) => p.slug);
    for (const s of ['home', 'mullein-for-smokers', 'does-mullein-detox-your-lungs', 'smoking-mullein', 'does-mullein-work', 'mullein-drops-gummies-capsules-tea', 'mullein-study', 'how-we-grade']) expect(slugs).toContain(s);
    for (const p of GUIDE_PAGES) {
      expect(p.title.length).toBeGreaterThan(10);
      expect(p.description.length).toBeGreaterThan(40);
      expect(p.description.length).toBeLessThanOrEqual(160);
    }
  });
  it('asserts no benefit claim anywhere', () => {
    const hits: string[] = [];
    for (const p of GUIDE_PAGES) for (const re of FORBIDDEN) { const m = text(html(p)).match(re); if (m) hits.push(`${p.slug}: ${m[0]}`); }
    expect(hits).toEqual([]);
  });
  it('types no grade into copy — grades come from evidence blocks', () => {
    // how-we-grade DEFINES the six labels; every other page must get a grade from a block.
    for (const p of GUIDE_PAGES.filter((x) => x.slug !== 'how-we-grade')) {
      for (const b of p.blocks) if (b.kind === 'text') expect(b.html).not.toMatch(/data-grade|>\s*(Established|Promising)\s*</);
    }
    expect(GUIDE_PAGES.find((p) => p.slug === 'mullein-for-smokers')!.blocks.some((b) => b.kind === 'evidence')).toBe(true);
  });
  it('every page that names smokers or smoking carries quit help', () => {
    for (const p of GUIDE_PAGES) if (/smok/i.test(html(p)) && p.slug !== 'home' && p.slug !== 'experiments' && p.slug !== 'how-we-grade' && p.slug !== 'mullein-drops-gummies-capsules-tea' && p.slug !== 'does-mullein-work') expect(html(p)).toContain(QUIT_LINE);
  });
  it('with no affiliate links live, no page carries the commission notice (owner, 2026-10-21)', () => {
    for (const p of guidePages({ affiliateLinksLive: false })) expect(html(p)).not.toContain(COMMISSION_LINE);
  });
  it('the live site matches the switch, and today the switch is off', () => {
    expect(AFFILIATE_LINKS_LIVE).toBe(false);
    for (const p of GUIDE_PAGES) expect(html(p)).not.toContain(COMMISSION_LINE);
  });
  it('once affiliate links go live, the products page states the commission before anything else on it', () => {
    const p = guidePages({ affiliateLinksLive: true }).find((x) => x.slug === 'mullein-drops-gummies-capsules-tea')!;
    const first = p.blocks.find((b) => b.kind === 'text') as { html: string };
    expect(first.html.startsWith(`<p><em>${COMMISSION_LINE}</em></p>`)).toBe(true);
  });
  it('every page naming Blue Zones carries the non-affiliation line, and the brand is never ours', () => {
    for (const p of GUIDE_PAGES) if (/blue zones/i.test(text(html(p))) && p.slug !== 'home') expect(html(p)).toContain(NOT_AFFILIATED_BZ);
    expect(GUIDE_NAME).not.toMatch(/blue zone|power 9/i);
  });
  it('the Blue Zones habits grade as observational at best, and wine as no evidence of benefit', () => {
    const g = (id: string) => gradeClaim(BLUE_ZONES_CLAIMS.find((c) => c.id === id)!.evidence, BLUE_ZONES_STUDIES);
    for (const id of ['move', 'purpose', 'plants', 'eighty-percent', 'belong', 'social-ties', 'right-tribe']) expect(g(id)).toBe('early');
    expect(g('wine')).toBe('no_evidence');
  });
  it('the home stats are derived from the records, not typed', () => {
    const s = guideStats();
    expect(s.studies).toBeGreaterThan(10);
    expect(s.testedNoEffect).toBeGreaterThanOrEqual(3);
    const home = html(GUIDE_PAGES.find((p) => p.slug === 'home')!);
    expect(home).toContain(`>${s.studies}<`);
    expect(home).toContain(`>${s.claims}<`);
    expect(home).toContain(`>${s.testedNoEffect}<`);
  });
  it('the design pass borrows a look, not a brand: a light warm theme with our own accent', () => {
    expect(GUIDE_THEME.darkMode).toBe('light');
    expect(GUIDE_THEME.neutral).toBe('warm');
    expect(GUIDE_THEME.accentColor).not.toMatch(/^red-/);
    for (const p of GUIDE_PAGES) expect(text(html(p))).not.toMatch(/timeline\.com|time—line|doctor recommended|#1/i);
  });
  it('open experiments are never graded, never affiliate-linked, and say they are untested (HiveJournal, 2026-10-22)', () => {
    for (const slug of ['havn-hat', 'rife-tested']) {
      const p = GUIDE_PAGES.find((x) => x.slug === slug)!;
      expect(p.blocks.some((b) => b.kind === 'evidence')).toBe(false);
      expect(html(p)).toMatch(/data-experiment-status="untested"/);
      expect(html(p)).toMatch(/not verified by us/);
      expect(html(p)).not.toMatch(/havnwear\.com|amazon\.|[?&](ref|aff|tag|utm_)[a-z_]*=/i);
    }
    // The maker's claim is quoted and attributed; outside the quotation the page asserts nothing.
    const unquoted = text(html(GUIDE_PAGES.find((x) => x.slug === 'havn-hat')!)).replace(/“[^”]*”/g, '');
    expect(unquoted).not.toMatch(/\b(the hat|the havn hat|havn) (works|improves|protects|blocks)\b/i);
    expect(text(html(GUIDE_PAGES.find((x) => x.slug === 'rife-tested')!))).toMatch(/never on a person/i);
  });
  it('the Rife history: every row has a status and a source, and no row asserts a cure', () => {
    expect(RIFE_HISTORY.length).toBeGreaterThan(10);
    for (const r of RIFE_HISTORY) {
      expect(['documented', 'claimed', 'contradicted']).toContain(r.status);
      expect(r.source.length).toBeGreaterThan(5);
    }
    const p = GUIDE_PAGES.find((x) => x.slug === 'rife-history')!;
    const t = text(html(p)).replace(/“[^”]*”/g, '');
    expect(t).not.toMatch(/\b(rife|the device|the machine|frequencies?) (cured|cures|kills|destroys)\b/i);
    expect(html(p)).toMatch(/talk to an oncologist/);
    expect(html(p)).toContain('data-history-status="claimed"');
    expect(html(p)).toContain('data-history-status="contradicted"');
  });
  it('urolithin A: the grades the trials produce, nulls included', () => {
    const g = (id: string) => gradeClaim(UROLITHIN_A_CLAIMS.find((c) => c.id === id)!.evidence, UROLITHIN_A_STUDIES);
    expect(g('endurance')).toBe('early'); // secondary outcomes only
    expect(g('strength')).toBe('early');
    expect(g('walking')).toBe('tested_no_effect'); // a blinded primary null outranks a secondary positive
    expect(g('power')).toBe('tested_no_effect');
    expect(g('blood-vessels')).toBe('tested_no_effect');
    expect(g('immune')).toBe('promising'); // one blinded trial, primary biomarker outcome
  });
  it('the log page invents no reading, and says what it cannot show', () => {
    const p = GUIDE_PAGES.find((x) => x.slug === 'my-urolithin-a-log')!;
    expect(html(p)).toMatch(/No readings yet/);
    expect(html(p)).toMatch(/a log, not evidence/);
    expect(text(html(p))).not.toMatch(/\b\d+\s*(reps|repetitions)\b/i);
  });
  it('the urolithin A page names who paid for the trials', () => {
    expect(html(GUIDE_PAGES.find((x) => x.slug === 'urolithin-a')!)).toMatch(/paid for by the maker/);
  });
  it('habits with no study entered are listed as not yet graded, never graded "no evidence"', () => {
    const p = GUIDE_PAGES.find((x) => x.slug === 'blue-zones-habits-graded')!;
    expect(html(p)).toMatch(/Not yet graded/);
    expect(BLUE_ZONES_CLAIMS.every((c) => c.evidence.length > 0)).toBe(true);
  });
  it('the study page never says it is open until it is', () => {
    const p = GUIDE_PAGES.find((x) => x.slug === 'mullein-study')!;
    expect(html(p)).toMatch(/The study is not open yet/);
    expect(text(html(p))).not.toMatch(/\b(sign up now|join now|enroll now|enrol now)\b/i);
  });
});
