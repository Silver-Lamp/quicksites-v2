// lib/ppl/callAnalysis.ts
//
// One analysis per inbound call, stored on the row (owner, 2026-10-12: "i like that layer of
// analysis done on the calls, could we do that somehow for each call that comes in and put the
// analysis in the call db"). The layer it reproduces is the one that read the vashon-landscaping
// call the same morning: a desktop in Quezon City opened the site at 10:21, clicked Contact at
// 10:25:42, and a Jacksonville number rang the tracking line 41 seconds later, sat through the
// ring and hung up at the voicemail prompt — a vendor working new domains, not a customer. None
// of that was in `call_logs`; it was in PostHog, the campaign row, and the caller's history.
//
// Two halves, kept apart on purpose:
//   FACTS  — measured by us (gatherCallFacts): the site's pageviews in the minutes before the
//            call, the caller's area code and prior calls, whether the caller is a business we
//            hold a record of, the campaign's rank and age, the dial outcome, the voicemail
//            verdict. Every fact names its source; an unavailable source says why.
//   READ   — the model's reading of those facts (analyzeCall): customer / vendor_or_sales /
//            robocall / wrong_number / own_business / unknown, with a confidence and a summary
//            that must say which facts drive it and call an inference an inference.
//
// ⚠️ THE ANALYSIS GATES NOTHING. It is written after the call has been handled and the business
// texted (or not — that is `decideVoicemailRelay`'s job, from the transcript alone). An
// inference about who a caller probably is must never stop a possible customer being relayed;
// it tells the operator what to make of the row. ⚠️ The model never sees the caller's number —
// the AREA CODE is a signal (geography), the number is not.
import { classifyDial } from '@/lib/ppl/forwardHealth';
import { latestWindowFor, type HarvestRow } from '@/lib/gsc/latestWindow';
import { meterLLMCall } from '@/lib/ai/meter';
import { getOpenAI, resolveModel } from '@/lib/ai/openaiClient';
import { posthogHogqlResult, posthogQueryUnavailableReason, hogqlString } from '@/lib/analytics/posthogQuery';
import { industryLabelFor } from '@/lib/ppl/voicemailVerdict';

export type AnalysisRead = 'customer' | 'vendor_or_sales' | 'robocall' | 'wrong_number' | 'own_business' | 'operator_test' | 'unknown';

/**
 * The operator's own phones (`OPERATOR_PHONE_NUMBERS`, comma-separated). The owner dials his own
 * sites to check them — 19 calls from one number across three towing sites since 2025-08 — and
 * nothing in the row says so; without this the model read those as a prospecting vendor one
 * hour and a customer the next. Unset → no number is an operator's, and the facts say so.
 */
export function operatorLast10s(env: string | undefined = process.env.OPERATOR_PHONE_NUMBERS): string[] {
  return String(env ?? '')
    .split(',')
    .map((s) => last10(s))
    .filter((s) => s.length === 10);
}
export type AnalysisConfidence = 'high' | 'medium' | 'low';

export type VisitEvent = {
  /** ISO, UTC. */
  at: string;
  /** Seconds before the call began (negative = after). */
  secondsBeforeCall: number;
  event: string;
  url: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  device: string | null;
  referrer: string | null;
  /** Autocapture element text, e.g. "Contact" / "Call Now". */
  clicked: string | null;
};

