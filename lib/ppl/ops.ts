// lib/ppl/ops.ts
//
// The pay-per-call "machine" as one screen: is each gate open, what is measured, what is
// billed, and what is the next thing a person has to do. Every number here is derived from a
// table at render time — nothing is remembered. The pure parts (pipeline step derivation,
// the 30-day cuts) are exported for tests; `assemblePplOps` is the one I/O function.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { evaluateAllGates, type GateReport } from '@/lib/config/health';
import { callTrackingEnabled } from '@/lib/outreach/callTracking';
import { pplEnabled } from '@/lib/ppl/billing';
import { PPL_DEFAULTS } from '@/lib/ppl/rules';
import type { PplAccount } from '@/lib/ppl/accounts';

export type PplStepStatus = 'done' | 'ready' | 'blocked' | 'waiting';

export type PplStep = {
  n: number;
  title: string;
  who: 'owner' | 'session' | 'clock';
  status: PplStepStatus;
  detail: string;
  href?: string;
};

export type TrackedCampaign = {
  id: string;
  domain: string;
  city: string | null;
  industry_key: string | null;
  rank_status: string | null;
  tracking_number: string | null;
  forward_to: string | null;
  pricing_model: string | null;
  calls_30d: number;
  qualified_30d: number;
  last_call_at: string | null;
  account: Pick<PplAccount, 'id' | 'business_name' | 'status' | 'balance_cents'> | null;
};

export type PplOpsSnapshot = {
  generatedAt: string;
  gates: { sms: GateReport | null; ppl: GateReport | null; geo_rentals: GateReport | null };
  flags: { ppl: boolean; callTracking: boolean };
  stats: {
    campaigns: number;
    campaignsWithNumber: number;
    campaignsPageOne: number;
    calls30d: number;
    qualified30d: number;
    accounts: number;
    accountsActive: number;
    accountsPaused: number;
    balanceTotalCents: number;
    leadCharges30d: number;
    revenue30dCents: number;
    disputeCredits30dCents: number;
    disputesOpen: number;
  };
  accounts: Array<
    PplAccount & { domain: string | null; leads_30d: number; last_charge_at: string | null }
  >;
  campaigns: TrackedCampaign[];
  steps: PplStep[];
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    category: string | null;
  }>;
};

type CallRow = {
  geo_campaign_id: string | null;
  call_duration: number | null;
  created_at: string;
  call_status: string | null;
};

/** 30-day cuts per campaign from raw call rows. Qualified = answered and ≥ the default minimum. */
export function summariseCalls(
  rows: CallRow[],
  nowMs: number,
  minSeconds = PPL_DEFAULTS.minBillableSeconds
) {
  const since = nowMs - 30 * 86_400_000;
  const per = new Map<string, { calls: number; qualified: number; last: string | null }>();
  let calls = 0;
  let qualified = 0;
  for (const r of rows) {
    if (!r.geo_campaign_id) continue;
    const t = Date.parse(r.created_at);
    if (!Number.isFinite(t) || t < since) continue;
    const e = per.get(r.geo_campaign_id) ?? { calls: 0, qualified: 0, last: null };
    e.calls += 1;
    calls += 1;
    const q = (r.call_duration ?? 0) >= minSeconds && (r.call_status ?? '') !== 'dial-no-answer';
    if (q) {
      e.qualified += 1;
      qualified += 1;
    }
    if (!e.last || r.created_at > e.last) e.last = r.created_at;
    per.set(r.geo_campaign_id, e);
  }
  return { per, calls, qualified };
}

/**
 * The §10 sequence with a status derived from what the tables say. `blocked` means an earlier
 * step is not done; `ready` means a person can do it now; `waiting` is the 30-day clock.
 */
