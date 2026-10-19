/**
 * @jest-environment node
 */
// lib/ppl/__tests__/corpus.test.ts — the /admin/ppl corpus section is derived, never remembered.
import { summariseCorpus, type CorpusCall, type CorpusCampaign } from '@/lib/ppl/corpus';

const now = Date.parse('2026-10-17T03:00:00Z');
const day = 86_400_000;
const iso = (daysAgo: number) => new Date(now - daysAgo * day).toISOString();

const camps: CorpusCampaign[] = [
  { id: 'rich', domain: 'richland-towing.com', city: 'Richland', industry_key: 'towing', rank_status: 'page1', rank_position: 8.9, tracking_number: '+15097745284', forward_to: '+15095829414', forward_to_name: "Ken's Auto Rescue", domain_status: 'attached', created_at: iso(19) },
  { id: 'vash', domain: 'vashon-roofing.com', city: 'Vashon', industry_key: 'roofing', rank_status: 'ranking', rank_position: 73.9, tracking_number: '+12065550100', forward_to: '+12065550101', forward_to_name: 'Celtic Construction', domain_status: 'attached', created_at: iso(8) },
  { id: 'rent', domain: 'renton-towing.com', city: 'Renton', industry_key: 'towing', rank_status: 'ranking', rank_position: 57.8, tracking_number: '+12533568119', forward_to: '+12532170639', forward_to_name: 'V’Z Towing', domain_status: 'attached', created_at: iso(95) },
  { id: 'ash', domain: 'ashland-city-towing.com', city: 'Ashland City', industry_key: 'towing', rank_status: 'page1', rank_position: 1.3, tracking_number: null, forward_to: null, forward_to_name: null, domain_status: 'registered', created_at: iso(60) },
  { id: 'lynnr', domain: 'lynn-ranking.com', city: 'Lynn', industry_key: 'towing', rank_status: 'ranking', rank_position: 14.6, tracking_number: null, forward_to: null, forward_to_name: null, domain_status: 'registered', created_at: iso(60) },
  { id: 'dome', domain: 'utahdomebuilders.com', city: 'Utah', industry_key: 'dome_builder', rank_status: 'page1', rank_position: 4.2, tracking_number: null, forward_to: null, forward_to_name: null, domain_status: 'registered', created_at: iso(30) },
  { id: 'old', domain: 'old-towing.com', city: 'X', industry_key: 'towing', rank_status: 'unranked', rank_position: null, tracking_number: '+12065550199', forward_to: null, forward_to_name: null, domain_status: 'attached', created_at: iso(300) },
];
const call = (p: Partial<CorpusCall> & { geo_campaign_id: string; created_at: string }): CorpusCall => ({ from_number: '+12060000000', forwarded_to: null, handling: 'forward', call_status: 'dial-completed', call_duration: 30, recording_url: null, voicemail_speech: null, voicemail_verdict: null, read: null, ...p });

const calls: CorpusCall[] = [
  call({ geo_campaign_id: 'rich', created_at: iso(0), from_number: '+12064273065', call_duration: 159, read: 'customer' }),
  call({ geo_campaign_id: 'rent', created_at: iso(1), from_number: '+12533451344', call_duration: 30, read: 'customer' }),
  // V'Z ringing itself — own business, never a dial against the destination
  call({ geo_campaign_id: 'rent', created_at: iso(1), from_number: '+12532170639', forwarded_to: '+12532170639', call_status: 'dial-no-answer', call_duration: null, read: 'own_business' }),
  call({ geo_campaign_id: 'vash', created_at: iso(2), call_status: 'dial-no-answer', call_duration: null, read: 'vendor_or_sales' }),
  call({ geo_campaign_id: 'vash', created_at: iso(3), call_status: 'dial-no-answer', call_duration: null, read: 'robocall' }),
  call({ geo_campaign_id: 'vash', created_at: iso(4), call_status: 'dial-no-answer', call_duration: null, read: 'vendor_or_sales' }),
  call({ geo_campaign_id: 'vash', created_at: iso(5), call_duration: 20, recording_url: null, read: 'unknown' }),
  call({ geo_campaign_id: 'rich', created_at: iso(40), call_status: 'dial-completed', call_duration: 200, read: 'customer' }), // outside the window
  call({ geo_campaign_id: 'rich', created_at: iso(6), handling: 'voicemail_first', call_status: 'ringing', call_duration: null, recording_url: 'https://x/r', voicemail_speech: 'no_speech' }),
];

