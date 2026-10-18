// lib/ppl/pitchPlan.ts
//
// "Pitch now" turned into a call you can actually make: for one line with a customer-read lead
// ≥90 s, derive the facts the business already saw (the texted calls), the advice the
// 2026-10-17 read produced as RULES over the row (not prose typed for one business), and a
// branching script — every branch a thing the business is likely to say back — with the same
// tree laid out as a flow chart. Pure: the section renders it from the corpus row.
//
// ⚠️ THE SCRIPT IS AN HONESTY SURFACE, like the IVR. `FORBIDDEN_IVR_PHRASES` is grepped over
// every line it can say (no "guarantee", no "licensed", no "24/7"), and so are the ranking
// promises a salesperson reaches for ("first page", "rank", "Google"). It never names a price
// the account table would not charge: every dollar figure is formatted from PPL_DEFAULTS and the
// starter constants below, so changing the deal changes the script.
import { PPL_DEFAULTS } from '@/lib/ppl/rules';
import { outcomeSentence } from '@/lib/ppl/outcomeSurvey';
import type { LineRow } from '@/lib/ppl/corpus';

/**
 * The two deals a first yes can take (owner, 2026-10-18). Both are per-account VALUES the
 * account table already holds — price per lead, deposit, reload threshold, reload amount — so a
 * deal is a row, never a code path.
 *
 * `next`: "pre-pay the next one" — they got one free; the next is one lead's price, paid now, and
 * the card is charged one lead as each one posts, always exactly one ahead. Never post-pay: the
 * line connects only while the balance covers a lead, so a declined card stops the line and says
 * so, and nobody ever owes us money.
 *
 * `package`: "4 for $300" — a count for a round number, stated as a package, never as a
 * percentage ("20% off" makes the single-lead price read as the penalty). Up to 20% is a SPOKEN
 * lever on the call, never printed. Unused balance is refundable on request — the script says so,
 * which makes the lower rate a real price cut rather than breakage.
 */
export type DealKey = 'next' | 'package';
export type Deal = { key: DealKey; label: string; cplCents: number; depositCents: number; reloadThresholdCents: number; reloadAmountCents: number; leads: number };
export const PACKAGE_LEADS = 4;
export const PACKAGE_PRICE_CENTS = 30_000;
export const DEALS: Record<DealKey, Deal> = {
  next: { key: 'next', label: 'Pay the next one', cplCents: PPL_DEFAULTS.cplCents, depositCents: PPL_DEFAULTS.cplCents, reloadThresholdCents: PPL_DEFAULTS.cplCents, reloadAmountCents: PPL_DEFAULTS.cplCents, leads: 1 },
  package: { key: 'package', label: `${PACKAGE_LEADS} for ${'$'}${PACKAGE_PRICE_CENTS / 100}`, cplCents: Math.round(PACKAGE_PRICE_CENTS / PACKAGE_LEADS), depositCents: PACKAGE_PRICE_CENTS, reloadThresholdCents: Math.round(PACKAGE_PRICE_CENTS / PACKAGE_LEADS), reloadAmountCents: PACKAGE_PRICE_CENTS, leads: PACKAGE_LEADS },
};
/** The most we say yes to on the call when an owner is almost there. Spoken, never printed. */
export const SPOKEN_LEVER_MAX_PCT = 20;
/** Kept for callers that still read the old names: the package is the "$300 starter". */
export const STARTER_DEPOSIT_CENTS = DEALS.package.depositCents;
export const STARTER_RELOAD_THRESHOLD_CENTS = DEALS.package.reloadThresholdCents;
export const STARTER_RELOAD_AMOUNT_CENTS = DEALS.package.reloadAmountCents;

export const SCRIPT_FORBIDDEN = ['rank', 'first page', 'page one', 'google', 'guarantee', 'licensed', 'insured', 'specialist', '24/7', 'escrow', 'capacity', 'high volume', 'seasonal'];

import { usd } from '@/lib/ppl/money';
export { usd };

export type ScriptNode = {
  id: string;
  /** 'ask' nodes wait for the business's answer; 'say' nodes continue; 'end' nodes close. */
  kind: 'say' | 'ask' | 'end';
  title: string;
  say: string;
  options?: Array<{ label: string; next: string }>;
  next?: string;
  outcome?: 'yes' | 'later' | 'no';
  /** On a yes: which deal they took, so the on-yes step creates the right account. */
  deal?: DealKey;
};

