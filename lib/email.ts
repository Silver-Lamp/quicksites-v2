import { Resend } from 'resend';

/** Normalize base URL once */
const APP_BASE_URL = (process.env.APP_BASE_URL ?? '').replace(/\/+$/, '');
const RESEND = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;                     // optional override
  headers?: Record<string, string>;  // optional provider headers
  /**
   * File attachments. Added for signed agreements: the signer's copy of a contract has to arrive
   * IN their inbox as a file they hold, not as a link back to us — a signing product whose
   * evidence lives only on the vendor's server asks the weaker party to trust the stronger one
   * about what was agreed (crosstalk/contracts/agreements-record.md §2.6).
   */
  attachments?: Array<{ filename: string; content: string | Buffer }>;
};

export async function sendEmail({ to, subject, html, from, headers, attachments }: SendEmailParams) {
  const sender =
    from ??
    process.env.EMAIL_FROM ??
    'QuickSites <noreply@quicksites.ai>';

  if (!RESEND) {
    // Dev fallback: don't send, just log
    console.log('\n[dev-email]\nFROM:', sender, '\nTO:', to, '\nSUBJECT:', subject,
      attachments?.length ? `\nATTACHMENTS: ${attachments.map((a) => a.filename).join(', ')}` : '', '\n');
    return { ok: true, id: 'dev' as const };
  }

  const { data, error } = await RESEND.emails.send({
    from: sender,
    to,
    subject,
    html,
    text: htmlToText(html),
    headers,
    ...(attachments?.length
      ? {
          attachments: attachments.map((a) => ({
            filename: a.filename,
            content: typeof a.content === 'string' ? Buffer.from(a.content, 'utf8') : a.content,
          })),
        }
      : {}),
  });

  if (error) return { ok: false as const, error };
  return { ok: true as const, id: data?.id };
}

/* ------------------------------- WHITE-LABEL -------------------------------- */
// Org-aware email branding (docs/WHITE_LABEL_PLAN.md Slice 1). Reseller orgs send
// under their own display name + support/footer; central orgs stay QuickSites.
// The sending *address* stays on the platform's verified domain for now — only
// the display name changes (per-domain senders are a later additive column).

export type EmailBrand = {
  name: string;         // "Acme Agency" or "QuickSites"
  from: string;         // "Acme Agency <noreply@quicksites.ai>"
  fromAddress: string;  // "noreply@quicksites.ai"
  supportEmail: string; // reply-to / support address
  logoUrl: string | null;
  footer: string;       // "— The Acme Agency Team"
  branded: boolean;
};

/** Pull the bare address out of a "Name <addr>" (or plain "addr") string. */
export function extractEmailAddress(fromLike: string | null | undefined, fallback: string): string {
  if (!fromLike) return fallback;
  const angle = fromLike.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim();
  return fromLike.includes('@') ? fromLike.trim() : fallback;
}

/** Pure brand assembly (no I/O) so the from-string + footer are unit-testable. */
export function buildEmailBrand(input: {
  orgName?: string | null;
  branded: boolean;
  logoUrl?: string | null;
  supportEmail?: string | null;
  envFrom?: string | null;      // process.env.EMAIL_FROM ("Name <addr>" or "addr")
  defaultAddress?: string;      // platform sender address
}): EmailBrand {
  const defaultAddress = input.defaultAddress || 'noreply@quicksites.ai';
  const name = input.branded && input.orgName ? input.orgName : 'QuickSites';
  const fromAddress = extractEmailAddress(input.envFrom, defaultAddress);
  return {
    name,
    from: `${name} <${fromAddress}>`,
    fromAddress,
    supportEmail: input.supportEmail || 'support@quicksites.ai',
    logoUrl: input.branded ? input.logoUrl ?? null : null,
    footer: `— The ${name} Team`,
    branded: input.branded,
  };
}

/**
 * Resolve the current request's org and return its email brand. Reseller orgs
 * (organizations_public.billing_mode === 'reseller') get their own name/support;
 * everyone else stays QuickSites. Server-only (uses resolveOrg → next/headers).
 */
