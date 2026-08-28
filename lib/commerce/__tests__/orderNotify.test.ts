/**
 * @jest-environment node
 */
// The alert that tells a restaurant food needs cooking.
//
// The properties under test are about WHO gets told and HOW OFTEN — not formatting. A duplicate
// alert teaches a kitchen to distrust the first one, and a wrong recipient sends a stranger's order
// details to whoever asked.
import {
  alertSubject,
  alertHtml,
  money,
  resolveAlertRecipient,
  sendOrderAlert,
} from '../orderNotify';

jest.mock('@/lib/email', () => ({ sendEmail: jest.fn(async () => ({ id: 'e1' })) }));
jest.mock('@/lib/sms/sendSms', () => ({ sendSms: jest.fn(async () => ({ ok: true })) }));
const { sendEmail } = jest.requireMock('@/lib/email');
const { sendSms } = jest.requireMock('@/lib/sms/sendSms');

const input = {
  orderId: 'o1',
  merchantId: 'm1',
  siteSlug: 'rays-real-pizza',
  totalCents: 4285,
  currency: 'usd',
  lines: [
    { title: 'Large Pepperoni', quantity: 1, totalCents: 2195 },
    { title: 'Garlic Knots', quantity: 2, totalCents: 1090 },
  ],
  ordersUrl: 'https://www.quicksites.ai/merchant/orders',
};

/** Minimal supabase double: per-table queues + an insert log. */
function db(opts: { merchant?: any; email?: string | null; insertError?: any } = {}) {
  const inserted: any[] = [];
  const updated: any[] = [];
  return {
    inserted,
    updated,
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({
                  data: table === 'merchants' ? (opts.merchant ?? null) : null,
                }),
              };
            },
          };
        },
        insert: async (row: any) => {
          inserted.push({ table, row });
          return { error: opts.insertError ?? null };
        },
        update(patch: any) {
          return {
            eq: async () => {
              updated.push({ table, patch });
              return { error: null };
            },
          };
        },
      };
    },
    auth: {
      admin: { getUserById: async () => ({ data: { user: { email: opts.email ?? null } } }) },
    },
  } as any;
}

beforeEach(() => {
  sendEmail.mockClear();
  sendSms.mockClear();
  sendSms.mockResolvedValue({ ok: true });
});

describe('the subject line', () => {
  // A phone lockscreen shows ~40 characters. An alert whose useful content is in the body is a
  // notification you have to open a laptop to read.
  it('leads with the money and the shop', () => {
    expect(alertSubject(input as any)).toBe('New order $42.85 — rays-real-pizza');
  });

  it('survives a missing slug', () => {
    expect(alertSubject({ ...input, siteSlug: null } as any)).toBe('New order $42.85');
  });

  it('formats cents without floating-point drift', () => {
    expect(money(4285)).toBe('$42.85');
    expect(money(0)).toBe('$0.00');
    expect(money(100000)).toBe('$1,000.00');
  });
});