export type PitchFacts = {
  domain: string;
  business: string;
  trade: string;
  city: string;
  leads: Array<{ at: string; seconds: number; whenLabel: string; minutesLabel: string }>;
  dials: number;
  answered: number;
  unanswered: number;
  impressions28d: number | null;
  clicks28d: number | null;
  rankStatus: string | null;
  rankPosition: number | null;
  ageDays: number | null;
  /** The sentence from the did-it-become-a-job survey, or null when nobody was asked yet. */
  outcomeLine: string | null;
};

export type PitchPlan = {
  campaignId: string;
  templateId: string | null;
  facts: PitchFacts;
  /** 1 = call this one first among the pitch-now lines, with the reason. */
  order: { rank: number; of: number; reason: string };
  advice: string[];
  /** Both deals the script offers, plus the floor they share. */
  deals: Record<DealKey, Deal>;
  minBillableSeconds: number;
  /** @deprecated the package deal, kept for the first render's shape. */
  deal: { cplCents: number; minBillableSeconds: number; depositCents: number; reloadThresholdCents: number; reloadAmountCents: number; leadsInDeposit: number };
  script: ScriptNode[];
  /** What to do the moment they say yes — in order, in the same step. */
  onYes: string[];
  flow: FlowLayout;
};

export type FlowLayout = {
  width: number;
  height: number;
  nodes: Array<{ id: string; x: number; y: number; w: number; h: number; title: string; kind: ScriptNode['kind']; outcome?: ScriptNode['outcome'] }>;
  edges: Array<{ from: string; to: string; label: string | null }>;
};

const TRADE_WORD: Record<string, string> = {
  towing: 'a tow', plumbing: 'a plumber', electrical: 'an electrician', hvac: 'heating and cooling', roofing: 'a roofer', landscaping: 'landscaping', auto_repair: 'auto repair', general_contractor: 'a contractor', painting: 'a painter', moving: 'movers',
};

/** The owner's clock, like the call notices (lib/ppl/connectedCallNotice.ts) — the server runs UTC. */
export const PITCH_TZ = 'America/Los_Angeles';
export function whenLabel(iso: string, tz = PITCH_TZ): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'recently';
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d).replace(/, (\d)/, ' at $1');
}
function minutesLabel(seconds: number): string {
  if (seconds >= 120) return `${Math.round(seconds / 60)} minutes`;
  if (seconds >= 60) return 'a minute and a half';
  return `${seconds} seconds`;
}

export function pitchFacts(line: LineRow): PitchFacts {
  return {
    domain: line.domain,
    business: line.forwardToName || 'the business on the line',
    trade: TRADE_WORD[line.industry ?? ''] ?? (line.industry ? line.industry.replace(/_/g, ' ') : 'this trade'),
    city: line.city || 'the area',
    leads: line.leadCalls.map((l) => ({ ...l, whenLabel: whenLabel(l.at), minutesLabel: minutesLabel(l.seconds) })),
    dials: line.dials,
    answered: line.answered,
    unanswered: line.unanswered,
    impressions28d: line.impressions28d,
    clicks28d: line.clicks28d,
    rankStatus: line.rankStatus,
    rankPosition: line.rankPosition,
    ageDays: line.ageDays,
    outcomeLine: outcomeSentence({ asked: line.outcome.asked, answered: line.outcome.jobs + line.outcome.noJobs + line.outcome.notYet, jobs: line.outcome.jobs, noJobs: line.outcome.noJobs, notYet: line.outcome.notYet }),
  };
}

/** Which pitch-now line to call first: more paid-grade leads, then more impressions, then older. */
export function rankPitchOrder(lines: LineRow[]): LineRow[] {
  return [...lines].sort((a, b) => b.customerLeads90 - a.customerLeads90 || (b.impressions28d ?? 0) - (a.impressions28d ?? 0) || (b.ageDays ?? 0) - (a.ageDays ?? 0) || a.domain.localeCompare(b.domain));
}

