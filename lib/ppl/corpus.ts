// lib/ppl/corpus.ts — what the call corpus says, re-derived on every load of /admin/ppl.
//
// Owner, 2026-10-16: "analyze our corpus … pros/cons/recommendations … work it into our PPL
// page." The analysis that answered him is reproduced here as a PURE summary over the rows,
// so the page can never quote a stale number (CLAUDE.md §4: write the command, not the count).
// The recommendations are derived the same way: a line appears under "pitch now" because the
// rows say so today, not because someone wrote its name down.
import { classifyDial } from '@/lib/ppl/forwardHealth';
import { isOwnBusinessCaller } from '@/lib/ppl/ownNumberCall';

/** Twilio local number, per month (docs/PPL_VERTICAL.md §9 status table). Minutes are negligible at today's volume. */
export const NUMBER_MONTHLY_USD = 1.15;
export const BILLABLE_SECONDS_OPTIONS = [90, 60, 45, 30] as const;
/** Industries whose sites are directories, never a business a caller can hire — never a PPL line. */
export const NON_BUSINESS_INDUSTRIES = new Set(['dome_builder', 'treehouse_builder']);

export type CorpusCampaign = {
  id: string;
  domain: string;
  city: string | null;
  industry_key: string | null;
  rank_status: string | null;
  rank_position: number | null;
  tracking_number: string | null;
  forward_to: string | null;
  forward_to_name: string | null;
  domain_status: string | null;
  created_at: string | null;
};

export type CorpusCall = {
  geo_campaign_id: string | null;
  from_number: string | null;
  forwarded_to: string | null;
  handling: string | null;
  call_status: string | null;
  call_duration: number | null;
  created_at: string;
  recording_url: string | null;
  voicemail_speech: string | null;
  voicemail_verdict: string | null;
  /** `analysis->>'read'` from lib/ppl/callAnalysis.ts, or null when not analysed. */
  read: string | null;
};

export type CorpusGsc = { domain: string; impressions: number; clicks: number };

export type Outcomes = { calls: number; leads90: number; answered15to89: number; brief: number; unanswered: number; voicemails: number; voicemailNoSpeech: number; voicemailNotLead: number };

export type LineRow = {
  campaignId: string;
  domain: string;
  city: string | null;
  industry: string | null;
  rankStatus: string | null;
  rankPosition: number | null;
  ageDays: number | null;
  forwardToName: string | null;
  impressions28d: number | null;
  clicks28d: number | null;
  dials: number;
  answered: number;
  leads90: number;
  customers: number;
  junk: number;
  ownOrTest: number;
  answerRate: number | null;
  lastCallAt: string | null;
};

export type CorpusSummary = {
  since: string;
  windowDays: number;
  outcomes30d: Outcomes;
  outcomesAll: Outcomes;
  reads: Array<{ read: string; count: number; leads90: number }>;
  readsTotal: number;
  customerShare: number | null;
  lines: LineRow[];
  customerCallDurations: number[];
  billableAt: Array<{ seconds: number; customerCalls: number; allAnswered: number }>;
  numbers: number;
  numberCostMonthlyUsd: number;
  connectedMinutesAll: number;
  distinctCallers: number;
  supply: { pageOne: number; pageOneWithNumber: number; rankedWithoutNumber: Array<{ domain: string; rankPosition: number | null; city: string | null; industry: string | null }> };
  pitchNow: LineRow[];
  nonAnswerers: LineRow[];
  noiseLines: LineRow[];
};

