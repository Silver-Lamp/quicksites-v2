// lib/commerce/orderNotify.ts
//
// Tell the restaurant an order came in.
//
// ⚠️ WHY THIS DID NOT EXIST, AND WHY THAT WAS THE WHOLE PRODUCT MISSING. `markOrderPaid` recorded
// tax, settled stock, upserted the buyer into the CRM, wrote the commission ledger and queued print
// fulfilment — every step that serves US — and never told the merchant. Their only route to an order
// was to open /merchant/orders and look. A kitchen mid-rush does not refresh a dashboard, which is
// exactly why every delivery platform ships a device that makes a noise.
//
// ⚠️ THE RECIPIENT IS DERIVED SERVER-SIDE FROM THE ORDER. Never from a request body, never from the
// Stripe payload. This repo has already shipped that bug once: `send-contact-email` took its `to`
// from the caller and was an open relay until #268 derived it from `site_slug`. The rule is the
// same here — an email address that arrives with the thing that triggers the send is not evidence
// of anything.
//
// ⚠️ BEST-EFFORT, NEVER THROWS. It runs inside the paid transition. A failed alert must not roll
// back a captured payment or make Stripe retry a webhook that already did its real work. It records
// the failure instead, so a silent non-delivery is still visible afterwards.
import { sendEmail } from '@/lib/email';
import { sendSms } from '@/lib/sms/sendSms';

export type OrderAlertLine = { title: string; quantity: number; totalCents: number };

export type OrderAlertInput = {
  orderId: string;
  merchantId: string | null;
  siteSlug: string | null;
  totalCents: number;
  currency?: string | null;
  lines: OrderAlertLine[];
  customerName?: string | null;
  customerPhone?: string | null;
  /** Absolute URL of the merchant orders screen. */
  ordersUrl: string;
};