export function deriveSteps(input: {
  smsReady: boolean;
  callTracking: boolean;
  pplFlag: boolean;
  campaignsWithNumber: number;
  graftonAttached: boolean;
  calls30d: number;
  accounts: number;
  accountsActive: number;
  leadCharges: number;
}): PplStep[] {
  const s = input;
  const steps: PplStep[] = [];
  steps.push({
    n: 0,
    title: 'Twilio credentials in production',
    who: 'owner',
    status: s.smsReady ? 'done' : 'ready',
    detail: s.smsReady
      ? '/status reports sms: ready'
      : 'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM in Vercel, then redeploy',
    href: '/status',
  });
  steps.push({
    n: 1,
    title: 'Attach 262-228-2491 (graftontowing.com) — logging resumes',
    who: 'session',
    status: s.graftonAttached ? 'done' : s.smsReady ? 'ready' : 'blocked',
    detail: s.graftonAttached
      ? 'campaign row exists with the tracking number'
      : 'campaign row + attach-number action + repoint the voice URL',
  });
  steps.push({
    n: 2,
    title: 'Number shown on the site + "calls answered by" label',
    who: 'session',
    status: s.graftonAttached ? 'ready' : 'blocked',
    detail: 'push tracking_number into the pitch site (all three content copies) and republish',
  });
  steps.push({
    n: 3,
    title: 'One-time SMS notice to the forwarded business + STOP',
    who: 'session',
    status: s.smsReady ? 'ready' : 'blocked',
    detail: 'nothing forwards at scale before this exists',
  });
  steps.push({
    n: 4,
    title: 'Numbers on the cohort (pick-forward-to rule)',
    who: 'owner',
    status: s.campaignsWithNumber > 1 ? 'done' : s.callTracking && s.smsReady ? 'ready' : 'blocked',
    detail: s.callTracking
      ? `${s.campaignsWithNumber} campaign(s) have a number`
      : 'needs CALL_TRACKING_ENABLED=1 + the cohort decision',
    href: '/admin/tasks',
  });
  steps.push({
    n: 5,
    title: '30 days of free forwarding — read the distribution',
    who: 'clock',
    status: s.campaignsWithNumber === 0 ? 'blocked' : s.calls30d > 0 ? 'waiting' : 'waiting',
    detail: `${s.calls30d} calls logged in the last 30 days`,
    href: '/admin/call-logs',
  });
  steps.push({
    n: 6,
    title: 'First account: the Grafton conversation → deposit → PPL_ENABLED=1',
    who: 'owner',
    status:
      s.accountsActive > 0 && s.pplFlag
        ? 'done'
        : s.accounts > 0 || s.graftonAttached
          ? 'ready'
          : 'blocked',
    detail: s.pplFlag ? 'flag on' : `${s.accounts} account(s), flag off`,
  });
  steps.push({
    n: 7,
    title: 'First billed call',
    who: 'clock',
    status: s.leadCharges > 0 ? 'done' : s.accountsActive > 0 && s.pplFlag ? 'waiting' : 'blocked',
    detail:
      s.leadCharges > 0
        ? `${s.leadCharges} lead charge(s) posted`
        : 'a lead_charge row appearing without anyone touching anything',
  });
  return steps;
}

