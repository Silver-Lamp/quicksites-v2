import { isChain } from '@/lib/prospects/chains';

describe('isChain — a national chain is not a prospect for an ordering page', () => {
  it('matches the four that showed as "call first" in King County on 2026-10-11, by domain or name', () => {
    expect(isChain({ website: 'https://locations.jackinthebox.com/us/wa/renton/123', businessName: 'Jack in the Box' })).toBe(true);
    expect(isChain({ website: 'https://www.starbucks.com/store-locator/store/1', businessName: 'Starbucks Coffee Company' })).toBe(true);
    expect(isChain({ website: 'https://locations.papajohns.com/united-states/wa/98058/renton', businessName: 'Papa Johns Pizza' })).toBe(true);
    expect(isChain({ website: 'https://www.jerseymikes.com/12345/renton-wa', businessName: "Jersey Mike's Subs" })).toBe(true);
  });
  it('matches on the name alone when the website is a third-party page', () => {
    expect(isChain({ website: 'https://order.toasttab.com/online/x', businessName: 'Subway' })).toBe(true);
  });
  it('leaves an independent alone, including one whose name merely contains a chain word', () => {
    expect(isChain({ website: 'https://pizzarockisland.com', businessName: 'The Rock Island Pizza' })).toBe(false);
    expect(isChain({ website: 'https://jayberryscafe.com', businessName: "Jay Berry's Cafe" })).toBe(false);
    expect(isChain({ website: 'https://noriprestoteriyaki.menu11.com', businessName: 'Nori Presto Teriyaki' })).toBe(false);
    expect(isChain({ website: null, businessName: 'Subway Deli & Grocery of Vashon' })).toBe(true); // starts with the chain word — flagged, a person can override
    expect(isChain({ website: 'https://dennysdiner-vashon.com', businessName: "Denny's Diner Vashon" })).toBe(true);
    expect(isChain({ website: 'https://example.com', businessName: 'Kentucky Fried Pickles' })).toBe(false);
  });
});
