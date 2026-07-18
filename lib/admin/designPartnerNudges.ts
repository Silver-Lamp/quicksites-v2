// lib/admin/designPartnerNudges.ts
//
// Nudge logic for the Design Partners CRM — pure functions the daily cron uses to decide who needs
// attention: an overdue/soon next-step date, or an in-progress partner that's gone quiet (no nudge
// in N days). Keeps the "track forward progress with nudges" goal automatic instead of manual.
// Pure + import-light so it's unit-tested; the cron wraps it with email + dedup.

import type { DesignPartner, PartnerStatus } from '@/lib/admin/designPartners';

export const NUDGES_ENABLED = () =>
  process.env.DESIGN_PARTNER_NUDGES_ENABLED === '1' ||
  process.env.DESIGN_PARTNER_NUDGES_ENABLED === 'true';

export const STALE_DAYS = () => Number(process.env.DESIGN_PARTNER_NUDGE_STALE_DAYS ?? '7') || 7;
/** How soon a due date counts as "due soon" (days). */
export const DUE_SOON_DAYS = () =>
  Number(process.env.DESIGN_PARTNER_NUDGE_DUE_SOON_DAYS ?? '3') || 3;

export type NudgeReason = 'overdue' | 'due_soon' | 'stale' | 'never_touched';
export type PartnerNudge = {
  id: string;
  name: string;
  status: PartnerStatus;
  nextStep?: string;
  reasons: NudgeReason[];
  /** Higher = more urgent (overdue > due soon > stale). */
  priority: number;
};

// Statuses that are "in the pipeline" and worth nudging when they go quiet. Paused is intentionally
// dormant; active partners are already using it (their nudges are opportunistic, not stale-chasing).
const IN_PROGRESS: PartnerStatus[] = ['contacted', 'engaged'];

const daysBetween = (a: number, b: number) => Math.floor((a - b) / 86400000);

/**
 * Compute who needs a nudge. `nowMs` + thresholds are injectable for tests.
 * - overdue: nextStepDue is in the past.
 * - due_soon: nextStepDue within `dueSoonDays`.
 * - stale: in-progress + last nudged (or, if never, that's `never_touched`) more than `staleDays` ago.
 */
export function computeNudges(
  partners: DesignPartner[],
  opts: { nowMs: number; staleDays?: number; dueSoonDays?: number } = { nowMs: Date.now() }
): PartnerNudge[] {
  const now = opts.nowMs;
  const staleDays = opts.staleDays ?? STALE_DAYS();
  const dueSoonDays = opts.dueSoonDays ?? DUE_SOON_DAYS();
  const out: PartnerNudge[] = [];

  for (const p of partners) {
    if (p.status === 'paused') continue;
    const reasons: NudgeReason[] = [];
    let priority = 0;

    if (p.nextStepDue) {
      const due = Date.parse(p.nextStepDue);
      if (Number.isFinite(due)) {
        const d = daysBetween(due, now); // negative = past
        if (d < 0) {
          reasons.push('overdue');
          priority = Math.max(priority, 3);
        } else if (d <= dueSoonDays) {
          reasons.push('due_soon');
          priority = Math.max(priority, 2);
        }
      }
    }

    if (IN_PROGRESS.includes(p.status)) {
      if (!p.lastNudgedAt) {
        reasons.push('never_touched');
        priority = Math.max(priority, 1);
      } else {
        const last = Date.parse(p.lastNudgedAt);
        if (Number.isFinite(last) && daysBetween(now, last) >= staleDays) {
          reasons.push('stale');
          priority = Math.max(priority, 1);
        }
      }
    }

    if (reasons.length)
      out.push({
        id: p.id,
        name: p.name,
        status: p.status,
        nextStep: p.nextStep,
        reasons,
        priority,
      });
  }

  return out.sort((a, b) => b.priority - a.priority);
}

const REASON_LABEL: Record<NudgeReason, string> = {
  overdue: 'next step OVERDUE',
  due_soon: 'next step due soon',
  stale: `no movement in ${'{n}'} days`,
  never_touched: 'in progress, never nudged',
};

/** One-line human summary of a nudge (for the email digest). */
export function nudgeLine(n: PartnerNudge, staleDays = STALE_DAYS()): string {
  const reasons = n.reasons
    .map((r) =>
      r === 'stale' ? REASON_LABEL.stale.replace('{n}', String(staleDays)) : REASON_LABEL[r]
    )
    .join(', ');
  return `${n.name} (${n.status}) — ${reasons}${n.nextStep ? ` · next: ${n.nextStep}` : ''}`;
}