export function pitchAdvice(f: PitchFacts, d = PPL_DEFAULTS): string[] {
  const out: string[] = [];
  const last = f.leads[f.leads.length - 1];
  if (last) out.push(`Open with the ${last.whenLabel} call (${last.minutesLabel}). They were texted that caller's number; ask whether it became a job — that answer is the real pitch signal and we do not have it yet.`);
  if (f.leads.length > 1) out.push(`${f.leads.length} paid-grade calls on this line, not one — say so; the ask is to keep what is already happening.`);
  if (f.outcomeLine) out.push(`${f.outcomeLine} That is their own answer to the records-only text — use it before you ask the question again.`);
  if (f.unanswered > 0) out.push(`${f.unanswered} of ${f.dials} forwarded dials rang out. Say it: on pay-per-call they pay nothing for a ring-out, but each one was a customer who reached nobody. Their phone shows our tracking number as the caller — ask them to answer it.`);
  if (f.rankStatus === 'page1') out.push(`The page is on page one (position ${f.rankPosition ?? '?'}) with ${f.impressions28d ?? 0} impressions in 28 days: the page is the asset, the call is the proof.`);
  else out.push(`The page is not on page one yet (position ${f.rankPosition ?? 'unknown'}, ${f.impressions28d ?? 0} impressions / ${f.clicks28d ?? 0} clicks in 28 days). Pitch the call they received, never where the page sits.`);
  out.push(`Lead with "pay the next one": the call they got was free, the next is ${usd(DEALS.next.cplCents)} paid now, then the card is charged ${usd(DEALS.next.cplCents)} as each one posts — always one ahead, never after the fact. Offer "${DEALS.package.label}" (${usd(DEALS.package.cplCents)} a lead) as the package for an owner who would rather see one charge; up to ${SPOKEN_LEVER_MAX_PCT}% is a spoken lever when they are almost there — never printed. The ${usd(d.reloadAmountCents)} default reload is not a first ask. Price, floor and reloads are per-account values.`);
  out.push(`Keep the ${d.minBillableSeconds}-second floor: it bills the calls that were conversations and spares the 12- and 15-second ones. Decide it before quoting; the script says it out loud.`);
  out.push('Phone them, never text the pitch. On a yes, do the four steps on the "They said yes" tab in one sitting — the page must stop claiming a company that does not exist before anyone pays.');
  return out;
}

