// lib/outreach/mail/mailings.ts
//
// Data access for public.postcard_mailings — the record of every physical postcard
// handed to Lob and its USPS delivery status. Written by the send route
// (app/api/admin/prospects/mail-postcards) and advanced by the signed Lob webhook
// (app/api/outreach/webhooks/lob). Service-role only (RLS-denied table), same untyped
// supabaseAdmin convention as lib/outreach/prospects.ts.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { isForwardStatus } from '@/lib/outreach/mail/lobWebhook';

export type PostcardMailing = {
  id: string;
  created_at: string;
  updated_at: string;
  provider: string;
  lob_id: string;
  prospect_id: string | null;
  campaign_id: string | null;
  sent_by: string | null;
  to_name: string | null;
  to_address: string | null;
  status: string;
  expected_delivery_date: string | null;
  carrier: string | null;
  tracking_number: string | null;
  thumbnail_url: string | null;
  pdf_url: string | null;
  events: any[];
  delivered_at: string | null;
  returned_at: string | null;
  scans: number;
  first_scanned_at: string | null;
  last_scanned_at: string | null;
};

const COLS =
  'id, created_at, updated_at, provider, lob_id, prospect_id, campaign_id, sent_by, to_name, to_address, status, expected_delivery_date, carrier, tracking_number, thumbnail_url, pdf_url, events, delivered_at, returned_at, scans, first_scanned_at, last_scanned_at';

/** Record a freshly-mailed piece. Idempotent on lob_id (a retry updates in place). */
export async function recordMailing(m: {
  lobId: string;
  prospectId?: string | null;
  campaignId?: string | null;
  sentBy?: string | null;
  toName?: string | null;
  toAddress?: string | null;
  expectedDeliveryDate?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  thumbnailUrl?: string | null;
  pdfUrl?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('postcard_mailings').upsert(
    {
      provider: 'lob',
      lob_id: m.lobId,
      prospect_id: m.prospectId ?? null,
      campaign_id: m.campaignId ?? null,
      sent_by: m.sentBy ?? null,
      to_name: m.toName ?? null,
      to_address: m.toAddress ?? null,
      status: 'created',
      expected_delivery_date: m.expectedDeliveryDate ?? null,
      carrier: m.carrier ?? null,
      tracking_number: m.trackingNumber ?? null,
      thumbnail_url: m.thumbnailUrl ?? null,
      pdf_url: m.pdfUrl ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'lob_id' },
  );
  if (error) throw new Error(`recordMailing failed: ${error.message}`);
}

/**
 * Advance a mailing's delivery status from a Lob webhook event. Monotonic — a late/
 * out-of-order event never moves the status backwards. Appends the raw event to the log.
 * No-ops (returns false) when the piece isn't found or the transition is backwards.
 */
export async function applyLobEvent(
  lobId: string,
  ev: {
    status: string;
    eventTypeId?: string | null;
    occurredAt?: string | null;
    expectedDeliveryDate?: string | null;
    raw?: unknown;
  },
): Promise<boolean> {
  const { data: existing } = await supabaseAdmin
    .from('postcard_mailings')
    .select('id, status, events')
    .eq('lob_id', lobId)
    .maybeSingle();
  if (!existing) return false;

  const forward = isForwardStatus((existing as any).status, ev.status);
  const now = new Date().toISOString();
  const events = Array.isArray((existing as any).events) ? (existing as any).events : [];
  events.push({ type: ev.eventTypeId ?? ev.status, status: ev.status, at: ev.occurredAt ?? now });

  const patch: Record<string, unknown> = { events, updated_at: now };
  if (forward) patch.status = ev.status;
  if (ev.expectedDeliveryDate) patch.expected_delivery_date = ev.expectedDeliveryDate;
  if (forward && ev.status === 'delivered') patch.delivered_at = ev.occurredAt ?? now;
  if (forward && ev.status === 'returned_to_sender') patch.returned_at = ev.occurredAt ?? now;

  const { error } = await supabaseAdmin.from('postcard_mailings').update(patch).eq('lob_id', lobId);
  if (error) throw new Error(`applyLobEvent failed: ${error.message}`);
  return forward;
}

/**
 * Record a per-prospect QR scan on the latest mailing for (campaign, prospect). Best-
 * effort: no-ops when no matching piece exists (e.g. a generic poster leave-behind).
 */
export async function recordScan(campaignId: string, prospectId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from('postcard_mailings')
    .select('id, scans, first_scanned_at')
    .eq('campaign_id', campaignId)
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return;
  const now = new Date().toISOString();
  await supabaseAdmin
    .from('postcard_mailings')
    .update({
      scans: ((data as any).scans ?? 0) + 1,
      first_scanned_at: (data as any).first_scanned_at ?? now,
      last_scanned_at: now,
      updated_at: now,
    })
    .eq('id', (data as any).id);
}

/** All mailings for a campaign (newest first). */
export async function listMailingsByCampaign(campaignId: string): Promise<PostcardMailing[]> {
  const { data, error } = await supabaseAdmin
    .from('postcard_mailings')
    .select(COLS)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listMailingsByCampaign failed: ${error.message}`);
  return (data ?? []) as PostcardMailing[];
}

export type CampaignMailingSummary = {
  total: number;
  delivered: number;
  inTransit: number;
  returned: number;
  /** # pieces whose per-prospect QR has been scanned at least once. */
  scanned: number;
  /** Latest status keyed by prospect_id (for row badges). */
  byProspect: Record<string, { status: string; expectedDeliveryDate: string | null; scans: number }>;
};

/** Roll up mailing status per campaign for the admin surfaces. */
export async function mailingSummaryForCampaigns(
  campaignIds: string[],
): Promise<Record<string, CampaignMailingSummary>> {
  const clean = [...new Set(campaignIds.filter(Boolean))];
  if (!clean.length) return {};
  const { data, error } = await supabaseAdmin
    .from('postcard_mailings')
    .select('campaign_id, prospect_id, status, expected_delivery_date, scans, created_at')
    .in('campaign_id', clean)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`mailingSummaryForCampaigns failed: ${error.message}`);

  const out: Record<string, CampaignMailingSummary> = {};
  for (const id of clean) out[id] = { total: 0, delivered: 0, inTransit: 0, returned: 0, scanned: 0, byProspect: {} };
  for (const r of (data as any[]) ?? []) {
    const s = out[r.campaign_id];
    if (!s) continue;
    s.total += 1;
    if ((r.scans ?? 0) > 0) s.scanned += 1;
    if (r.status === 'delivered') s.delivered += 1;
    else if (r.status === 'returned_to_sender' || r.status === 'failed') s.returned += 1;
    else if (['in_transit', 'in_local_area', 'processed_for_delivery', 're_routed'].includes(r.status)) s.inTransit += 1;
    // rows are newest-first → first seen per prospect is the latest.
    if (r.prospect_id && !s.byProspect[r.prospect_id]) {
      s.byProspect[r.prospect_id] = { status: r.status, expectedDeliveryDate: r.expected_delivery_date ?? null, scans: r.scans ?? 0 };
    }
  }
  return out;
}