export type CallFacts = {
  version: 1;
  call: {
    at: string;
    outcome: ReturnType<typeof classifyDial>;
    status: string | null;
    durationSec: number | null;
    handling: string | null;
    forwardedToName: string | null;
    voicemail: {
      hasRecording: boolean;
      speech: string | null;
      transcript: string | null;
      verdict: string | null;
      verdictReason: string | null;
    };
    businessTexted: boolean;
  };
  caller: {
    areaCode: string | null;
    /** Earlier calls from the same number to any of our numbers. */
    priorCalls: {
      count: number;
      domains: string[];
      lastOutcome: string | null;
      /**
       * What this number SAID last time, when we have it: the most recent prior voicemail's
       * verdict + summary, and the most recent prior stored read. ⚠️ Added 2026-10-15 because a
       * number that left "Heidi from Angie, looking for contractors" on vashon-well-drilling one
       * day and had a 200-second conversation with the business the next read as `unknown` —
       * count and length alone say nothing about who a repeat caller is; their own words do.
       */
      lastVoicemail: { verdict: string; summary: string | null; domain: string | null } | null;
      lastRead: { read: string; domain: string | null } | null;
    };
    /** A business we hold a listing for, matched on the last ten digits. */
    knownBusiness: { name: string; city: string | null; industry: string | null } | null;
    /** The number is a campaign's own forward-to: the business ringing its own site. */
    isForwardTo: boolean;
    /** The number is in OPERATOR_PHONE_NUMBERS: the owner testing. `null` = no list configured. */
    isOperator: boolean | null;
  };
  site: {
    domain: string | null;
    city: string | null;
    region: string | null;
    industry: string | null;
    campaignStatus: string | null;
    rankStatus: string | null;
    rankPosition: number | null;
    /** Days since the campaign row was created. */
    ageDays: number | null;
    /** Search Console impressions/clicks on the domain over the harvested rows (≈28 days). */
    gsc: { impressions: number; clicks: number } | { unavailable: string };
  };
  visit: {
    source: 'posthog';
    windowMinutesBefore: number;
    windowMinutesAfter: number;
    events: VisitEvent[];
    /** Set when PostHog could not be asked; `events` is then empty and means nothing. */
    unavailable?: string;
  };
};

export type AnalysisResult = {
  read: AnalysisRead;
  confidence: AnalysisConfidence;
  summary: string;
  nextStep: string;
};

export type StoredAnalysis = {
  version: 1;
  at: string;
  model: string;
  facts: CallFacts;
  read: AnalysisRead;
  confidence: AnalysisConfidence;
  nextStep: string;
  /** Set when the model call failed; `read` is then `unknown` and the summary says so. */
  error?: string;
};

// gpt-4.1, not the mini: the first backfill on 12 real calls with gpt-4o-mini answered
// "unknown" on five rows whose facts pointed one way (a Quezon City desktop clicking Contact
// 41 s before a Florida number rang a Vashon site) and filed a named vendor as a robocall.
// Roughly a cent per call, at about one call a day.
const MODEL = 'gpt-4.1';
const ROUTE = '/api/cron/call-alert';
const WINDOW_BEFORE_MIN = 20;
const WINDOW_AFTER_MIN = 3;

export const last10 = (s: string | null | undefined) => String(s ?? '').replace(/[^0-9]/g, '').slice(-10);

/** `+19046383607` → `904`; anything that is not a NANP number → null. */
export function areaCodeOf(e164: string | null | undefined): string | null {
  const d = String(e164 ?? '').replace(/[^0-9]/g, '');
  if (d.length === 11 && d.startsWith('1')) return d.slice(1, 4);
  if (d.length === 10) return d.slice(0, 3);
  return null;
}

