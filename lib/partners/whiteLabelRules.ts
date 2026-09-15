// lib/partners/whiteLabelRules.ts
//
// PURE rules for partner self-serve white-label activation — no I/O, so the checklist logic
// and every validation is unit-testable. The data layer is lib/partners/whiteLabel.ts.
//
// ⚠️ WHY THIS EXISTS. docs/WHITE_LABEL_PLAN.md shipped every branded SURFACE (login, join,
// admin chrome, emails) gated on a reseller org — and then nobody could get one: creating the
// org, adding the member, mapping the host, attaching it to Vercel and verifying the sending
// domain were five hand steps in a SQL console plus a middleware edit and a deploy. Zero
// reseller orgs existed on 2026-09-15 when the first partner asked. These rules turn those
// steps into a checklist the partner completes themselves.

/** Hosts a partner may never claim as their portal — ours, the menu surface, previews. */
export const RESERVED_HOST_SUFFIXES = [
  'quicksites.ai',
  'cedarsites.com',
  'pointsevenstudio.com',
  'delivered.menu',
  'deliveredmenu.com',
  'vercel.app',
  'localhost',
];

const HOST_RX = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

/** Bare lowercase hostname or null: strips scheme, path, port, trailing dot. Keeps `www.`. */
export function normalizeHost(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const h = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
  return HOST_RX.test(h) ? h : null;
}

/** True when the host is ours, a preview host, or a bare apex of a reserved domain. */
export function isReservedHost(host: string): boolean {
  const h = host.toLowerCase();
  return RESERVED_HOST_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

/** Is this an apex (example.com) rather than a subdomain (app.example.com)? Heuristic: two labels. */
export function isApexHost(host: string): boolean {
  return host.split('.').length === 2;
}

export type DnsInstruction = { type: 'CNAME' | 'A'; name: string; value: string };

/**
 * What the partner must add at their DNS provider so the host reaches this Vercel project.
 * A subdomain takes a CNAME; an apex cannot (RFC 1034), so it takes Vercel's anycast A record.
 * Values mirror app/api/domains/connect (DEFAULT_A_IPS / DEFAULT_CNAME_TARGETS).
 */
export function dnsInstructionsFor(host: string): DnsInstruction[] {
  if (isApexHost(host)) return [{ type: 'A', name: '@', value: '76.76.21.21' }];
  const label = host.split('.').slice(0, -2).join('.');
  return [{ type: 'CNAME', name: label, value: 'cname.vercel-dns.com' }];
}

/**
 * Org slug from a brand name: lowercase, hyphenated, 3–40 chars. Reserved words get a
 * suffix so a partner named "Admin" cannot shadow a route. Collisions with existing slugs
 * are the caller's job (it has the database); this only shapes the string.
 */
export function orgSlugFromName(name: string, salt = ''): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  const reserved = new Set(['quicksites', 'www', 'app', 'admin', 'api', 'login', 'join', 'partners', 'sites']);
  const core = base.length >= 3 ? base : `brand-${base || 'x'}`;
  const safe = reserved.has(core) ? `${core}-brand` : core;
  return salt ? `${safe}-${salt}` : safe;
}

/** The sender address for a verified sending domain: "Brand <hello@domain>". */
export function emailFromFor(brandName: string, domain: string): string {
  const name = brandName.replace(/[<>"]/g, '').trim() || 'Support';
  return `${name} <hello@${domain.toLowerCase()}>`;
}

export type StepStatus = 'done' | 'pending' | 'todo';

export type WhiteLabelState = {
  org: { slug: string; name: string; support_email: string | null; logo_url: string | null; dark_logo_url: string | null } | null;
  domain: { host: string; verified_at: string | null } | null;
  email: { domain: string; status: string | null } | null;
  payoutsActive: boolean;
  code: string | null;
  /** https origin of the platform, for the fallback share link. */
  platformBase: string;
};

export type WhiteLabelStep = { key: 'brand' | 'domain' | 'email' | 'payouts' | 'share'; status: StepStatus; detail: string };

/**
 * The checklist, in the order a partner should do it. `pending` means "we are waiting on
 * something outside this app" (their DNS, Stripe's review) — the honest state between todo
 * and done, shown as such rather than as a spinner.
 */
export function whiteLabelSteps(s: WhiteLabelState): WhiteLabelStep[] {
  const brandDone = !!s.org && !!s.org.support_email && !!(s.org.logo_url || s.org.dark_logo_url);
  const domainStatus: StepStatus = !s.domain ? 'todo' : s.domain.verified_at ? 'done' : 'pending';
  const emailStatus: StepStatus = !s.email ? 'todo' : s.email.status === 'verified' ? 'done' : 'pending';
  const shareHost = s.domain?.verified_at ? `https://${s.domain.host}` : s.platformBase;
  const shareLink = s.code ? `${shareHost}/join/${encodeURIComponent(s.code)}` : '';
  return [
    {
      key: 'brand',
      status: brandDone ? 'done' : s.org ? 'pending' : 'todo',
      detail: brandDone
        ? `${s.org!.name} — your name and logo replace ours on login, sign-up, the editor and emails.`
        : s.org
          ? 'Add a support email and a logo to finish.'
          : 'Your brand name, a support email and a logo.',
    },
    {
      key: 'domain',
      status: domainStatus,
      detail:
        domainStatus === 'done'
          ? `${s.domain!.host} serves your portal.`
          : domainStatus === 'pending'
            ? `Waiting for DNS at ${s.domain!.host} — add the record below, then check.`
            : 'The address your merchants will use, e.g. app.yourbrand.com.',
    },
    {
      key: 'email',
      status: emailStatus,
      detail:
        emailStatus === 'done'
          ? `Emails to your merchants send from ${s.email!.domain}.`
          : emailStatus === 'pending'
            ? `Waiting for the DNS records for ${s.email!.domain}.`
            : 'Optional: send welcome and order emails from your own domain instead of ours.',
    },
    {
      key: 'payouts',
      status: s.payoutsActive ? 'done' : 'todo',
      detail: s.payoutsActive ? 'Residuals transfer to your Stripe account.' : 'Connect Stripe to receive your residuals.',
    },
    {
      key: 'share',
      status: shareLink && s.domain?.verified_at ? 'done' : 'todo',
      detail: shareLink
        ? `Merchants sign up at ${shareLink}${s.domain?.verified_at ? '' : ' — moves to your domain once it verifies.'}`
        : 'Appears once you have a partner code.',
    },
  ];
}
