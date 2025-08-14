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
};

export async function sendEmail({ to, subject, html, from, headers }: SendEmailParams) {
  const sender =
    from ??
    process.env.EMAIL_FROM ??
    'delivered.menu <noreply@your-domain.com>';

  if (!RESEND) {
    // Dev fallback: don't send, just log
    console.log('\n[dev-email]\nFROM:', sender, '\nTO:', to, '\nSUBJECT:', subject, '\n');
    return { ok: true, id: 'dev' as const };
  }

  const { data, error } = await RESEND.emails.send({
    from: sender,
    to,
    subject,
    html,
    text: htmlToText(html),
    headers,
  });

  if (error) return { ok: false as const, error };
  return { ok: true as const, id: data?.id };
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
  const site = escapeHtml(args.siteName ?? 'delivered.menu');

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