export async function assemblePplOps(nowMs = Date.now()): Promise<PplOpsSnapshot> {
  const gates = evaluateAllGates();
  const gate = (k: string) => gates.find((g) => g.key === k) ?? null;

  const [campaignsRes, accountsRes, ledgerRes, disputesRes, callsRes, tasksRes] = await Promise.all(
    [
      supabaseAdmin
        .from('geo_industry_campaigns')
        .select(
          'id, domain, city, industry_key, rank_status, tracking_number, forward_to, pricing_model'
        )
        .order('rank_status', { ascending: false }),
      supabaseAdmin.from('ppl_accounts').select('*').order('created_at', { ascending: false }),
      supabaseAdmin
        .from('ppl_ledger')
        .select('account_id, kind, amount_cents, created_at')
        .gte('created_at', new Date(nowMs - 30 * 86_400_000).toISOString()),
      supabaseAdmin
        .from('ppl_disputes')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open'),
      supabaseAdmin
        .from('call_logs')
        .select('geo_campaign_id, call_duration, created_at, call_status')
        .gte('created_at', new Date(nowMs - 30 * 86_400_000).toISOString())
        .not('geo_campaign_id', 'is', null),
      supabaseAdmin
        .from('admin_tasks')
        .select('id, title, status, priority, category')
        .eq('source', 'session:2026-09-18')
        .ilike('title', '%PPL%')
        .in('status', ['open', 'in_progress', 'blocked']),
    ]
  );

  const campaignsRaw = (campaignsRes.data ?? []) as Array<
    Omit<TrackedCampaign, 'calls_30d' | 'qualified_30d' | 'last_call_at' | 'account'>
  >;
  const accountsRaw = (accountsRes.data ?? []) as PplAccount[];
  const ledger = (ledgerRes.data ?? []) as Array<{
    account_id: string;
    kind: string;
    amount_cents: number;
    created_at: string;
  }>;
  const calls = summariseCalls((callsRes.data ?? []) as CallRow[], nowMs);

  const byCampaign = new Map(accountsRaw.map((a) => [a.geo_campaign_id, a]));
  const domainByCampaign = new Map(campaignsRaw.map((c) => [c.id, c.domain]));

  const leadsByAccount = new Map<string, { n: number; last: string | null }>();
  let leadCharges30d = 0;
  let revenue30dCents = 0;
  let disputeCredits30dCents = 0;
  for (const l of ledger) {
    if (l.kind === 'lead_charge') {
      leadCharges30d += 1;
      revenue30dCents += -l.amount_cents;
      const e = leadsByAccount.get(l.account_id) ?? { n: 0, last: null };
      e.n += 1;
      if (!e.last || l.created_at > e.last) e.last = l.created_at;
      leadsByAccount.set(l.account_id, e);
    } else if (l.kind === 'dispute_credit') {
      disputeCredits30dCents += l.amount_cents;
    }
  }

  const campaigns: TrackedCampaign[] = campaignsRaw
    .filter((c) => c.tracking_number || c.pricing_model === 'ppl' || byCampaign.has(c.id))
    .map((c) => {
      const a = byCampaign.get(c.id) ?? null;
      const k = calls.per.get(c.id);
      return {
        ...c,
        calls_30d: k?.calls ?? 0,
        qualified_30d: k?.qualified ?? 0,
        last_call_at: k?.last ?? null,
        account: a
          ? {
              id: a.id,
              business_name: a.business_name,
              status: a.status,
              balance_cents: a.balance_cents,
            }
          : null,
      };
    });

  const accounts = accountsRaw.map((a) => ({
    ...a,
    domain: domainByCampaign.get(a.geo_campaign_id) ?? null,
    leads_30d: leadsByAccount.get(a.id)?.n ?? 0,
    last_charge_at: leadsByAccount.get(a.id)?.last ?? null,
  }));

  const campaignsWithNumber = campaignsRaw.filter((c) => !!c.tracking_number).length;
  const graftonAttached = campaignsRaw.some(
    (c) => c.domain === 'graftontowing.com' && !!c.tracking_number
  );
  const smsReady = gate('sms')?.status === 'ready';

  const steps = deriveSteps({
    smsReady,
    callTracking: callTrackingEnabled(),
    pplFlag: pplEnabled(),
    campaignsWithNumber,
    graftonAttached,
    calls30d: calls.calls,
    accounts: accountsRaw.length,
    accountsActive: accountsRaw.filter((a) => a.status === 'active').length,
    leadCharges: leadCharges30d,
  });

  return {
    generatedAt: new Date(nowMs).toISOString(),
    gates: { sms: gate('sms'), ppl: gate('ppl'), geo_rentals: gate('geo_rentals') },
    flags: { ppl: pplEnabled(), callTracking: callTrackingEnabled() },
    stats: {
      campaigns: campaignsRaw.length,
      campaignsWithNumber,
      campaignsPageOne: campaignsRaw.filter((c) => c.rank_status === 'page1').length,
      calls30d: calls.calls,
      qualified30d: calls.qualified,
      accounts: accountsRaw.length,
      accountsActive: accountsRaw.filter((a) => a.status === 'active').length,
      accountsPaused: accountsRaw.filter((a) => a.status === 'paused').length,
      balanceTotalCents: accountsRaw.reduce((s, a) => s + a.balance_cents, 0),
      leadCharges30d,
      revenue30dCents,
      disputeCredits30dCents,
      disputesOpen: disputesRes.count ?? 0,
    },
    accounts,
    campaigns,
    steps,
    tasks: (tasksRes.data ?? []) as PplOpsSnapshot['tasks'],
  };
}