const hostOf = (s: string): string => String(s || '').toLowerCase().replace(/^sc-domain:/, '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

const emptyOutcomes = (): Outcomes => ({ calls: 0, leads90: 0, answered15to89: 0, brief: 0, unanswered: 0, voicemails: 0, voicemailNoSpeech: 0, voicemailNotLead: 0 });

function addOutcome(o: Outcomes, c: CorpusCall) {
  o.calls += 1;
  const d = classifyDial(c.call_status, c.call_duration);
  if (c.handling === 'forward' || c.handling == null) {
    if (d === 'connected' && (c.call_duration ?? 0) >= 90) o.leads90 += 1;
    else if (d === 'connected') o.answered15to89 += 1;
    else if (d === 'brief') o.brief += 1;
    else if (d === 'unanswered') o.unanswered += 1;
  }
  if (c.recording_url) {
    o.voicemails += 1;
    if (c.voicemail_speech === 'no_speech') o.voicemailNoSpeech += 1;
    if (c.voicemail_verdict === 'not_lead') o.voicemailNotLead += 1;
  }
}

const JUNK_READS = new Set(['vendor_or_sales', 'robocall', 'wrong_number']);
const OWN_READS = new Set(['own_business', 'operator_test']);

export function summariseCorpus(input: { campaigns: CorpusCampaign[]; calls: CorpusCall[]; gsc: CorpusGsc[]; nowMs?: number; windowDays?: number }): CorpusSummary {
  const nowMs = input.nowMs ?? Date.now();
  const windowDays = input.windowDays ?? 30;
  const sinceMs = nowMs - windowDays * 86_400_000;
  const byCampaign = new Map(input.campaigns.map((c) => [c.id, c]));
  const gscByHost = new Map<string, { impressions: number; clicks: number }>();
  for (const g of input.gsc) {
    const h = hostOf(g.domain);
    const e = gscByHost.get(h) ?? { impressions: 0, clicks: 0 };
    e.impressions += g.impressions || 0;
    e.clicks += g.clicks || 0;
    gscByHost.set(h, e);
  }

  const outcomes30d = emptyOutcomes();
  const outcomesAll = emptyOutcomes();
  const reads = new Map<string, { count: number; leads90: number }>();
  const perLine = new Map<string, LineRow>();
  const customerDurations: number[] = [];
  const callers = new Set<string>();
  let connectedSeconds = 0;
  const answeredDurations: number[] = [];

  for (const c of input.calls) {
    if (!c.geo_campaign_id) continue;
    const camp = byCampaign.get(c.geo_campaign_id);
    if (!camp) continue;
    const t = Date.parse(c.created_at);
    if (c.from_number) callers.add(c.from_number);
    addOutcome(outcomesAll, c);
    if (Number.isFinite(t) && t >= sinceMs) addOutcome(outcomes30d, c);
    const d = classifyDial(c.call_status, c.call_duration);
    if (d === 'connected' || d === 'brief') {
      connectedSeconds += c.call_duration ?? 0;
      answeredDurations.push(c.call_duration ?? 0);
    }
    const read = c.read ?? (c.handling === 'own_business' ? 'own_business' : null);
    if (read) {
      const e = reads.get(read) ?? { count: 0, leads90: 0 };
      e.count += 1;
      if (d === 'connected' && (c.call_duration ?? 0) >= 90) e.leads90 += 1;
      reads.set(read, e);
      if (read === 'customer' && (d === 'connected' || d === 'brief')) customerDurations.push(c.call_duration ?? 0);
    }
    const own = (read && OWN_READS.has(read)) || c.handling === 'own_business' || isOwnBusinessCaller(c.from_number, c.forwarded_to ?? camp.forward_to);
    const line = perLine.get(camp.id) ?? {
      campaignId: camp.id,
      domain: camp.domain,
      city: camp.city,
      industry: camp.industry_key,
      rankStatus: camp.rank_status,
      rankPosition: camp.rank_position,
      ageDays: camp.created_at ? Math.floor((nowMs - Date.parse(camp.created_at)) / 86_400_000) : null,
      forwardToName: camp.forward_to_name,
      impressions28d: gscByHost.get(hostOf(camp.domain))?.impressions ?? null,
      clicks28d: gscByHost.get(hostOf(camp.domain))?.clicks ?? null,
      dials: 0,
      answered: 0,
      leads90: 0,
      customers: 0,
      junk: 0,
      ownOrTest: 0,
      answerRate: null,
      lastCallAt: null,
    };
    if (!line.lastCallAt || c.created_at > line.lastCallAt) line.lastCallAt = c.created_at;
    if (own) line.ownOrTest += 1;
    else if (c.handling === 'forward' || c.handling == null) {
      if (d === 'connected' || d === 'brief' || d === 'unanswered') line.dials += 1;
      if (d === 'connected') line.answered += 1;
      if (d === 'connected' && (c.call_duration ?? 0) >= 90) line.leads90 += 1;
      if (read === 'customer') line.customers += 1;
      if (read && JUNK_READS.has(read)) line.junk += 1;
    }
    perLine.set(camp.id, line);
  }

  // Lines with a number but no calls still belong on the table.
  for (const camp of input.campaigns) {
    if (!camp.tracking_number || perLine.has(camp.id)) continue;
    perLine.set(camp.id, {
      campaignId: camp.id, domain: camp.domain, city: camp.city, industry: camp.industry_key, rankStatus: camp.rank_status, rankPosition: camp.rank_position,
      ageDays: camp.created_at ? Math.floor((nowMs - Date.parse(camp.created_at)) / 86_400_000) : null, forwardToName: camp.forward_to_name,
      impressions28d: gscByHost.get(hostOf(camp.domain))?.impressions ?? null, clicks28d: gscByHost.get(hostOf(camp.domain))?.clicks ?? null,
      dials: 0, answered: 0, leads90: 0, customers: 0, junk: 0, ownOrTest: 0, answerRate: null, lastCallAt: null,
    });
  }
  const lines = Array.from(perLine.values()).map((l) => ({ ...l, answerRate: l.dials ? l.answered / l.dials : null }));
  lines.sort((a, b) => b.leads90 - a.leads90 || b.customers - a.customers || b.dials - a.dials || a.domain.localeCompare(b.domain));

  const readRows = Array.from(reads.entries()).map(([read, v]) => ({ read, ...v })).sort((a, b) => b.count - a.count);
  const readsTotal = readRows.reduce((n, r) => n + r.count, 0);
  const customers = reads.get('customer')?.count ?? 0;

  const owned = (c: CorpusCampaign) => c.domain_status === 'registered' || c.domain_status === 'attached';
  const pageOne = input.campaigns.filter((c) => c.rank_status === 'page1' && owned(c));
  const rankedWithoutNumber = pageOne
    .filter((c) => !c.tracking_number && !NON_BUSINESS_INDUSTRIES.has(c.industry_key ?? ''))
    .sort((a, b) => (a.rank_position ?? 99) - (b.rank_position ?? 99))
    .map((c) => ({ domain: c.domain, rankPosition: c.rank_position, city: c.city, industry: c.industry_key }));

  const numbers = input.campaigns.filter((c) => c.tracking_number).length;

  return {
    since: new Date(sinceMs).toISOString(),
    windowDays,
    outcomes30d,
    outcomesAll,
    reads: readRows,
    readsTotal,
    customerShare: readsTotal ? customers / readsTotal : null,
    lines,
    customerCallDurations: customerDurations.sort((a, b) => a - b),
    billableAt: BILLABLE_SECONDS_OPTIONS.map((seconds) => ({ seconds, customerCalls: customerDurations.filter((s) => s >= seconds).length, allAnswered: answeredDurations.filter((s) => s >= seconds).length })),
    numbers,
    numberCostMonthlyUsd: Math.round(numbers * NUMBER_MONTHLY_USD * 100) / 100,
    connectedMinutesAll: Math.round(connectedSeconds / 60),
    distinctCallers: callers.size,
    supply: { pageOne: pageOne.length, pageOneWithNumber: pageOne.filter((c) => c.tracking_number).length, rankedWithoutNumber },
    // Evidence-based, never a name typed by hand:
    pitchNow: lines.filter((l) => l.leads90 > 0 && l.customers > 0),
    nonAnswerers: lines.filter((l) => l.dials >= 3 && l.answered === 0),
    noiseLines: lines.filter((l) => l.dials + l.ownOrTest >= 3 && l.customers === 0 && l.junk >= 0.75 * Math.max(1, l.dials)),
  };
}

export async function loadPplCorpus(nowMs = Date.now()): Promise<CorpusSummary> {
  const { supabaseAdmin } = await import('@/lib/supabase/admin');
  const [{ data: campaigns }, { data: calls }, { data: gsc }] = await Promise.all([
    supabaseAdmin.from('geo_industry_campaigns').select('id, domain, city, industry_key, rank_status, rank_position, tracking_number, forward_to, forward_to_name, domain_status, created_at'),
    supabaseAdmin.from('call_logs').select('geo_campaign_id, from_number, forwarded_to, handling, call_status, call_duration, created_at, recording_url, voicemail_speech, voicemail_verdict, analysis').not('geo_campaign_id', 'is', null).order('created_at', { ascending: false }).limit(5000),
    supabaseAdmin.from('gsc_queries').select('domain, impressions, clicks').gte('end_date', new Date(nowMs - 28 * 86_400_000).toISOString().slice(0, 10)).limit(20000),
  ]);
  return summariseCorpus({
    campaigns: (campaigns ?? []) as CorpusCampaign[],
    calls: ((calls ?? []) as Array<Omit<CorpusCall, 'read'> & { analysis: { read?: string } | null }>).map((c) => ({ ...c, read: typeof c.analysis?.read === 'string' ? c.analysis.read : null })),
    gsc: ((gsc ?? []) as Array<{ domain: string; impressions: number | null; clicks: number | null }>).map((g) => ({ domain: g.domain, impressions: g.impressions ?? 0, clicks: g.clicks ?? 0 })),
    nowMs,
  });
}