/** Pure: PostHog rows → the visit events inside the window, oldest first. */
export function visitEventsFromRows(
  rows: unknown[][],
  callAtIso: string,
  window: { beforeMin: number; afterMin: number } = { beforeMin: WINDOW_BEFORE_MIN, afterMin: WINDOW_AFTER_MIN },
): VisitEvent[] {
  const callAt = new Date(callAtIso).getTime();
  const out: VisitEvent[] = [];
  for (const r of rows) {
    const [ts, event, url, city, region, country, device, referrer, clicked] = r as (string | null)[];
    // PostHog's `toString(timestamp)` is UTC with no zone marker ("2026-10-12 17:25:42.844000").
    const raw = String(ts ?? '').trim().replace(' ', 'T');
    const t = new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw}Z`).getTime();
    if (!Number.isFinite(t)) continue;
    const secondsBeforeCall = Math.round((callAt - t) / 1000);
    if (secondsBeforeCall > window.beforeMin * 60 || secondsBeforeCall < -window.afterMin * 60) continue;
    out.push({
      at: new Date(t).toISOString(),
      secondsBeforeCall,
      event: String(event ?? ''),
      url: url ? String(url).slice(0, 200) : null,
      city: city ? String(city) : null,
      region: region ? String(region) : null,
      country: country ? String(country) : null,
      device: device ? String(device) : null,
      referrer: referrer ? String(referrer).slice(0, 120) : null,
      clicked: clicked ? String(clicked).slice(0, 60) : null,
    });
  }
  out.sort((a, b) => b.secondsBeforeCall - a.secondsBeforeCall);
  return out.slice(0, 24);
}

type Db = {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export type CallLogForAnalysis = {
  id: string;
  call_sid: string | null;
  from_number: string | null;
  call_status: string | null;
  call_duration: number | null;
  handling: string | null;
  custom_domain: string | null;
  geo_campaign_id: string | null;
  created_at: string;
  recording_url?: string | null;
  voicemail_speech?: string | null;
  voicemail_transcript?: string | null;
  voicemail_verdict?: string | null;
  voicemail_verdict_reason?: string | null;
  voicemail_notify_result?: Record<string, unknown> | null;
  missed_call_notify_result?: Record<string, unknown> | null;
};

/** Everything we can measure about one call. Each source degrades on its own. */
export async function gatherCallFacts(db: Db, row: CallLogForAnalysis): Promise<CallFacts> {
  const callAt = row.created_at;
  const campaign = row.geo_campaign_id
    ? ((
        await db
          .from('geo_industry_campaigns')
          .select('domain, city, region, industry_key, status, rank_status, rank_position, created_at, forward_to, forward_to_name')
          .eq('id', row.geo_campaign_id)
          .maybeSingle()
      ).data as Record<string, unknown> | null)
    : null;
  const domain = (campaign?.domain as string | undefined) ?? row.custom_domain ?? null;

  // Caller history and identity — on the last ten digits, the only spelling two tables share.
  const l10 = last10(row.from_number);
  let priorCalls: CallFacts['caller']['priorCalls'] = { count: 0, domains: [], lastOutcome: null, lastVoicemail: null, lastRead: null };
  let knownBusiness: CallFacts['caller']['knownBusiness'] = null;
  let isForwardTo = false;
  if (l10.length === 10 && row.from_number) {
    const prior = (
      await db
        .from('call_logs')
        .select('custom_domain, call_status, call_duration, created_at, voicemail_verdict, voicemail_summary, analysis')
        .eq('from_number', row.from_number)
        .neq('id', row.id)
        .lt('created_at', callAt)
        .order('created_at', { ascending: false })
        .limit(20)
    ).data as
      | { custom_domain: string | null; call_status: string | null; call_duration: number | null; voicemail_verdict: string | null; voicemail_summary: string | null; analysis: { read?: string } | null }[]
      | null;
    if (prior?.length) {
      const lastVm = prior.find((p) => !!p.voicemail_verdict);
      const lastAn = prior.find((p) => typeof p.analysis?.read === 'string' && p.analysis.read !== 'unknown');
      priorCalls = {
        count: prior.length,
        domains: Array.from(new Set(prior.map((p) => p.custom_domain).filter((d): d is string => !!d))).slice(0, 6),
        lastOutcome: classifyDial(prior[0].call_status, prior[0].call_duration),
        lastVoicemail: lastVm ? { verdict: lastVm.voicemail_verdict as string, summary: lastVm.voicemail_summary ?? null, domain: lastVm.custom_domain } : null,
        lastRead: lastAn ? { read: lastAn.analysis!.read as string, domain: lastAn.custom_domain } : null,
      };
    }
    const biz = (
      await db
        .from('outreach_prospects')
        .select('business_name, city, industry_key, phone')
        .ilike('phone', `%${l10.slice(0, 3)}%${l10.slice(3, 6)}%${l10.slice(6)}%`)
        .limit(5)
    ).data as { business_name: string; city: string | null; industry_key: string | null; phone: string | null }[] | null;
    const hit = (biz ?? []).find((b) => last10(b.phone) === l10);
    if (hit) knownBusiness = { name: hit.business_name, city: hit.city, industry: hit.industry_key };
    const fwd = (await db.from('geo_industry_campaigns').select('id, forward_to').not('forward_to', 'is', null).limit(400)).data as
      | { forward_to: string | null }[]
      | null;
    isForwardTo = (fwd ?? []).some((c) => last10(c.forward_to) === l10);
  }

  // Search Console: the harvested query rows for this domain, summed.
  let gsc: CallFacts['site']['gsc'] = { unavailable: 'no domain' };
  if (domain) {
    // ⚠️ ONE capture of the rolling 28-day window (lib/gsc/latestWindow.ts). Summing every
    // harvested row read "2,247 impressions, 100 clicks" on a domain whose real window was 64 / 4,
    // and the model reasoned from it (2026-10-16).
    const { data, error } = await db
      .from('gsc_queries')
      .select('domain, end_date, impressions, clicks')
      .or(`domain.eq.sc-domain:${domain},domain.ilike.%//${domain}/%,domain.ilike.%//www.${domain}/%`)
      .gte('end_date', new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10))
      .limit(5000);
    if (error) gsc = { unavailable: `gsc_queries: ${String(error.message).slice(0, 80)}` };
    else {
      const w = latestWindowFor((data ?? []) as HarvestRow[], domain);
      gsc = w ? { impressions: w.impressions, clicks: w.clicks } : { impressions: 0, clicks: 0 };
    }
  }

  // PostHog: what happened on the site in the minutes around the call.
  let visit: CallFacts['visit'] = { source: 'posthog', windowMinutesBefore: WINDOW_BEFORE_MIN, windowMinutesAfter: WINDOW_AFTER_MIN, events: [] };
  const unavailable = posthogQueryUnavailableReason();
  if (unavailable) visit.unavailable = unavailable;
  else if (!domain) visit.unavailable = 'no domain to match pageviews on';
  else {
    const from = new Date(new Date(callAt).getTime() - WINDOW_BEFORE_MIN * 60_000).toISOString().slice(0, 19).replace('T', ' ');
    const to = new Date(new Date(callAt).getTime() + WINDOW_AFTER_MIN * 60_000).toISOString().slice(0, 19).replace('T', ' ');
    const host = domain.replace(/^www\./, '');
    const q =
      `select toString(timestamp), event, properties.$current_url, properties.$geoip_city_name, properties.$geoip_subdivision_1_code, ` +
      `properties.$geoip_country_code, properties.$device_type, properties.$referrer, properties.$el_text from events ` +
      `where properties.$current_url like ${hogqlString(`%${host}%`)} and timestamp >= toDateTime(${hogqlString(from)}) ` +
      `and timestamp <= toDateTime(${hogqlString(to)}) and event in ('$pageview', '$pageleave', '$autocapture') order by timestamp limit 60`;
    // 25 s, not the helper's 12: PostHog's query endpoint was slow enough from Vercel to miss
    // the default on the first production call, and a timeout reads as "no visit data" to the
    // model. The cron has a 70 s budget for the whole pass; one call rarely needs two queries.
    const res = await posthogHogqlResult(q, { timeoutMs: 25_000 });
    if (!res.ok) visit.unavailable = res.reason;
    else visit = { ...visit, events: visitEventsFromRows(res.result.results, callAt) };
  }

  const vmResult = row.voicemail_notify_result ?? null;
  const mcResult = row.missed_call_notify_result ?? null;
  return {
    version: 1,
    call: {
      at: callAt,
      outcome: classifyDial(row.call_status, row.call_duration),
      status: row.call_status,
      durationSec: row.call_duration,
      handling: row.handling,
      forwardedToName: (campaign?.forward_to_name as string | undefined) ?? null,
      voicemail: {
        hasRecording: !!row.recording_url,
        speech: row.voicemail_speech ?? null,
        transcript: row.voicemail_transcript ? String(row.voicemail_transcript).slice(0, 600) : null,
        verdict: row.voicemail_verdict ?? null,
        verdictReason: row.voicemail_verdict_reason ?? null,
      },
      businessTexted: vmResult?.business_sms === true || mcResult?.business_sms === true,
    },
    caller: {
      areaCode: areaCodeOf(row.from_number),
      priorCalls,
      knownBusiness,
      isForwardTo,
      isOperator: operatorLast10s().length ? operatorLast10s().includes(l10) : null,
    },
    site: {
      domain,
      city: (campaign?.city as string | undefined) ?? null,
      region: (campaign?.region as string | undefined) ?? null,
      industry: campaign?.industry_key ? industryLabelFor(String(campaign.industry_key)) : null,
      campaignStatus: (campaign?.status as string | undefined) ?? null,
      rankStatus: (campaign?.rank_status as string | undefined) ?? null,
      rankPosition: typeof campaign?.rank_position === 'number' ? (campaign.rank_position as number) : null,
      ageDays: campaign?.created_at ? Math.round((new Date(callAt).getTime() - new Date(String(campaign.created_at)).getTime()) / 86_400_000) : null,
      gsc,
    },
    visit,
  };
}

