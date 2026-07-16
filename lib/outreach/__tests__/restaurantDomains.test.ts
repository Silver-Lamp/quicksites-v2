// lib/outreach/__tests__/restaurantDomains.test.ts
//
// The Restaurant Location Domains assembly: campaigns/owned apexes/free cities become
// area cards; cohort vs candidates bucket correctly; funnel links are tracked inside a
// contest and direct-claim outside; owned-domain city parsing.

import {
  assembleRestaurantDomainAreas,
  cityFromRestaurantDomain,
  isRestaurantLocationDomain,
  type LinkBuilders,
} from '../restaurantDomains';

const links: LinkBuilders = {
  tracked: (c, p) => `tracked:${c}:${p}`,
  claim: (t) => `claim:${t}`,
  site: (slug, custom, published) =>
    published ? (custom ? `https://${custom}` : `https://${slug}.delivered.menu`) : `/sites/${slug}`,
};

const prospect = (over: any) => ({
  id: 'p',
  business_name: 'Biz',
  phone: null,
  address: null,
  city: 'Boston',
  region: 'MA',
  lead_tier: 'no_website',
  status: 'discovered',
  template_id: null,
  geo_campaign_id: null,
  waitlist_status: null,
  ...over,
});

describe('cityFromRestaurantDomain / isRestaurantLocationDomain', () => {
  it('parses <city>-restaurant.com labels (multi-word cities too)', () => {
    expect(cityFromRestaurantDomain('boston-restaurant.com')).toBe('Boston');
    expect(cityFromRestaurantDomain('coeur-d-alene-restaurant.com')).toBe('Coeur D Alene');
    expect(cityFromRestaurantDomain('boston-towing.com')).toBeNull();
    expect(isRestaurantLocationDomain('salem-restaurants.com')).toBe(true);
    expect(isRestaurantLocationDomain('quicksites.ai')).toBe(false);
  });
});