describe('the body', () => {
  it('lists every line with quantity', () => {
    const html = alertHtml(input as any);
    expect(html).toContain('1× Large Pepperoni');
    expect(html).toContain('2× Garlic Knots');
    expect(html).toContain('$42.85');
  });

  // ⚠️ There is no accept/ready workflow yet. An email implying one leaves a kitchen waiting for a
  // button that does not exist.
  it('says there is nothing to confirm, because there is nothing to confirm', () => {
    expect(alertHtml(input as any)).toContain('nothing to confirm');
  });

  it('escapes a business name that contains markup', () => {
    const html = alertHtml({
      ...input,
      lines: [{ title: '<script>x</script>', quantity: 1, totalCents: 100 }],
    } as any);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('does not invent line items when none were recorded', () => {
    expect(alertHtml({ ...input, lines: [] } as any)).toContain('no line items recorded');
  });
});

describe('who gets told', () => {
  it('prefers the merchant override', async () => {
    const s = db({
      merchant: { order_notify_email: 'kitchen@rays.com', user_id: 'u1' },
      email: 'owner@rays.com',
    });
    expect(await resolveAlertRecipient(s, 'm1')).toBe('kitchen@rays.com');
  });

  // The person who signs up is often not the person standing at the counter — but with no override
  // set, alerting must still work with zero setup.
  it('falls back to the account email', async () => {
    const s = db({
      merchant: { order_notify_email: null, user_id: 'u1' },
      email: 'owner@rays.com',
    });
    expect(await resolveAlertRecipient(s, 'm1')).toBe('owner@rays.com');
  });

  // ⚠️ No fallback to ADMIN_EMAILS. That would mail a stranger's order details to us.
  it('returns null rather than inventing a recipient', async () => {
    expect(await resolveAlertRecipient(db({ merchant: { user_id: null } }), 'm1')).toBeNull();
    expect(await resolveAlertRecipient(db({ merchant: null }), 'm1')).toBeNull();
    expect(await resolveAlertRecipient(db(), null)).toBeNull();
  });
});

describe('exactly once', () => {
  it('sends when the order is new', async () => {
    const s = db({ merchant: { order_notify_email: 'kitchen@rays.com' } });
    const res = await sendOrderAlert(s, input as any);
    expect(res).toEqual({ sent: true, recipient: 'kitchen@rays.com' });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  // ⚠️ Stripe retries webhooks and markOrderPaid is deliberately re-runnable. A second buzz for an
  // order already cooked is worse than none — it teaches the kitchen to distrust the first.
  it('does not send twice when the ledger row already exists', async () => {
    const s = db({
      merchant: { order_notify_email: 'k@r.com' },
      insertError: { code: '23505', message: 'duplicate key' },
    });
    expect(await sendOrderAlert(s, input as any)).toEqual({
      sent: false,
      reason: 'already_alerted',
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  // ⚠️ Claim-then-send, not check-then-send: two concurrent deliveries both pass a `select`.
  it('claims the ledger row BEFORE sending', async () => {
    const s = db({ merchant: { order_notify_email: 'k@r.com' } });
    await sendOrderAlert(s, input as any);
    expect(s.inserted[0].table).toBe('order_alerts');
    expect(s.inserted[0].row.order_id).toBe('o1');
  });

  // If the ledger is unavailable (migration unapplied) we must NOT send — an un-ledgered alert is
  // one nothing can stop repeating on the next retry.
  it('refuses to send when the ledger cannot be written', async () => {
    const s = db({
      merchant: { order_notify_email: 'k@r.com' },
      insertError: { code: '42P01', message: 'no such table' },
    });
    const res = await sendOrderAlert(s, input as any);
    expect(res.sent).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('records a non-delivery instead of failing silently', async () => {
    const s = db({ merchant: { user_id: null } });
    expect(await sendOrderAlert(s, input as any)).toEqual({ sent: false, reason: 'no_recipient' });
    expect(s.updated.find((u: any) => u.patch.error === 'no_recipient')).toBeTruthy();
  });

  it('never throws when the mail provider fails', async () => {
    sendEmail.mockRejectedValueOnce(new Error('resend down'));
    const s = db({ merchant: { order_notify_email: 'k@r.com' } });
    const res = await sendOrderAlert(s, input as any);
    expect(res).toMatchObject({ sent: false, reason: 'send_failed' });
    expect(s.updated.some((u: any) => /resend down/.test(u.patch.error ?? ''))).toBe(true);
  });
});

// ── SMS: the second channel ────────────────────────────────────────────────────────────────────
import { alertSms } from '../orderNotify';

describe('the text message', () => {
  // ⚠️ One segment (160 chars) or it costs double and wraps badly on a lockscreen.
  it('fits in a single SMS segment', () => {
    expect(alertSms(input as any).length).toBeLessThanOrEqual(160);
  });

  it('leads with the money and carries a tappable full URL', () => {
    const t = alertSms(input as any);
    expect(t).toContain('$42.85');
    expect(t).toContain('rays-real-pizza');
    // Same rule as outreach: a bare host does not linkify on a phone.
    expect(t).toMatch(/https:\/\//);
  });

  it('counts items rather than listing them', () => {
    expect(alertSms(input as any)).toContain('3 items');
  });
});

describe('when SMS is or is not possible', () => {
  it('texts the number on file after the email succeeds', async () => {
    const s = db({ merchant: { order_notify_email: 'k@r.com', order_notify_sms: '+15551234567' } });
    await sendOrderAlert(s, input as any);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(sendSms.mock.calls[0][0]).toBe('+15551234567');
  });

  // ⚠️ Three outcomes, not two. No number on file is NOT a failure — leaving both columns null
  // keeps "not attempted" distinguishable from "tried and broke".
  it('does not attempt SMS when no number is on file', async () => {
    const s = db({ merchant: { order_notify_email: 'k@r.com' } });
    await sendOrderAlert(s, input as any);
    expect(sendSms).not.toHaveBeenCalled();
    expect(s.updated.some((u: any) => 'sms_error' in u.patch)).toBe(false);
  });

  // The email already landed. A kitchen that got the email is not un-alerted.
  it('still reports success when the text fails', async () => {
    sendSms.mockResolvedValueOnce({ ok: false, error: 'sms_not_configured' });
    const s = db({ merchant: { order_notify_email: 'k@r.com', order_notify_sms: '+15551234567' } });
    const res = await sendOrderAlert(s, input as any);
    expect(res).toEqual({ sent: true, recipient: 'k@r.com' });
    expect(s.updated.some((u: any) => u.patch.sms_error === 'sms_not_configured')).toBe(true);
  });

  it('never lets an SMS throw break the paid transition', async () => {
    sendSms.mockRejectedValueOnce(new Error('twilio exploded'));
    const s = db({ merchant: { order_notify_email: 'k@r.com', order_notify_sms: '+15551234567' } });
    await expect(sendOrderAlert(s, input as any)).resolves.toMatchObject({ sent: true });
  });
});