export async function orgEmailBrand(): Promise<EmailBrand> {
  const { resolveOrg } = await import('@/lib/org/resolveOrg');
  const org = await resolveOrg();
  return buildEmailBrand({
    orgName: org.name,
    branded: org.billing_mode === 'reseller',
    logoUrl: org.dark_logo_url || org.logo_url,
    supportEmail: org.support_email,
    // A reseller org can set its own sender address (organizations.email_from) —
    // this only actually sends once that domain is verified in Resend; until then
    // it's null and we fall back to the platform's EMAIL_FROM. See WHITE_LABEL_PLAN.
    envFrom: org.email_from || process.env.EMAIL_FROM,
  });
}

/* --------------------------------- TEMPLATES -------------------------------- */

const escMap: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (m) => escMap[m]);

/** Build a meal URL, preferring the SEO slug if available. */
export function buildMealUrl(opts: { id: string; slug?: string | null; baseUrl?: string }) {
  const base = (opts.baseUrl ?? APP_BASE_URL).replace(/\/+$/, '');
  // Your app appears to serve meal pages at /meals/[slug] — fall back to /meal/[id]
  return opts.slug ? `${base}/meals/${opts.slug}` : `${base}/meal/${opts.id}`;
}

/**
 * Restock email template.
 * Use either:
 *  - { mealTitle, mealUrl, ... }  OR
 *  - { mealTitle, mealId, mealSlug?, appBaseUrl?, ... } and the URL will be built for you.
 */
type RestockByUrl = {
  mealTitle: string;
  mealUrl: string;
  unsubscribeUrl: string;
  siteName?: string;
};
type RestockById = {
  mealTitle: string;
  mealId: string;
  mealSlug?: string | null;
  unsubscribeUrl: string;
  siteName?: string;
  appBaseUrl?: string;
};
type RestockArgs = RestockByUrl | RestockById;

// TODO:
// <h3>Your order was delivered 🎉</h3>
// <p>How was it? Tap to leave a quick rating:</p>
// <p>
//   <a href="{{APP_BASE_URL}}/rv/{{order.review_token}}" style="display:inline-block;padding:10px 16px;border:1px solid #111;border-radius:8px;color:#111;text-decoration:none">
//     Rate your order
//   </a>
// </p>
// <p style="margin-top:8px;">
//   <img src="{{APP_BASE_URL}}/api/public/review/qr/{{order.review_token}}?size=280" alt="Scan to review" width="140" height="140" />
// </p>
export function deliveryEmailTemplate(args: {
  mealUrl: string;
  qrUrl: string;
  unsubscribeUrl: string;
  siteName?: string;
}) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.45;color:#111">
    <h3 style="margin:0 0 8px 0;font-size:20px">Your order was delivered 🎉</h3>
    <p style="margin:0 0 16px 0">How was it? Tap to leave a quick rating:</p>
    <p style="margin:0 0 20px 0">
      <a href="${args.mealUrl}" style="display:inline-block;padding:10px 16px;border:1px solid #111;border-radius:8px;color:#111;text-decoration:none;font-size:14px">
        Rate your order
      </a>
    </p>
    <p style="margin-top:8px;">
      <img src="${args.qrUrl}" alt="Scan to review" width="140" height="140" />
    </p>
  </div>`;
} 

export function restockTemplate(args: RestockArgs) {
  const site = escapeHtml(args.siteName ?? 'QuickSites');

  const mealUrl =
    'mealUrl' in args
      ? args.mealUrl
      : buildMealUrl({ id: args.mealId, slug: args.mealSlug ?? undefined, baseUrl: args.appBaseUrl });

  const title = escapeHtml(args.mealTitle);
  const unsub = args.unsubscribeUrl;

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.45;color:#111">
    <h2 style="margin:0 0 8px 0;font-size:20px">${title} is back in stock!</h2>
    <p style="margin:0 0 16px 0">Good news — the meal you were eyeing is available again on ${site}.</p>

    <p style="margin:0 0 20px 0">
      <a href="${mealUrl}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;border-radius:6px;text-decoration:none">
        Order now
      </a>
    </p>

    <p style="margin:24px 0 0 0;color:#555;font-size:12px">
      Don’t want these emails? <a href="${unsub}">Unsubscribe</a>.
    </p>
  </div>`;
}

/* ------------------------------ small utilities ----------------------------- */

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