export function pitchScript(f: PitchFacts, tracking: string | null, d = PPL_DEFAULTS): ScriptNode[] {
  const last = f.leads[f.leads.length - 1];
  const cpl = usd(DEALS.next.cplCents);
  const pkg = usd(DEALS.package.depositCents);
  const pkgEach = usd(DEALS.package.cplCents);
  const pkgN = DEALS.package.leads;
  const secs = `${d.minBillableSeconds} seconds`;
  const line = tracking ? ` Your line is ${tracking}.` : '';
  const open = last
    ? `Hi, this is Sandon. On ${last.whenLabel} someone who found ${f.domain} called and talked with you for ${last.minutesLabel} — you would have had a text from us with their number right after. Did that turn into a job?`
    : `Hi, this is Sandon. Calls from ${f.domain} have been ringing through to you — you would have had a text from us with each caller's number. Have any turned into jobs?`;
  return [
    { id: 'open', kind: 'ask', title: 'Open with the call they got', say: open, options: [
      { label: 'Yes, it was a job', next: 'was_job' },
      { label: 'No / not sure', next: 'not_job' },
      { label: 'Who is this?', next: 'who' },
    ] },
    { id: 'who', kind: 'say', title: 'Who we are', say: `I run ${f.domain} — the page people land on when they look for ${f.trade} around ${f.city}. When they call the number on it, it rings you; that is the call on ${last?.whenLabel ?? 'the day you were texted'}.`, next: 'offer' },
    { id: 'was_job', kind: 'say', title: 'It was a job', say: `Good — that is what the page is for. I would like to keep sending them to you, and I only want paying for the ones that are real.`, next: 'offer' },
    { id: 'not_job', kind: 'say', title: 'Not a job', say: `Fair enough — ${last ? `a ${last.minutesLabel} call is usually a real one, but you would know` : 'you would know better than I would'}. Either way the line keeps ringing you; the question is whether the real ones are worth paying for.`, next: 'offer' },
    { id: 'offer', kind: 'ask', title: 'The deal', say: `Here is the deal. The call you got was free. The next one is ${cpl}, paid now — and after that your card is charged ${cpl} as each one comes in, only for calls that last ${secs} or more; shorter calls, wrong numbers, sales calls are never charged. You are always exactly one call ahead, never behind. If a charge ever fails, the line tells callers it is not connecting and stops — nobody rings into silence, and you never owe us anything. You get a text for every charge with the caller's number. If you would rather see one charge, it is ${pkgN} for ${pkg} — ${pkgEach} each — and anything unused is refundable if you ask. Want to try it?`, options: [
      { label: `Yes — the next one (${cpl})`, next: 'yes_next' },
      { label: `Yes — ${pkgN} for ${pkg}`, next: 'yes_package' },
      { label: 'How much, again?', next: 'price' },
      { label: 'Why does my phone show your number?', next: 'caller_id' },
      { label: 'I miss calls sometimes', next: 'missed' },
      { label: 'I have enough work', next: 'enough' },
      { label: 'I already pay a lead service', next: 'competitor' },
      { label: 'Can I pay per job instead?', next: 'per_job' },
      { label: 'Let me think about it', next: 'later' },
      { label: 'No', next: 'no' },
    ] },
    { id: 'price', kind: 'say', title: 'The price, plainly', say: `${cpl} a call, only for calls over ${secs}, charged one at a time as they come in — or ${pkgN} for ${pkg} up front, ${pkgEach} each, with the unused part refundable on request. Every charge is a text to you, and there is a statement page you can check any time. You can contest a charge within ${d.disputeWindowHours} hours.`, next: 'offer' },
    { id: 'caller_id', kind: 'say', title: 'Caller ID', say: `Because the call comes through our line, your phone shows the tracking number instead of the customer's. The first thing you hear is us saying it is a customer from the site, then they are on. Answer it like any customer — you get their real number by text right after.`, next: 'offer' },
    { id: 'missed', kind: 'say', title: 'Missed calls', say: f.unanswered > 0
      ? `You pay nothing for a call that rings out — but that customer is gone. On this line ${f.unanswered} of ${f.dials} calls were not answered. The one to pick up is the tracking number.`
      : `You pay nothing for a call that rings out — only for calls you answer that run ${secs} or more. The one to pick up is the tracking number.`, next: 'offer' },
    { id: 'enough', kind: 'say', title: 'They have enough work', say: `Then say no — I would rather hear no than have you resent a bill. The line stays as it is for now, and if it goes quiet you know where I am.`, next: 'no' },
    { id: 'competitor', kind: 'say', title: 'Already paying a lead service', say: `Different thing. They sell the same lead to several shops and you race for it. This line rings only you, and you pay only for calls that actually connected for ${secs}. Keep both if you like — they do not fight.`, next: 'offer' },
    { id: 'per_job', kind: 'say', title: 'Per job instead?', say: `There is a per-job way, and it is honest only when the payment itself runs through us: you take the customer's payment through our link, we take a share of the job, and no call is ever charged. That is not set up for ${f.trade} yet — if you would rather pay that way, tell me and you are first in line. Until then it is per call, and you can contest any call within ${d.disputeWindowHours} hours. A self-reported "that one didn't become a job" cannot be the bill — I would be asking you to charge yourself.`, next: 'offer' },
    { id: 'yes_next', kind: 'end', title: 'Yes — the next one', outcome: 'yes', deal: 'next', say: `Great. I will text you a link to pay the ${cpl} for the next call. The moment it lands, the page shows your name and calls are billed from then on — nothing before that, and each one after is charged as it comes in. After each call you take, you will get one text asking whether it became a job — Y, N or not yet. That is for our records only and never changes a charge.${line}` },
    { id: 'yes_package', kind: 'end', title: `Yes — ${pkgN} for ${pkg}`, outcome: 'yes', deal: 'package', say: `Great. I will text you a link to put the ${pkg} on — that is ${pkgN} calls at ${pkgEach}. The moment it lands, the page shows your name and calls are billed from then on — nothing before that; when it runs low it tops up another ${pkg}, and anything unused is refundable if you ask. After each call you take, you will get one text asking whether it became a job — Y, N or not yet. That is for our records only and never changes a charge.${line}` },
    { id: 'later', kind: 'end', title: 'Later', outcome: 'later', say: `Sure. I will text you the link so it is there when you want it; nothing happens until you use it, and the line keeps forwarding meanwhile.` },
    { id: 'no', kind: 'end', title: 'No', outcome: 'no', say: `No problem. I will keep forwarding for now; if that changes I will text you first.` },
  ];
}