export const ANALYSIS_SYSTEM_PROMPT =
  'You analyse ONE inbound phone call to a tracking number printed on a local-business website that we operate ' +
  '(the site advertises a trade in a city and forwards calls to a real local business). You are given FACTS we measured. ' +
  'Answer with JSON only: {"read":"customer"|"vendor_or_sales"|"robocall"|"wrong_number"|"own_business"|"operator_test"|"unknown",' +
  '"confidence":"high"|"medium"|"low","summary":"<at most 60 words>","next_step":"<one line for the operator>"}. ' +
  'Rules: use only the facts given and say in the summary which facts drive your read. ' +
  'An area code\'s region and a PostHog geolocation are approximate and you must call them inferences, never facts. ' +
  'Commit to the read the facts point to, at "low" or "medium" confidence when they are suggestive and "high" only when several agree; ' +
  'answer "unknown" with low confidence rather than guess ONLY when no fact discriminates between the reads. ' +
  'Signals: a site visit inside the window that clicked Contact or a phone link shortly before the call means the caller very likely found the number on the site. ' +
  'If that visitor is far from the site\'s city — another state, or overseas, on a desktop — on a young site with no search impressions, read vendor_or_sales (prospecting by a web/marketing/lead-gen seller), medium confidence. ' +
  'A visitor near the site\'s city who then calls, or a voicemail judged a lead, reads customer. ' +
  'robocall: the caller hung up within about 8 seconds before the bridge, or the recording contains no speech (fax or dialer tone). ' +
  'A named person from a named company calling "about your account", billing, or offering a service is vendor_or_sales, not robocall. ' +
  'A caller whose number is a business we list, or a campaign\'s own forward-to, is own_business. ' +
  'A caller whose number is listed as the operator\'s own phone is operator_test (the owner checking the line), high confidence, whatever else the facts say. ' +
  'Never claim a person answered; a long leg may be voicemail. An "ended" or "abandoned" outcome on a call that has a recording means the caller reached voicemail, not that they hung up early. ' +
  'In the summary, write a location as "(geolocation, approximate)" and name the facts, e.g. "clicked Contact 41 s before the call".';

