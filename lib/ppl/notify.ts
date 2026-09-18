// lib/ppl/notify.ts
//
// The messages a pay-per-call account receives. Resend for email, the shared Twilio sender for
// SMS. Best-effort: a notification failure never fails the money step that triggered it.
//
// Copy rules: it is a "prepaid balance", never "escrow" (the funds are not held in escrow — a
// legal term a disputing client's lawyer would test). Leads-remaining is computed from the
// account's OWN lead price. No message promises a feature that does not exist (the draft's
// "web leads are queued and flush on recharge" described code nobody had written).

import { sendEmail } from '@/lib/email';
import { sendSms } from '@/lib/sms/sendSms';
import { estimateLeadsRemaining, usd } from '@/lib/ppl/rules';
import type { PplAccount } from '@/lib/ppl/accounts';

function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string
  );
}

function shell(
  title: string,
  rows: Array<[string, string]>,
  body: string,
  cta?: { href: string; label: string }
) {
  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;font-weight:600">${esc(k)}</td><td style="padding:8px 12px">${esc(v)}</td></tr>`
    )
    .join('');
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <h2 style="font-size:18px">${esc(title)}</h2>
  <p>${esc(body)}</p>
  <table style="width:100%;border-collapse:collapse;background:#f9fafb;margin:16px 0">${table}</table>
  ${cta ? `<p><a href="${esc(cta.href)}" style="background:#111827;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">${esc(cta.label)}</a></p>` : ''}
</div>`;
}

export async function notifyReloaded(
  a: PplAccount,
  args: { amountCents: number; balanceAfterCents: number; paymentIntentId: string }
) {
  if (!a.contact_email) return;
  await sendEmail({
    to: a.contact_email,
    subject: `Balance topped up: ${usd(args.amountCents)} added to ${a.business_name}'s lead account`,
    html: shell(
      'Your prepaid lead balance was topped up',
      [
        ['Amount charged', usd(args.amountCents)],
        ['New balance', usd(args.balanceAfterCents)],
        [
          'Leads that covers',
          `~${estimateLeadsRemaining(args.balanceAfterCents, a.cpl_cents)} at ${usd(a.cpl_cents)} each`,
        ],
        ['Reference', args.paymentIntentId],
      ],
      `Your balance dropped under ${usd(a.reload_threshold_cents)}, so we charged the card on file as you asked. Calls to your number keep connecting.`
    ),
  }).catch(() => {});
}

export async function notifyReloadFailed(
  a: PplAccount,
  args: { amountCents: number; reason: string; updateUrl: string | null }
) {
  const leads = estimateLeadsRemaining(a.balance_cents, a.cpl_cents);
  const body = `We tried to top up your prepaid lead balance by ${usd(args.amountCents)} and the card on file was declined (${args.reason}). You have ${usd(a.balance_cents)} left — about ${leads} more lead${leads === 1 ? '' : 's'}. When it reaches zero, calls to your number stop connecting until the balance is topped up.`;
  const jobs: Promise<unknown>[] = [];
  if (a.contact_email) {
    jobs.push(
      sendEmail({
        to: a.contact_email,
        subject: `Action needed: card declined for ${a.business_name}'s lead balance`,
        html: shell(
          'Your top-up card was declined',
          [
            ['Attempted', usd(args.amountCents)],
            ['Reason', args.reason],
            ['Balance left', `${usd(a.balance_cents)} (~${leads} leads)`],
          ],
          body,
          args.updateUrl ? { href: args.updateUrl, label: 'Update card' } : undefined
        ),
      })
    );
  }
  if (a.contact_phone) {
    jobs.push(
      sendSms(
        a.contact_phone,
        `${a.business_name}: your lead-balance top-up card was declined. ${usd(a.balance_cents)} (~${leads} leads) left before calls stop connecting.${args.updateUrl ? ` Update: ${args.updateUrl}` : ''}`
      )
    );
  }
  await Promise.allSettled(jobs);
}

export async function notifyPaused(a: PplAccount, args: { updateUrl: string | null }) {
  const jobs: Promise<unknown>[] = [];
  const body = `Your prepaid lead balance has reached zero, so calls to your tracking number are no longer being connected. Callers hear that the line is not connecting calls right now and can leave a message. Top up to resume.`;
  if (a.contact_email) {
    jobs.push(
      sendEmail({
        to: a.contact_email,
        subject: `Calls paused: ${a.business_name}'s lead balance is at zero`,
        html: shell(
          'Calls are paused',
          [
            ['Balance', usd(a.balance_cents)],
            ['Status', 'Paused — calls not connecting'],
          ],
          body,
          args.updateUrl ? { href: args.updateUrl, label: 'Top up and resume' } : undefined
        ),
      })
    );
  }
  if (a.contact_phone) {
    jobs.push(
      sendSms(
        a.contact_phone,
        `${a.business_name}: lead balance is at zero, calls are paused.${args.updateUrl ? ` Top up: ${args.updateUrl}` : ''}`
      )
    );
  }
  await Promise.allSettled(jobs);
}

export async function notifyLeadBilled(
  a: PplAccount,
  args: { callerNumber: string | null; durationSeconds: number; balanceAfterCents: number }
) {
  if (!a.contact_phone) return;
  const from = args.callerNumber ? ` from ${args.callerNumber}` : '';
  await sendSms(
    a.contact_phone,
    `${a.business_name}: new lead${from} (${args.durationSeconds}s) — ${usd(a.cpl_cents)} charged. Balance ${usd(args.balanceAfterCents)}.`
  ).catch(() => {});
}
