// lib/menu/demand.ts
//
// Demand capture on unclaimed delivered.menu drafts. A visitor "tries to order" from a
// site we auto-built during outreach → we log the *intent* (never money, never held
// funds) and use the count to escalate the claim pitch. Pure data-access over the
// service-role client; the public route (lib/api rate-limited) and the admin surfaces
// call these. See docs/RESTAURANT_VERTICAL.md and lib/flags/menuDemand.ts.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { captureServer } from '@/lib/analytics/posthog-server';
import { EVENTS } from '@/lib/analytics/events';

export type DemandKind = 'call' | 'order_ahead';

export type RecordDemandInput = {
  templateId: string;
  kind: DemandKind;
  /** order_ahead only — who to call back, and how. */
  contactName?: string | null;
  contactPhone?: string | null;
  items?: string | null;
  ip?: string | null;
};

/**
 * Log one order-intent against a draft. Server-authoritative: we re-check the template
 * is a still-claimable `listing_import` draft here (never trust the client that it is),
 * so demand can't be logged against a claimed/arbitrary template. Best-effort — returns
 * an error string on failure rather than throwing, so the beacon/form never breaks the page.
 */
export async function recordDemandEvent(input: RecordDemandInput): Promise<{ ok: boolean; error?: string }> {
  const { templateId, kind } = input;
  if (!templateId) return { ok: false, error: 'missing_template' };

  const { data: tpl, error: loadErr } = await supabaseAdmin
    .from('templates')
    .select('id, claim_source')
    .eq('id', templateId)
    .maybeSingle();
  if (loadErr) return { ok: false, error: 'load_failed' };
  // Only a still-claimable outreach draft accepts demand (mirrors the showClaimBar gate).
  if (!tpl || (tpl as { claim_source?: string | null }).claim_source !== 'listing_import') {
    return { ok: false, error: 'not_claimable' };
  }

  const { error: insErr } = await supabaseAdmin.from('demand_events').insert({
    template_id: templateId,
    kind,
    contact_name: input.contactName?.trim() || null,
    contact_phone: input.contactPhone?.trim() || null,
    items: input.items?.trim() ? input.items.trim() : null,
    created_ip: input.ip ?? null,
  });
  if (insErr) return { ok: false, error: 'insert_failed' };

  // Aggregate visibility — PostHog counts these per draft (distinctId = template_id),
  // so "which drafts are heating up" shows in a dashboard without querying the DB.
  const hasContact = !!(input.contactPhone?.trim() || input.contactName?.trim() || input.items?.trim());
  await captureServer(EVENTS.MENU_DEMAND_CAPTURED, { template_id: templateId, kind, has_contact: hasContact }, templateId);

  return { ok: true };
}

/** Total demand events logged against one draft (0 on any error / missing table). */
export async function getDemandCount(templateId: string): Promise<number> {
  try {
    const { count } = await supabaseAdmin
      .from('demand_events')
      .select('id', { count: 'exact', head: true })
      .eq('template_id', templateId);
    return count ?? 0;
  } catch {
    return 0;
  }
}

/** Per-template demand counts for a set of drafts (for the admin outreach table). */
export async function getDemandCounts(templateIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!templateIds.length) return out;
  try {
    const { data } = await supabaseAdmin
      .from('demand_events')
      .select('template_id')
      .in('template_id', templateIds);
    for (const row of (data as { template_id: string | null }[]) ?? []) {
      if (row.template_id) out[row.template_id] = (out[row.template_id] ?? 0) + 1;
    }
  } catch {
    /* best-effort — table may not be migrated yet */
  }
  return out;
}

/** One actionable order-ahead lead (a visitor who left contact info). */
export type DemandLead = { name: string | null; phone: string | null; items: string | null; at: string | null };

export type DemandDetail = {
  count: number;        // all order-intents
  calls: number;        // tap-to-call events (no contact left)
  leads: DemandLead[];  // order_ahead events that left a phone/name — newest first
  notified: boolean;    // has the restaurant been texted yet (Phase 2)
};

/**
 * Full demand breakdown per draft for the admin outreach surface: the count, how many
 * were anonymous tap-to-calls, and the actual leads (name/phone/items) so an operator
 * can follow up by hand while auto-SMS is off. One query, grouped in memory.
 */
export async function getDemandDetails(templateIds: string[]): Promise<Record<string, DemandDetail>> {
  const out: Record<string, DemandDetail> = {};
  if (!templateIds.length) return out;
  try {
    const { data } = await supabaseAdmin
      .from('demand_events')
      .select('template_id, kind, contact_name, contact_phone, items, notified_at, created_at')
      .in('template_id', templateIds)
      .order('created_at', { ascending: false });
    type Row = {
      template_id: string | null; kind: string | null;
      contact_name: string | null; contact_phone: string | null; items: string | null;
      notified_at: string | null; created_at: string | null;
    };
    for (const row of (data as Row[]) ?? []) {
      const id = row.template_id;
      if (!id) continue;
      const d = (out[id] ??= { count: 0, calls: 0, leads: [], notified: false });
      d.count += 1;
      if (row.notified_at) d.notified = true;
      if (row.contact_phone || row.contact_name || row.items) {
        d.leads.push({ name: row.contact_name, phone: row.contact_phone, items: row.items, at: row.created_at });
      } else {
        d.calls += 1;
      }
    }
  } catch {
    /* best-effort — table may not be migrated yet */
  }
  return out;
}