describe('assembleRestaurantDomainAreas', () => {
  it('buckets a contest area: cohort with tracked links, free candidates with claim/none', () => {
    const out = assembleRestaurantDomainAreas({
      campaigns: [
        {
          id: 'camp1',
          kind: 'restaurant_competition',
          city: 'Boston',
          region: 'MA',
          domain: 'boston-restaurant.com',
          slug: 'boston-restaurant',
          domain_status: 'attached',
          status: 'live',
          claimed_by_prospect_id: null,
        },
      ],
      prospects: [
        prospect({ id: 'a', business_name: 'In Contest', status: 'draft_built', template_id: 't1', geo_campaign_id: 'camp1' }),
        prospect({ id: 'b', business_name: 'Built Free', status: 'draft_built', template_id: 't2' }),
        prospect({ id: 'c', business_name: 'Unbuilt Free' }),
        prospect({ id: 'd', business_name: 'Dismissed', status: 'dismissed' }),
        prospect({ id: 'e', business_name: 'Has Site', lead_tier: 'has_site' }),
      ],
      templates: [
        { id: 't1', slug: 'in-contest', published: true, custom_domain: null },
        { id: 't2', slug: 'built-free', published: false, custom_domain: 'builtfree.com' },
      ],
      ownedDomains: [],
      links,
    });

    expect(out.areas).toHaveLength(1);
    const area = out.areas[0];
    expect(area.campaign_id).toBe('camp1');
    expect(area.directory_url).toBe('https://boston-restaurant.com');
    expect(area.domain_owned).toBe(true);

    expect(area.competitors.map((r) => r.id)).toEqual(['a']);
    expect(area.competitors[0].claim_url).toBe('tracked:camp1:a'); // in-contest → tracked funnel link
    expect(area.competitors[0].site_url).toBe('https://in-contest.delivered.menu');

    // free pool: built + unbuilt no-website only (dismissed + has_site excluded)
    expect(area.candidates.map((r) => r.id)).toEqual(['b', 'c']); // built floats above unbuilt
    expect(area.candidates[0].claim_url).toBe('claim:t2'); // built, no contest → direct claim
    expect(area.candidates[0].site_url).toBe('/sites/built-free'); // draft → same-host admin view (custom domain applies once published)
    expect(area.candidates[1].claim_url).toBeNull(); // unbuilt → no funnel link yet

    expect(out.totals).toMatchObject({ contests: 1, restaurants_competing: 1, restaurants_available: 2 });
  });

  it('marks the winner and surfaces owned apexes + derived cities without contests', () => {
    const out = assembleRestaurantDomainAreas({
      campaigns: [
        {
          id: 'camp1',
          kind: 'restaurant_competition',
          city: 'Boston',
          region: 'MA',
          domain: 'boston-restaurant.com',
          slug: 'boston-restaurant',
          domain_status: 'attached',
          status: 'claimed',
          claimed_by_prospect_id: 'w',
        },
      ],
      prospects: [
        prospect({ id: 'w', business_name: 'Winner', status: 'claimed', template_id: 't1', geo_campaign_id: 'camp1' }),
        prospect({ id: 'x', business_name: 'Runner Up', status: 'draft_built', template_id: 't2', geo_campaign_id: 'camp1', waitlist_status: 'passed' }),
        prospect({ id: 's', business_name: 'Salem Spot', city: 'Salem', region: 'OR' }),
        prospect({ id: 'p', business_name: 'Portland Pie', city: 'Portland', region: 'OR' }),
      ],
      templates: [
        { id: 't1', slug: 'winner', published: true, custom_domain: null },
        { id: 't2', slug: 'runner-up', published: false, custom_domain: null },
      ],
      ownedDomains: ['Salem-Restaurant.com'], // owned but no contest yet (case-insensitive)
      links,
    });

    // Order: live contests → decided → owned apex → derived city.
    expect(out.areas.map((a) => a.key)).toEqual(['campaign:camp1', 'owned:salem-restaurant.com', 'city:portland']);

    const contest = out.areas[0];
    expect(contest.has_winner).toBe(true);
    expect(contest.winner_name).toBe('Winner');
    expect(contest.competitors[0].id).toBe('w'); // winner sorts first
    expect(contest.competitors[0].is_winner).toBe(true);
    expect(contest.competitors[1].waitlist_status).toBe('passed');

    const owned = out.areas[1];
    expect(owned.city).toBe('Salem');
    expect(owned.domain_owned).toBe(true);
    expect(owned.campaign_id).toBeNull();
    expect(owned.candidates.map((r) => r.id)).toEqual(['s']);

    const derived = out.areas[2];
    expect(derived.domain).toBe('portland-restaurant.com'); // geoDomainFor derived
    expect(derived.domain_owned).toBe(false);

    expect(out.totals).toMatchObject({ domains_owned: 2, contests: 1, contests_decided: 1 });
  });

  it('recognizes a legacy rent-model (geo_services) restaurant campaign without counting it as a contest', () => {
    const out = assembleRestaurantDomainAreas({
      campaigns: [
        {
          id: 'svc1',
          kind: 'geo_services', // launched from the services competition cards
          city: 'Renton',
          region: 'WA',
          domain: 'renton-restaurant.com',
          slug: 'renton-restaurant',
          domain_status: 'attached',
          status: 'live',
          claimed_by_prospect_id: null,
        },
      ],
      prospects: [
        prospect({ id: 'r1', business_name: 'Linked A', city: 'Renton', region: 'WA', status: 'draft_built', template_id: 't1', geo_campaign_id: 'svc1' }),
        prospect({ id: 'r2', business_name: 'Linked B', city: 'Renton', region: 'WA', geo_campaign_id: 'svc1' }),
        prospect({ id: 'r3', business_name: 'Free Agent', city: 'Renton', region: 'WA' }),
      ],
      templates: [{ id: 't1', slug: 'linked-a', published: false, custom_domain: null }],
      ownedDomains: [],
      links,
    });

    expect(out.areas).toHaveLength(1);
    const area = out.areas[0];
    expect(area.campaign_id).toBe('svc1');
    expect(area.campaign_kind).toBe('geo_services'); // page badges + offers "convert to claim contest"
    expect(area.domain_owned).toBe(true);
    expect(area.competitors.map((r) => r.id)).toEqual(['r1', 'r2']); // linked cohort recognized
    expect(area.candidates.map((r) => r.id)).toEqual(['r3']);
    // Not a contest until converted.
    expect(out.totals).toMatchObject({ domains_owned: 1, contests: 0, contests_decided: 0 });
  });
});