/** Pure: the model's JSON → a result; malformed → unknown/low, never a guess. */
export function parseAnalysis(raw: unknown): AnalysisResult {
  try {
    const obj = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown> | null;
    const read = String(obj?.read ?? '').trim().toLowerCase();
    const conf = String(obj?.confidence ?? '').trim().toLowerCase();
    const summary = String(obj?.summary ?? '').replace(/\s+/g, ' ').trim().slice(0, 600);
    const nextStep = String(obj?.next_step ?? '').replace(/\s+/g, ' ').trim().slice(0, 240);
    const reads: AnalysisRead[] = ['customer', 'vendor_or_sales', 'robocall', 'wrong_number', 'own_business', 'operator_test', 'unknown'];
    const confs: AnalysisConfidence[] = ['high', 'medium', 'low'];
    if (reads.includes(read as AnalysisRead) && summary) {
      return { read: read as AnalysisRead, confidence: confs.includes(conf as AnalysisConfidence) ? (conf as AnalysisConfidence) : 'low', summary, nextStep };
    }
  } catch {
    /* fall through */
  }
  return { read: 'unknown', confidence: 'low', summary: 'The analysis could not be read.', nextStep: '' };
}

/** The facts as the model sees them: no caller number, compact. */
export function factsForModel(f: CallFacts): string {
  const v = f.visit;
  const visitLines = v.unavailable
    ? `Site visits before the call: unavailable (${v.unavailable}).`
    : v.events.length === 0
      ? `Site visits in the ${v.windowMinutesBefore} minutes before the call: none recorded on ${f.site.domain ?? 'the site'}.`
      : `Site visits on ${f.site.domain} in the ${v.windowMinutesBefore} minutes before the call (seconds before call · event · page · approx location · device · clicked):\n` +
        v.events.map((e) => `  ${e.secondsBeforeCall}s · ${e.event} · ${e.url ?? '-'} · ${[e.city, e.region, e.country].filter(Boolean).join(', ') || '?'} · ${e.device ?? '?'}${e.clicked ? ` · clicked "${e.clicked}"` : ''}${e.referrer && e.referrer !== '$direct' ? ` · from ${e.referrer}` : ''}`).join('\n');
  const gsc = 'unavailable' in f.site.gsc ? `unavailable (${f.site.gsc.unavailable})` : `${f.site.gsc.impressions} impressions, ${f.site.gsc.clicks} clicks in the harvested Search Console rows`;
  const vm = f.call.voicemail;
  // `classifyDial` files the parent call's `ended`/`abandoned` as "abandoned" (hung up before
  // the bridge). On a voicemail-first call, or any call with a recording, that word misleads:
  // the caller reached the voicemail prompt. Say what the row actually supports.
  const outcome =
    f.call.outcome === 'abandoned' && (vm.hasRecording || f.call.handling === 'voicemail_first')
      ? 'ended after reaching voicemail'
      : f.call.outcome;
  return [
    `Site: ${f.site.domain ?? 'unknown'} — a ${f.site.industry ?? 'local service'} site for ${[f.site.city, f.site.region].filter(Boolean).join(', ') || 'an unknown city'}; campaign status ${f.site.campaignStatus ?? '?'}; ${f.site.ageDays != null ? `${f.site.ageDays} days old` : 'age unknown'}; rank ${f.site.rankStatus ?? '?'}${f.site.rankPosition != null ? ` (position ${f.site.rankPosition})` : ''}; Search Console: ${gsc}.`,
    `Call: ${f.call.at} UTC; handling ${f.call.handling ?? '?'}${f.call.forwardedToName ? ` to ${f.call.forwardedToName}` : ''}; outcome ${outcome} (Twilio status ${f.call.status ?? '?'}${f.call.durationSec != null ? `, ${f.call.durationSec}s` : ''}); business texted afterwards: ${f.call.businessTexted ? 'yes' : 'no'}.`,
    `Voicemail: ${vm.hasRecording ? `recording present; speech ${vm.speech ?? 'unknown'}${vm.verdict ? `; judged ${vm.verdict} (${vm.verdictReason ?? ''})` : ''}${vm.transcript ? `; transcript: "${vm.transcript}"` : ''}` : 'none'}.`,
    `Caller: area code ${f.caller.areaCode ?? 'unknown'}; prior calls from this number to our numbers: ${f.caller.priorCalls.count}${f.caller.priorCalls.count ? ` (sites: ${f.caller.priorCalls.domains.join(', ') || '?'}; last outcome ${f.caller.priorCalls.lastOutcome}${f.caller.priorCalls.lastVoicemail ? `; their most recent voicemail to us was judged ${f.caller.priorCalls.lastVoicemail.verdict}${f.caller.priorCalls.lastVoicemail.summary ? ` — "${f.caller.priorCalls.lastVoicemail.summary}"` : ''}` : ''}${f.caller.priorCalls.lastRead ? `; our most recent read of this number: ${f.caller.priorCalls.lastRead.read}` : ''})` : ''}; ${f.caller.knownBusiness ? `the number belongs to a business we list: ${f.caller.knownBusiness.name}${f.caller.knownBusiness.city ? `, ${f.caller.knownBusiness.city}` : ''}` : 'not a business we list'}; ${f.caller.isForwardTo ? 'IS a campaign forward-to number (a business calling its own site)' : 'not a forward-to number'}; ${
      f.caller.isOperator === null ? 'no operator phone list is configured' : f.caller.isOperator ? 'IS the operator\'s own phone' : 'not the operator\'s phone'
    }.`,
    visitLines,
  ].join('\n');
}

