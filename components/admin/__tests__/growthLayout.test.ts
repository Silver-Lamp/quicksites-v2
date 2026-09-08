/**
 * @jest-environment node
 */
// The prospects tab's shape, pinned so it cannot silently grow back into the thirteen-panel stack
// it was on 2026-09-08. Source guards: what a unit test cannot see, reading the file can.
import { readFileSync } from 'node:fs';
import { STEP_SECTION } from '../prospects-client';

const client = readFileSync('components/admin/prospects-client.tsx', 'utf8');
const queue = readFileSync('components/admin/trade-pipeline-queue.tsx', 'utf8');
const growthPage = readFileSync('app/admin/growth/page.tsx', 'utf8');
const costsPage = readFileSync('app/admin/domains/costs/page.tsx', 'utf8');
const coach = readFileSync('lib/prospects/growthCoach.ts', 'utf8');

describe('1. the Growth Coach is the spine', () => {
  it('every step key the coach can emit (other than discover) maps to a section that opens', () => {
    const keys = new Set([...coach.matchAll(/key: '([a-z_]+)'/g)].map((m) => m[1]));
    expect(keys.size).toBeGreaterThan(5);
    for (const k of keys) {
      if (k === 'discover') continue; // the sweep form is always visible
      expect(STEP_SECTION[k]).toBeDefined();
    }
  });
  it('only OPENS the active step\'s section — never force-closes one the operator opened', () => {
    expect(client).toMatch(/openSection\(target\.section\)/);
    expect(client).not.toMatch(/closeSection\(/);
  });
});

describe('2. one form names a city', () => {
  it('the sweep form has both exits', () => {
    expect(client).toMatch(/Queue for tonight/);
    expect(client).toMatch(/onClick=\{discover\}/);
  });
  it('the pipeline panel no longer carries its own city/state inputs', () => {
    expect(queue).not.toMatch(/placeholder="Arab"/);
    expect(queue).not.toMatch(/placeholder="AL"/);
    expect(queue).toMatch(/Whole metro/);
  });
  it('the queue panel renders under the sweep form, not above the page title', () => {
    expect(growthPage).toMatch(/afterDiscover=\{<TradePipelineQueue \/>\}/);
    expect(growthPage).not.toMatch(/<TradePipelineQueue \/>\s*<ProspectsClient/);
  });
  it('queuing from the form refreshes the panel', () => {
    expect(client).toMatch(/qs:sweep-queue:changed/);
    expect(queue).toMatch(/SWEEP_QUEUE_CHANGED = 'qs:sweep-queue:changed'/);
  });
});

describe('3. domain money lives on Domain Costs, not on the prospecting page', () => {
  for (const mod of ['domain-buy-list-planner', 'domain-cost-summary', 'parks-prewarm-panel']) {
    it(`prospects-client does not import ${mod}`, () => {
      expect(client).not.toMatch(new RegExp(`from '@/components/admin/${mod}'`));
    });
  }
  it('the costs page hosts the planner and the park registry', () => {
    expect(costsPage).toMatch(/<DomainBuyListPlanner \/>/);
    expect(costsPage).toMatch(/<ParksPrewarmPanel \/>/);
  });
});

describe('4. clusters and restaurant contests are views of the campaigns section', () => {
  it('one section, three chips', () => {
    expect(client).toMatch(/campaignsView === 'clusters' && renderClusterCards\(\)/);
    expect(client).toMatch(/campaignsView === 'restaurants' && renderRestaurantCards\(\)/);
    // The old standalone headings are gone.
    expect(client).not.toMatch(/Competition cards — grab the domain/);
    expect(client).not.toMatch(/Restaurant competitions — one domain, one winner/);
  });
  it('the coach still lands on the cards (ids kept) after opening the section and picking the chip', () => {
    expect(client).toMatch(/id="competition-cards"/);
    expect(client).toMatch(/id="restaurant-competition-cards"/);
    expect(client).toMatch(/case 'launch-geo':[\s\S]*?openSection\('geo-campaigns'\);[\s\S]*?setCampaignsView\('clusters'\)/);
  });
  it('the header keeps only the sender profile; maintenance is a drawer', () => {
    expect(client).toMatch(/<summary[^>]*>🛠 Maintenance/);
  });
});

describe('5. the spend button is inside the panel it spends for', () => {
  it('"Run now" is not on the collapsed header', () => {
    const header = queue.slice(0, queue.indexOf('{open && state && ('));
    expect(header).not.toMatch(/onClick=\{runNow\}/);
    const body = queue.slice(queue.indexOf('{open && state && ('));
    expect(body).toMatch(/onClick=\{runNow\}/);
  });
  it('and says it spends', () => {
    expect(queue).toMatch(/spends Places API calls/);
  });
});
