// lib/crm/campaigns.ts
//
// CRM Phase 3 campaign engine: resolve a segment to an audience and send an email
// blast, gated on marketing_consent, with a per-recipient unsubscribe link and
// per-send logging. `svc` is a service-role Supabase client (crm_campaigns is
// deny-default RLS). The caller owns authorization (requireMerchantOwner).

import { sendEmail, orgEmailBrand } from '@/lib/email';
import { matchesSegment, type Segment } from '@/lib/crm/segments';
import { mintUnsubToken } from '@/lib/crm/unsubToken';

// Synchronous send cap for the MVP (each send is a Resend round-trip; the route runs
// with maxDuration=60). Larger audiences should narrow the segment or wait for the
// outbox-drain path. We log + refuse rather than silently truncating a blast.
export const MAX_SYNC_RECIPIENTS = 250;

export type Recipient = { id: string; email: string; name: string | null };

/**
 * Resolve a segment (+ optional tag) to the deliverable audience: the merchant's
 * customers who match the segment AND have marketing_consent — consent is ALWAYS
 * required for a marketing send, regardless of segment. Bounded fetch + in-JS filter
 * (mirrors the customer-list predicates via the shared segments module).
 */
export async function resolveAudience(
  svc: any,
  merchantId: string,
  opts: { seg: Segment; tag?: string | null },
  now = Date.now(),
): Promise<Recipient[]> {
  const { data } = await svc
    .from('customers')
    .select('id, email, name, marketing_consent, orders_count, last_order_at, tags')
    .eq('merchant_id', merchantId)
    .eq('marketing_consent', true)
    .limit(5000);

  const tag = opts.tag?.trim() || null;
  const out: Recipient[] = [];
  for (const c of (data ?? []) as any[]) {
    if (!c.email) continue;
    if (!matchesSegment(c, opts.seg, now)) continue;
    if (tag && !(Array.isArray(c.tags) ? c.tags : []).includes(tag)) continue;
    out.push({ id: c.id, email: c.email, name: c.name ?? null });
  }
  return out;
}

const escMap: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s: string) => String(s).replace(/[&<>"']/g, (m) => escMap[m]);

/** Render the campaign body (plain text w/ paragraphs) into a branded HTML email. */
export function renderCampaignHtml(opts: {
  body: string;
  unsubscribeUrl: string;
  footer: string;
  recipientName?: string | null;
}): string {
  const paras = String(opts.body)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px 0">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.5;color:#111;max-width:560px">
    ${paras}
    <p style="margin:24px 0 0 0;color:#555;font-size:12px">${escapeHtml(opts.footer)}</p>
    <p style="margin:8px 0 0 0;color:#888;font-size:12px">
      Don’t want these emails? <a href="${opts.unsubscribeUrl}">Unsubscribe</a>.
    </p>
  </div>`;
}

function baseUrl(): string {
  return (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://quicksites.ai').replace(/\/+$/, '');
}

/** Send `subject`/`body` to an explicit recipient list, logging each send row. */
export async function sendToRecipients(
  svc: any,
  opts: { campaignId: string; subject: string; body: string; recipients: Recipient[] },
): Promise<{ sent: number; failed: number }> {
  const brand = await orgEmailBrand();
  const base = baseUrl();
  let sent = 0;
  let failed = 0;

  for (const r of opts.recipients) {
    const unsubscribeUrl = `${base}/api/crm/unsubscribe?token=${encodeURIComponent(mintUnsubToken(r.id))}`;
    const html = renderCampaignHtml({ body: opts.body, unsubscribeUrl, footer: brand.footer, recipientName: r.name });
    let ok = false;
    let error: string | null = null;
    let providerMessageId: string | null = null;
    try {
      const res = await sendEmail({
        to: r.email,
        subject: opts.subject,
        html,
        from: brand.from,
        headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
      });
      ok = (res as any)?.ok !== false;
      // Resend's email id — correlates this send to its open/click webhook events.
      providerMessageId = (res as any)?.id ?? null;
      if (!ok) error = JSON.stringify((res as any)?.error ?? 'send failed').slice(0, 500);
    } catch (e: any) {
      error = String(e?.message || e).slice(0, 500);
    }
    if (ok) sent++; else failed++;
    // Best-effort per-send log; a logging failure must not abort the blast.
    await svc.from('crm_campaign_sends').insert({
      campaign_id: opts.campaignId,
      customer_id: r.id,
      email: r.email,
      status: ok ? 'sent' : 'failed',
      error,
      provider_message_id: providerMessageId,
    }).then(() => {}, () => {});
  }
  return { sent, failed };
}