export async function analyzeCall(facts: CallFacts): Promise<AnalysisResult & { error?: string }> {
  try {
    const raw = await meterLLMCall<string>(
      { provider: 'openai', model_code: MODEL, modality: 'chat', user_id: null, route: ROUTE },
      async () => {
        const r = await getOpenAI('chat').chat.completions.create({
          model: resolveModel(MODEL, 'chat'),
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
            { role: 'user', content: factsForModel(facts) },
          ],
        });
        return {
          value: r.choices?.[0]?.message?.content ?? '',
          usage: { input_tokens: r.usage?.prompt_tokens ?? 0, output_tokens: r.usage?.completion_tokens ?? 0 },
        };
      },
    );
    return parseAnalysis(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 160) : 'error';
    return { read: 'unknown', confidence: 'low', summary: `Analysis failed (${msg}); the facts were still recorded.`, nextStep: '', error: msg };
  }
}

/** Gather + read + write, for one row. Returns what was stored. */
export async function analyzeAndStore(db: Db, row: CallLogForAnalysis): Promise<{ summary: string; read: AnalysisRead; error?: string }> {
  const facts = await gatherCallFacts(db, row);
  const r = await analyzeCall(facts);
  const stored: StoredAnalysis = {
    version: 1,
    at: new Date().toISOString(),
    model: MODEL,
    facts,
    read: r.read,
    confidence: r.confidence,
    nextStep: r.nextStep,
    ...(r.error ? { error: r.error } : {}),
  };
  const { error } = await db
    .from('call_logs')
    .update({ analysis: stored, analysis_summary: r.summary, analyzed_at: stored.at })
    .eq('id', row.id);
  if (error) throw new Error(`call_logs analysis write failed: ${error.message}`);
  return { summary: r.summary, read: r.read, ...(r.error ? { error: r.error } : {}) };
}

export const READ_LABEL: Record<AnalysisRead, string> = {
  customer: 'likely a customer',
  vendor_or_sales: 'likely a vendor or sales call',
  robocall: 'likely a robocall',
  wrong_number: 'likely a wrong number',
  own_business: 'likely the business itself',
  operator_test: 'the operator testing the line',
  unknown: 'could not tell',
};

/** One line for the alert email and the call-logs page: the read, then the summary. */
export function analysisLine(row: { analysis_summary?: string | null; analysis?: { read?: string; confidence?: string } | null }): string | null {
  const s = (row.analysis_summary ?? '').trim();
  if (!s) return null;
  const read = row.analysis?.read as AnalysisRead | undefined;
  const conf = row.analysis?.confidence;
  const head = read && READ_LABEL[read] ? `AI read: ${READ_LABEL[read]}${conf ? ` (${conf} confidence)` : ''}. ` : 'AI read: ';
  return `${head}${s}`;
}
