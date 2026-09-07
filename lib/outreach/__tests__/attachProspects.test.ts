/**
 * @jest-environment node
 */
import { planAttachment, addressLooksLike } from '../attachProspects';

const p = (id: string, over: Record<string, unknown> = {}) => ({
  id, business_name: id, address: `1 Main St, Arab, AL 35016, USA`, geo_campaign_id: null, ...over,
});
const camp = { id: 'c-arab', city: 'Arab' };

describe('attaching never quietly steals from another cohort', () => {
  it('separates free prospects from ones already on another campaign', () => {
    // linkProspectsToCampaign overwrites geo_campaign_id unconditionally, so a prospect on
    // another city's campaign would be moved with nothing on screen saying so.
    const plan = planAttachment(
      [p('a'), p('b', { geo_campaign_id: 'c-other' }), p('c', { geo_campaign_id: 'c-arab' })],
      camp,
    );
    expect(plan.free.map((x) => x.id)).toEqual(['a']);
    expect(plan.elsewhere.map((x) => x.id)).toEqual(['b']);
    expect(plan.alreadyHere.map((x) => x.id)).toEqual(['c']);
  });

  it('treats re-attaching to the same campaign as a no-op, not an error', () => {
    const plan = planAttachment([p('c', { geo_campaign_id: 'c-arab' })], camp);
    expect(plan.free).toHaveLength(0);
    expect(plan.alreadyHere).toHaveLength(1);
  });
});

describe('the off-city warning, which is this workflow’s default mistake', () => {
  it('flags a business that is not in the campaign’s town', () => {
    // A real sweep for "towing service" near Arab returned businesses up to 40 miles out.
    const plan = planAttachment(
      [p('near'), p('far', { address: '204 Lonnie E Crawford Blvd, Scottsboro, AL 35769, USA' })],
      camp,
    );
    expect(plan.offCity.map((x) => x.id)).toEqual(['far']);
  });

  it('does not warn about prospects it would not attach anyway', () => {
    const plan = planAttachment(
      [p('here', { geo_campaign_id: 'c-arab', address: 'Somewhere Else, AL' })],
      camp,
    );
    expect(plan.offCity).toHaveLength(0);
  });

  it('warns rather than blocks — the caller decides', () => {
    const plan = planAttachment([p('far', { address: 'Cullman, AL' })], camp);
    expect(plan.free).toHaveLength(1); // still attachable
    expect(plan.offCity).toHaveLength(1); // and still flagged
  });
});

describe('address matching does not invent verdicts', () => {
  it('says nothing when the campaign has no city to compare against', () => {
    expect(addressLooksLike('anywhere', null)).toBe(true);
    expect(addressLooksLike('anywhere', '')).toBe(true);
  });

  it('treats an unreadable address as NOT matching rather than as fine', () => {
    // Fails toward the warning: a missing address is not evidence of being in town.
    expect(addressLooksLike(null, 'Arab')).toBe(false);
    expect(addressLooksLike('', 'Arab')).toBe(false);
  });

  it('is case-insensitive on the town', () => {
    expect(addressLooksLike('651 Sundown Dr NW, ARAB, AL', 'Arab')).toBe(true);
  });
});

describe('matchesCampaign — what "attach all" should actually mean', () => {
  const { matchesCampaign } = require('../attachProspects');
  const towingInArab = { industry_key: 'towing', address: '2317 N Brindlee Mountain Pkwy, Arab, AL 35016, USA' };
  const campaign = { industry_key: 'towing', city: 'Arab' };

  it('accepts the same trade in the same town', () => {
    expect(matchesCampaign(towingInArab, campaign)).toBe(true);
  });

  it('rejects a different trade, however local', () => {
    // Real rows from the Arab sweep: an auto-repair shop and a moving company were queued for
    // arab-towing.com by "attach all no-website".
    expect(matchesCampaign({ ...towingInArab, industry_key: 'auto_repair' }, campaign)).toBe(false);
    expect(matchesCampaign({ ...towingInArab, industry_key: 'moving' }, campaign)).toBe(false);
  });

  it('rejects the right trade in the wrong town', () => {
    expect(matchesCampaign({ industry_key: 'towing', address: 'Scottsboro, AL 35769, USA' }, campaign)).toBe(false);
  });

  it('rejects the thing that made this obvious — a vegan kitchen in another state', () => {
    expect(matchesCampaign({ industry_key: 'restaurant', address: 'Marrowdale, WA' }, campaign)).toBe(false);
  });

  it('does not filter on trade when the campaign has none to compare', () => {
    expect(matchesCampaign({ industry_key: 'anything', address: 'Arab, AL' }, { city: 'Arab' })).toBe(true);
  });

  it('rejects a prospect with no readable address rather than assuming it is local', () => {
    expect(matchesCampaign({ industry_key: 'towing', address: null }, campaign)).toBe(false);
  });
});