export function money(cents: number, currency = 'usd'): string {
  const n = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

/**
 * Subject line. The order total and the shop go in the SUBJECT because a phone lockscreen shows
 * roughly forty characters and nothing else — an alert whose useful content is in the body is a
 * notification that someone has to open a laptop to read.
 */
export function alertSubject(input: OrderAlertInput): string {
  const where = input.siteSlug ? ` — ${input.siteSlug}` : '';
  return `New order ${money(input.totalCents, input.currency ?? 'usd')}${where}`;
}

export function alertHtml(input: OrderAlertInput): string {
  const rows = input.lines
    .map(
      (l) =>
        `<tr><td style="padding:6px 0;">${escapeHtml(String(l.quantity))}× ${escapeHtml(l.title)}</td>` +
        `<td style="padding:6px 0;text-align:right;white-space:nowrap;">${money(l.totalCents, input.currency ?? 'usd')}</td></tr>`
    )
    .join('');

  // ⚠️ Plain, boring HTML on purpose. This is read on a phone in a kitchen, often on a cracked
  // screen in bad light. No hero image, no brand chrome, nothing that pushes the items below the
  // fold. The items ARE the message.
  return [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;">',
    `<h2 style="margin:0 0 4px;font-size:20px;">New order — ${money(input.totalCents, input.currency ?? 'usd')}</h2>`,
    input.siteSlug
      ? `<p style="margin:0 0 14px;color:#555;">${escapeHtml(input.siteSlug)}</p>`
      : '',
    '<table style="width:100%;border-collapse:collapse;font-size:15px;">',
    rows || '<tr><td style="padding:6px 0;color:#777;">(no line items recorded)</td></tr>',
    '</table>',
    `<p style="margin:14px 0 0;padding-top:10px;border-top:1px solid #e5e5e5;font-size:16px;"><strong>Total ${money(
      input.totalCents,
      input.currency ?? 'usd'
    )}</strong></p>`,
    input.customerName
      ? `<p style="margin:10px 0 0;">Customer: ${escapeHtml(input.customerName)}</p>`
      : '',
    input.customerPhone
      ? `<p style="margin:2px 0 0;">Phone: <a href="tel:${escapeHtml(input.customerPhone)}">${escapeHtml(
          input.customerPhone
        )}</a></p>`
      : '',
    `<p style="margin:18px 0 0;"><a href="${escapeHtml(input.ordersUrl)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">View the order</a></p>`,
    // ⚠️ Says what this alert is NOT. The merchant has no accept/ready workflow yet, and an email
    // that implies one would have a kitchen waiting for a button that does not exist.
    '<p style="margin:16px 0 0;font-size:12px;color:#888;">This is a notification only — the order is already paid. There is nothing to confirm.</p>',
    '</div>',
  ]
    .filter(Boolean)
    .join('');
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Resolve who to alert: the merchant's override, else their account email.
 *
 * Returns null when neither exists — a merchant with no reachable address is a real state (an
 * operator-created merchant row), and the caller records the miss rather than inventing a fallback.
 * Alerting `ADMIN_EMAILS` "just in case" would send a stranger's order details to us.
 */
export async function resolveAlertRecipient(
  supabase: any,
  merchantId: string | null
): Promise<string | null> {
  if (!merchantId) return null;
  const { data: m } = await supabase
    .from('merchants')
    .select('order_notify_email, user_id')
    .eq('id', merchantId)
    .maybeSingle();
  if (!m) return null;

  const override = String(m.order_notify_email ?? '').trim();
  if (override) return override;

  if (!m.user_id) return null;
  try {
    const { data } = await supabase.auth.admin.getUserById(m.user_id);
    const email = String(data?.user?.email ?? '').trim();
    return email || null;
  } catch {
    return null;
  }
}

/**
 * The text a kitchen gets. Deliberately tiny.
 *
 * ⚠️ ONE SEGMENT (160 chars) OR IT COSTS DOUBLE AND WRAPS BADLY. This is read on a lockscreen
 * between orders — the total and the shop are the whole message, and the link exists only because
 * someone will want the detail. Same linkification rule as outreach: a full https:// URL, never a
 * bare host (see lib/outreach/__tests__/messageLinks.test.ts).
 */
export function alertSms(input: OrderAlertInput): string {
  const where = input.siteSlug ? ` for ${input.siteSlug}` : '';
  const n = input.lines.reduce((t, l) => t + (Number(l.quantity) || 0), 0);
  const items = n ? `${n} item${n === 1 ? '' : 's'}, ` : '';
  return `New order${where}: ${items}${money(input.totalCents, input.currency ?? 'usd')}. ${input.ordersUrl}`;
}

/**
 * Text the kitchen, if we can.
 *
 * ⚠️ THREE OUTCOMES, NOT TWO. Not-attempted (no number, or Twilio unconfigured) is a different
 * fact from failed, and collapsing them into `sms_error` would make an unconfigured deploy look
 * like a broken one — the alert equivalent of a soft 404.
 */
async function trySms(
  supabase: any,
  input: OrderAlertInput,
  merchantId: string | null
): Promise<void> {
  if (!merchantId) return;
  const { data: m } = await supabase
    .from('merchants')
    .select('order_notify_sms')
    .eq('id', merchantId)
    .maybeSingle();
  const to = String(m?.order_notify_sms ?? '').trim();
  if (!to) return; // not attempted — leave both columns null

  const res = await sendSms(to, alertSms(input));
  await supabase
    .from('order_alerts')
    .update(
      res.ok
        ? { sms_sent_at: new Date().toISOString(), sms_recipient: to }
        : { sms_error: String(res.error ?? 'send_failed').slice(0, 300), sms_recipient: to }
    )
    .eq('order_id', input.orderId);
}

export type AlertResult =
  | { sent: true; recipient: string }
  | { sent: false; reason: 'already_alerted' | 'no_recipient' | 'send_failed'; detail?: string };

/**
 * Send the alert, exactly once per order.
 *
 * Idempotency is the `order_alerts` primary key, not a check-then-write: two concurrent webhook
 * deliveries both pass a `select` and both send. The insert happens FIRST and a duplicate-key error
 * means someone else already owns this alert.
 */
export async function sendOrderAlert(supabase: any, input: OrderAlertInput): Promise<AlertResult> {
  const recipient = await resolveAlertRecipient(supabase, input.merchantId);

  // Claim the alert before sending. On a duplicate key, another delivery already has it.
  const { error: claimErr } = await supabase
    .from('order_alerts')
    .insert({ order_id: input.orderId, channel: 'email', recipient });
  if (claimErr) {
    const dup =
      String(claimErr.code) === '23505' || /duplicate|unique/i.test(String(claimErr.message));
    if (dup) return { sent: false, reason: 'already_alerted' };
    // Ledger unavailable (migration not applied). Do NOT send: an un-ledgered alert is one we
    // cannot stop repeating on the next retry.
    return { sent: false, reason: 'send_failed', detail: claimErr.message };
  }

  if (!recipient) {
    await supabase
      .from('order_alerts')
      .update({ error: 'no_recipient' })
      .eq('order_id', input.orderId);
    return { sent: false, reason: 'no_recipient' };
  }

  try {
    await sendEmail({
      to: recipient,
      subject: alertSubject(input),
      html: alertHtml(input),
    });
    // Best-effort second channel. The email already succeeded, so a failing text must not turn
    // this into a failure — a kitchen that got the email is not un-alerted.
    try {
      await trySms(supabase, input, input.merchantId);
    } catch {
      /* recorded in sms_error by trySms where possible; never escalates */
    }
    return { sent: true, recipient };
  } catch (e: any) {
    const detail = e?.message || String(e);
    await supabase
      .from('order_alerts')
      .update({ error: detail.slice(0, 500) })
      .eq('order_id', input.orderId);
    return { sent: false, reason: 'send_failed', detail };
  }
}