/** BFS levels → rows; a node's column is its index in the row. Pure geometry for the SVG. */
export function layoutScript(nodes: ScriptNode[]): FlowLayout {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const level = new Map<string, number>();
  const queue: string[] = [];
  const start = nodes[0]?.id;
  if (start) { level.set(start, 0); queue.push(start); }
  while (queue.length) {
    const id = queue.shift()!;
    const n = byId.get(id);
    if (!n) continue;
    const nexts = n.kind === 'end' ? [] : n.options ? n.options.map((o) => o.next) : n.next ? [n.next] : [];
    for (const to of nexts) {
      if (!byId.has(to) || level.has(to)) continue;
      level.set(to, (level.get(id) ?? 0) + 1);
      queue.push(to);
    }
  }
  // Terminal nodes go on the last row so every path reads top → bottom.
  const maxLevel = Math.max(0, ...Array.from(level.values()));
  for (const n of nodes) if (n.kind === 'end') level.set(n.id, maxLevel + 1);
  const rows = new Map<number, string[]>();
  for (const n of nodes) {
    const l = level.get(n.id) ?? maxLevel + 1;
    rows.set(l, [...(rows.get(l) ?? []), n.id]);
  }
  const W = 132, H = 40, GX = 12, GY = 56;
  const widest = Math.max(1, ...Array.from(rows.values()).map((r) => r.length));
  const width = widest * (W + GX) + GX;
  const out: FlowLayout['nodes'] = [];
  const sortedRows = Array.from(rows.entries()).sort((a, b) => a[0] - b[0]);
  for (const [l, ids] of sortedRows) {
    const rowWidth = ids.length * (W + GX) - GX;
    const x0 = (width - rowWidth) / 2;
    ids.forEach((id, i) => {
      const n = byId.get(id)!;
      out.push({ id, x: x0 + i * (W + GX), y: GY / 2 + l * (H + GY), w: W, h: H, title: n.title, kind: n.kind, outcome: n.outcome });
    });
  }
  const edges: FlowLayout['edges'] = [];
  for (const n of nodes) {
    if (n.kind === 'end') continue;
    if (n.options) for (const o of n.options) edges.push({ from: n.id, to: o.next, label: o.label });
    else if (n.next) edges.push({ from: n.id, to: n.next, label: null });
  }
  const height = (sortedRows.length) * (H + GY) + GY / 2;
  return { width, height, nodes: out, edges };
}

export function buildPitchPlan(line: LineRow, allPitch: LineRow[], tracking: string | null = null, d = PPL_DEFAULTS): PitchPlan {
  const facts = pitchFacts(line);
  const ordered = rankPitchOrder(allPitch);
  const rank = Math.max(1, ordered.findIndex((l) => l.campaignId === line.campaignId) + 1);
  const first = ordered[0];
  const calls = (n: number) => `${n} paid-grade call${n === 1 ? '' : 's'}`;
  const tied = !!first && first.campaignId !== line.campaignId && first.customerLeads90 === line.customerLeads90;
  const second = ordered[1];
  const tiedAtTop = rank === 1 && !!second && second.customerLeads90 === line.customerLeads90;
  const reason = rank === 1
    ? (ordered.length === 1 ? `the only line with a paid-grade call` : tiedAtTop ? `tied with ${second!.domain} at ${calls(line.customerLeads90)}; the most impressions (${line.impressions28d ?? 0}) breaks the tie` : `the most paid-grade calls (${line.customerLeads90})`)
    : tied
      ? `tied with ${first!.domain} at ${calls(line.customerLeads90)}; it has more impressions (${first!.impressions28d ?? 0} vs ${line.impressions28d ?? 0}) — if you would rather start with the line that has more to fix, start here`
      : `${first?.domain ?? 'another line'} has ${calls(first?.customerLeads90 ?? 0)} to this line's ${line.customerLeads90}`;
  const script = pitchScript(facts, tracking, d);
  return {
    campaignId: line.campaignId,
    templateId: line.templateId,
    facts,
    order: { rank, of: ordered.length, reason },
    advice: pitchAdvice(facts, d),
    deals: DEALS,
    minBillableSeconds: d.minBillableSeconds,
    deal: { cplCents: DEALS.package.cplCents, minBillableSeconds: d.minBillableSeconds, depositCents: DEALS.package.depositCents, reloadThresholdCents: DEALS.package.reloadThresholdCents, reloadAmountCents: DEALS.package.reloadAmountCents, leadsInDeposit: DEALS.package.leads },
    script,
    onYes: [
      `Create the pay-per-call account for ${facts.business} on the deal they took — "${DEALS.next.label}" (${usd(DEALS.next.cplCents)} now, ${usd(DEALS.next.cplCents)} a lead as each posts) or "${DEALS.package.label}" (${usd(DEALS.package.cplCents)} a lead, unused refundable on request) — ${d.minBillableSeconds} s floor either way. The button below does it and hands back the deposit link.`,
      'Text them the deposit link from the server (the button below) — calls connect and bill only after the deposit lands.',
      `Rename the pitch site to ${facts.business} so the page stops asserting a company that does not exist — the editor link below.`,
      'Turn the pay-per-call flag on in production (PPL_ENABLED — an owner action; /status shows the gate).',
    ],
    flow: layoutScript(script),
  };
}

/** Every sentence the script or advice could say — what the honesty test greps. */
export function everySayable(plan: Pick<PitchPlan, 'script' | 'advice' | 'onYes'>): string[] {
  return [...plan.script.map((n) => n.say), ...plan.script.flatMap((n) => (n.options ?? []).map((o) => o.label)), ...plan.advice, ...plan.onYes];
}
