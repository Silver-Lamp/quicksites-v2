/**
 * @jest-environment node
 */
import { localCompetitionAbove, readOverviewLocalBlock } from '@/lib/serp/aiOverviewLocal';

const overview = (markdowns: string[]) => ({
  tasks: [{ result: [{ items: [
    { type: 'ai_overview', asynchronous_ai_overview: true,
      items: markdowns.map((markdown, position) => ({ type: 'ai_overview_element', position, markdown })) },
    { type: 'organic', domain: 'example.com' },
  ] }] }],
});

// The real markdown from `horse barn builder austin`, 2026-09-25.
const REAL = `--- |  | ![](https://lh3.googleusercontent.com/x=s192) | Texas Pole Barns 4.6 (18)   | Construction company   | Open 11519 Pecan Creek Pkwy #23   | Call Directions Website |  | - **Address:** 11519 Pecan Creek Pkwy #23, Austin, TX 78750`;

describe('reading the block a hand check photographed', () => {
  it('finds it, and pulls the business out with its review count', () => {
    const b = readOverviewLocalBlock(overview([REAL]));
    expect(b.present).toBe(true);
    expect(b.businesses[0]).toEqual({ name: 'Texas Pole Barns', rating: 4.6, reviews: 18 });
  });

  it('pulls several businesses when the block lists several', () => {
    const b = readOverviewLocalBlock(
      overview([REAL, '| Barns Across Texas 4.6 (11) | Construction company | Call Directions Website |'])
    );
    expect(b.businesses.map((x) => x.name)).toEqual(['Texas Pole Barns', 'Barns Across Texas']);
    expect(b.businesses.map((x) => x.reviews)).toEqual([18, 11]);
  });

  it('does not double-count a business named twice', () => {
    const b = readOverviewLocalBlock(overview([REAL, REAL]));
    expect(b.businesses).toHaveLength(1);
  });
});

describe('what must NOT fire, because the first attempt fired on everything', () => {
  // ⚠️ The first detector matched a "local" title and hit "Local Context & Regulations" — a section
  // about zoning. Editorial prose about a place is not a business listing.
  it('ignores an overview that only discusses local matters', () => {
    const b = readOverviewLocalBlock(
      overview(['## Local Context & Regulations\nAustin requires a permit for structures over 120 sq ft.'])
    );
    expect(b.present).toBe(false);
  });

  // ⚠️ A bare "Call" is ordinary prose. Requiring Call NEXT TO Directions/Website is what separates
  // a rendered Business Profile from a sentence.
  it('ignores "call for a quote" in running text', () => {
    const b = readOverviewLocalBlock(
      overview(['Most builders will quote by the stall. Call for a quote and ask about delivery.'])
    );
    expect(b.present).toBe(false);
  });

  it('ignores a comparison table with no action buttons', () => {
    const b = readOverviewLocalBlock(
      overview(['| Builder | Material | | **Texas Pole Barns** | Wood | | **Dayton Barns** | Steel |'])
    );
    expect(b.present).toBe(false);
  });
});

describe('the verdict it feeds', () => {
  it('says true when the block is there', () => {
    expect(localCompetitionAbove({ packSize: 0, raw: overview([REAL]) })).toBe(true);
  });

  it('says false for an overview with no block', () => {
    expect(localCompetitionAbove({ packSize: 0, raw: overview(['Just prose about barns.']) })).toBe(false);
  });

  // ⚠️ null is "we could not tell". Reading it as "no competition" is the bug that put horse barns
  // at the top of the table for a day.
  it('says unknown when the overview was never fetched', () => {
    const blind = { tasks: [{ result: [{ items: [{ type: 'ai_overview', items: null, markdown: null }] }] }] };
    expect(localCompetitionAbove({ packSize: 0, raw: blind })).toBeNull();
  });

  it('never lets an overview override a pack that was actually found', () => {
    expect(localCompetitionAbove({ packSize: 3, raw: overview(['prose']) })).toBe(true);
  });

  it.each([null, undefined, {}, { tasks: [] }])('survives a malformed payload: %p', (bad) => {
    expect(readOverviewLocalBlock(bad).present).toBe(false);
  });
});