describe('summariseCorpus', () => {
  const s = summariseCorpus({ campaigns: camps, calls, gsc: [{ domain: 'https://www.richland-towing.com/', end_date: '2026-10-12', impressions: 9000, clicks: 900 }, { domain: 'https://www.richland-towing.com/', end_date: '2026-10-13', impressions: 2000, clicks: 100 }, { domain: 'richland-towing.com', end_date: '2026-10-13', impressions: 247, clicks: 0 }, { domain: 'sc-domain:ashland-city-towing.com', end_date: '2026-10-13', impressions: 4, clicks: 0 }, { domain: 'sc-domain:lynn-ranking.com', end_date: '2026-10-13', impressions: 12, clicks: 1 }], nowMs: now });
  it('30-day outcomes count the window only; the all-time table counts everything', () => {
    expect(s.outcomes30d).toMatchObject({ calls: 8, leads90: 1, answered15to89: 2, unanswered: 4, voicemails: 1, voicemailNoSpeech: 1 });
    expect(s.outcomesAll.leads90).toBe(2);
  });
  it('AI reads: customer share from analysed calls', () => {
    expect(s.reads.find((r) => r.read === 'customer')).toEqual({ read: 'customer', count: 3, leads90: 2 });
    expect(s.customerShare).toBeCloseTo(3 / 8, 5);
  });
  it('a line row: GSC = the LATEST capture only, matched across URL spellings; own-number calls excluded from dials; answer rate', () => {
    const rich = s.lines.find((l) => l.domain === 'richland-towing.com')!;
    expect(rich.impressions28d).toBe(2247);
    expect(rich.clicks28d).toBe(100);
    expect(rich.leads90).toBe(2);
    const rent = s.lines.find((l) => l.domain === 'renton-towing.com')!;
    expect(rent.dials).toBe(1);
    expect(rent.ownOrTest).toBe(1);
    const vash = s.lines.find((l) => l.domain === 'vashon-roofing.com')!;
    expect(vash.dials).toBe(4);
    expect(vash.answerRate).toBeCloseTo(0.25, 5);
    expect(s.lines.find((l) => l.domain === 'old-towing.com')!.dials).toBe(0); // a numbered line with no calls still shows
  });
  it('recommendations are derived: pitch on evidence, non-answerers, noise lines, ranked supply without a number (never a directory)', () => {
    expect(s.pitchNow.map((l) => l.domain)).toEqual(['richland-towing.com']);
    expect(s.nonAnswerers.map((l) => l.domain)).toEqual([]);
    expect(s.noiseLines.map((l) => l.domain)).toEqual(['vashon-roofing.com']);
    // demand, not rank: ashland (page 1, 4 impressions) is NOT supply; a ranking domain with 12 is
    expect(s.supply.demandWithoutNumber.map((r) => r.domain)).toEqual(['lynn-ranking.com']);
    // No prospects passed → nobody swept → not READY, however many impressions.
    expect(s.supply.demandWithoutNumber[0].forwardCandidates).toBe(0);
    // A swept no-website tow in Lynn makes it ready; a different trade or city does not; an island
    // campaign counts its towns (a Clinton electrician is a candidate for "Whidbey Island").
    const withProspects = summariseCorpus({
      campaigns: [...camps, { id: 'wi', domain: 'whidbey-island-electrician.com', city: 'Whidbey Island', region: 'WA', industry_key: 'electrical', rank_status: 'ranking', rank_position: 30, tracking_number: null, forward_to: null, forward_to_name: null, domain_status: 'registered', created_at: iso(10) }],
      calls,
      gsc: [{ domain: 'sc-domain:lynn-ranking.com', end_date: '2026-10-13', impressions: 12, clicks: 1 }, { domain: 'sc-domain:whidbey-island-electrician.com', end_date: '2026-10-13', impressions: 9, clicks: 0 }],
      prospects: [{ city: 'Lynn', region: 'MA', industry_key: 'towing' }, { city: 'Lynn', region: 'MA', industry_key: 'plumbing' }, { city: 'Saugus', region: 'MA', industry_key: 'towing' }, { city: 'Clinton', region: 'WA', industry_key: 'electrical' }, { city: 'Mukilteo', region: 'WA', industry_key: 'electrical' }],
      nowMs: now,
    });
    const byDomain = Object.fromEntries(withProspects.supply.demandWithoutNumber.map((r) => [r.domain, r.forwardCandidates]));
    expect(byDomain['lynn-ranking.com']).toBe(1);
    expect(byDomain['whidbey-island-electrician.com']).toBe(1);
    expect(s.supply.pageOne).toBe(3);
    expect(s.supply.pageOneWithNumber).toBe(1);
  });
  it('pitch needs the SAME call to be customer-read and ≥90 s', () => {
    const s2 = summariseCorpus({ campaigns: camps, calls: [
      call({ geo_campaign_id: 'vash', created_at: iso(1), call_duration: 116, read: 'unknown' }),
      call({ geo_campaign_id: 'vash', created_at: iso(1), call_duration: 15, read: 'customer' }),
    ], gsc: [], nowMs: now });
    const v = s2.lines.find((l) => l.domain === 'vashon-roofing.com')!;
    expect(v.leads90).toBe(1);
    expect(v.customers).toBe(1);
    expect(v.customerLeads90).toBe(0);
    expect(s2.pitchNow).toEqual([]);
  });
  it('threshold table and cost line', () => {
    expect(s.billableAt.find((b) => b.seconds === 90)!.customerCalls).toBe(2);
    expect(s.billableAt.find((b) => b.seconds === 30)!.customerCalls).toBe(3);
    expect(s.numbers).toBe(4);
    expect(s.numberCostMonthlyUsd).toBeCloseTo(4.6, 2);
    expect(s.distinctCallers).toBe(4);
  });
});
