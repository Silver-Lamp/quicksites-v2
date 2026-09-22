/**
 * @jest-environment node
 */
import { buildHubSite, buildStateSite, stateSubtitle } from '@/lib/treehouseBuilders/buildHubSite';
import { TREEHOUSE_BUILDERS } from '@/lib/treehouseBuilders/builders';

const hub = buildHubSite({ domain: 'customtreehousebuilders.com' });
const nc = buildStateSite({ state: 'North Carolina', stateCode: 'NC', domain: 'northcarolinatreehousebuilders.com' });
const blocks = (site: any) => site.data.pages[0].blocks;
const dir = (site: any) => blocks(site).find((b: any) => b.type === 'builders_directory');
const text = (site: any) => JSON.stringify(site.data).toLowerCase();

describe('it is a directory, never a business', () => {
  it('has the directory shape and no services', () => {
    expect(blocks(hub).map((b: any) => b.type)).toEqual(['hero', 'treehouse_planner', 'builders_directory', 'faq', 'contact_form']);
    expect(hub.data.services).toBeUndefined();
  });

  it('never speaks in a builder’s voice IN OUR OWN WORDS', () => {
    // A builder's first person is fine when it is quoted and attributed — Treehouse Experts'
    // "we build all over North America" is their sentence, shown as theirs, which is the honest
    // form rather than a violation. So strip the attributed quotes first; whatever first person
    // survives is the PAGE speaking as a business, which is the thing that must never happen.
    for (const site of [hub, nc]) {
      const ours = text(site).replace(/they say they work: “[^”]*”/g, '');
      for (const phrase of ['welcome to', 'our team', 'we build', 'free quote', 'call us today', 'years of experience']) {
        expect(ours).not.toContain(phrase);
      }
    }
  });

  it('⚠️ makes no safety, licensing or insurance claim — children climb into these', () => {
    for (const site of [hub, nc]) {
      expect(text(site)).not.toMatch(/\b(licensed|insured|bonded|certified|guaranteed|safety[- ]tested)\b/);
    }
  });
});

describe('every entry carries its source', () => {
  it('lists every builder, each with a source url', () => {
    const entries = dir(hub).content.entries;
    expect(entries).toHaveLength(TREEHOUSE_BUILDERS.length);
    for (const e of entries) expect(e.source_url).toMatch(/^https?:\/\//);
  });

  it('marks entries we have not confirmed with the company', () => {
    const unconfirmed = dir(hub).content.entries.filter((e: any) =>
      e.kinds.includes('Listing not yet confirmed with them'),
    );
    expect(unconfirmed.length).toBeGreaterThan(0);
  });

  it('attributes a service-area claim to the company instead of asserting it', () => {
    const experts = dir(hub).content.entries.find((e: any) => e.name === 'Treehouse Experts');
    expect(experts.summary).toContain('They say they work:');
    expect(experts.summary).toContain('North Carolina');
  });

  it('is alphabetical and says so', () => {
    const names = dir(hub).content.entries.map((e: any) => e.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
    expect(dir(hub).content.subtitle).toContain('no paid placement');
  });
});

describe('the state page never implies a local builder it does not have', () => {
  it('⚠️ resolves by CODE — the name alone silently matched nothing', () => {
    // The bug this pins: stateSubtitle('Tennessee') with no code compared "TENNESSEE" to "TN"
    // and every state page claimed no builders, coverage notwithstanding.
    expect(stateSubtitle('North Carolina', 'NC')).not.toMatch(/have not found/);
    expect(stateSubtitle('Washington', 'WA')).toMatch(/2 builders are based in Washington/);
  });

  it('says plainly when builders ARE based there', () => {
    expect(stateSubtitle('North Carolina', 'NC')).toMatch(/based in North Carolina/);
  });

  it('says plainly when NOBODY is based there', () => {
    // Tennessee: one travelling firm names it, nobody is based there. The page must lead with
    // the absence, not bury it.
    const sub = stateSubtitle('Tennessee', 'TN');
    expect(sub).toMatch(/^No treehouse builder we found is based in Tennessee/);
  });

  it('handles a state with no coverage at all without inventing one', () => {
    const sub = stateSubtitle('Nebraska', 'NE');
    expect(sub).toMatch(/have not found/);
    expect(sub).toMatch(/travel/);
  });

  it('a state page carries only that state’s builders', () => {
    const names = dir(nc).content.entries.map((e: any) => e.name);
    expect(names).toContain('Creative Treehouse Design');
    expect(names).toContain('Treehouse Experts');
    expect(names).not.toContain('Nelson Treehouse');
  });
});

describe('the planner is on the hub, and only there', () => {
  it('the hub carries it and the hero points at it', () => {
    expect(blocks(hub).map((b: any) => b.type)).toContain('treehouse_planner');
    expect(blocks(hub)[0].content.cta_link).toBe('#planner');
  });

  it('a state page does not \u2014 one planner, on the page people research from', () => {
    expect(blocks(nc).map((b: any) => b.type)).not.toContain('treehouse_planner');
  });
});

describe('cost answers are attributed, never stated as a market rate', () => {
  it('names whose prices those are and when they were read', () => {
    const faq = blocks(hub).find((b: any) => b.type === 'faq');
    const cost = faq.content.items.find((i: any) => /cost/i.test(i.question));
    expect(cost.answer).toContain('Treehouse Experts');
    expect(cost.answer).toMatch(/read September 2026/);
    expect(cost.answer).toMatch(/not a market rate/);
  });
});
