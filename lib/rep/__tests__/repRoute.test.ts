/**
 * @jest-environment node
 */
// A rep's "plan today's stops" link: only the restaurants worth walking into, coordinates
// before addresses, the planner's own cap, and no link at all when there is nothing to order.
import { restaurantsRouteUrl, routableStops, ROUTE_MAX_STOPS } from '@/lib/rep/repRoute';
import type { RestaurantTableRow } from '@/components/for-rep/restaurant-table';

const row = (over: Partial<RestaurantTableRow>): RestaurantTableRow =>
  ({
    textedAt: null, dmAt: null, cardLine: null, prospectId: 'p', businessName: 'Cafe Uno', phone: null, websiteHost: 'uno.example',
    platformLabel: '', group: 'call', rating: null, reviewCount: null, previewUrl: null, claimUrl: null, evolveUrl: null,
    address: null, lat: null, lon: null,
    ...over,
  }) as RestaurantTableRow;

describe('routableStops', () => {
  it('uses coordinates when the sweep stored them, else the address, and skips rows with neither', () => {
    expect(routableStops([row({ lat: 53.48, lon: -2.24 }), row({ businessName: 'Due', address: '12 Deansgate, Manchester' }), row({ businessName: 'Tre' })])).toEqual([
      'Cafe Uno @53.48,-2.24',
      'Due, 12 Deansgate, Manchester',
    ]);
  });
  it('visits only call / shop / third-party rows, never site-only or leave-alone', () => {
    expect(routableStops([row({ group: 'siteOnly', address: 'x' }), row({ group: 'leaveAlone', address: 'x' }), row({ group: 'shop', address: '1 High St' })])).toEqual(['Cafe Uno, 1 High St']);
  });
  it('strips the characters the planner uses as separators', () => {
    expect(routableStops([row({ businessName: 'A | B @ C', address: '1 St | 2' })])).toEqual(['A   B   C, 1 St   2']);
  });
  it('stops at the planner’s ceiling', () => {
    const rows = Array.from({ length: 30 }, (_, i) => row({ businessName: `R${i}`, address: `${i} St` }));
    expect(routableStops(rows)).toHaveLength(ROUTE_MAX_STOPS);
  });
});

describe('restaurantsRouteUrl', () => {
  it('needs at least two placeable stops', () => {
    expect(restaurantsRouteUrl([row({ address: '1 St' })])).toBeNull();
    expect(restaurantsRouteUrl([row({ address: '1 St' }), row({ businessName: 'B', address: '2 St' })])).toBe(
      `/tools/route-planner?stops=${encodeURIComponent('Cafe Uno, 1 St|B, 2 St')}`,
    );
  });
});
