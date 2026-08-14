import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { GUEST_BUILD_ENABLED } from '@/lib/flags/guestBuild';
import {
  menuEnabled,
  isMenuHost,
  isMenuApexHost,
  menuSubdomainSlug,
  menuPathSlug,
  apexRedirectTarget,
} from '@/lib/menu/deliveredMenu';
import {
  yardSaleEnabled,
  isYardSaleHost,
  isYardSaleApexHost,
  yardSaleSubdomainCode,
  yardSaleCodeFromPath,
  isYardSaleApexPage,
} from '@/lib/garageSales/yardSaleSites';
import {
  lemonYumEnabled,
  isLemonYumHost,
  isLemonYumApexHost,
  lemonYumSubdomainSlug,
  lemonYumPathSlug,
} from '@/lib/lemonade/lemonYum';
import { PUBLIC_PATH_HEADER } from '@/lib/seo/canonicalUrl';

/**
 * Carry the path the visitor actually requested into the rewritten render.
 *
 * ⚠️ A REWRITE DESTROYS THE ONLY COPY OF THE PUBLIC URL. After `NextResponse.rewrite`, the page
 * sees `/sites/<slug>/home` and has no way back to `https://theirdomain.com/` — which is how every
 * published site came to declare a canonical pointing at our internal routing path. The existing
 * `x-qsites-rewrite` header records the same fact backwards (where we sent it) and is set on the
 * RESPONSE, so a server component cannot read it at all.
 *
 * Request headers, not response headers. That distinction is the whole bug.
 */
function withPublicPath(req: NextRequest): Headers {
  const h = new Headers(req.headers);
  h.set(PUBLIC_PATH_HEADER, req.nextUrl.pathname || '/');
  return h;
}

/** Guests (anonymous users) may only reach the template editor under /admin. */
function isGuestAllowedAdminPath(pathname: string): boolean {
  return /^\/admin\/templates\/(?!list(?:$|\/)|new(?:$|\/)|gsc-bulk-stats(?:$|\/))[^/]+/.test(
    pathname,
  );
}

/**
 * Is this a bare local dev host on ANY port — i.e. the app itself, running locally?
 *
 * ⚠️ THE PORT USED TO BE HARD-CODED TO 3000, AND THE FAILURE LOOKED LIKE A BROKEN PAGE.
 * A dev server on any other port is not in APP_HOSTS, so every request falls through to the
 * custom-domain branch and gets rewritten to `/sites/<path>` — a brand-new marketing route
 * returns 404 with no hint that routing, not the route, is the problem. That has now cost
 * two debugging detours (and is written down in a memory as "local verify needs port 3000",
 * which is the kind of standing workaround this fixes rather than documents).
 *
 * Bare host only: `foo.localhost:3001` must still reach the dev-subdomain branch below, which
 * is how tenant sites are tested locally. And dev-only — in production this returns false, so
 * the explicit host list stays the whole story where it matters.
 */
function isLocalDevHost(host: string): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return /^(localhost|127\.0\.0\.1|\[::1\]|::1)(:\d+)?$/.test(host);
}

/** Hosts that should NOT be rewritten (your app itself). */
const APP_HOSTS = new Set<string>([
  'localhost:3000',
  '127.0.0.1:3000',
  '::1:3000',

  // QuickSites app/marketing hosts
  'quicksites.ai',
  'www.quicksites.ai',
  'app.quicksites.ai',

  // App-only hosts (dashboards)
  'app.cedarsites.com',
  'app.pointsevenstudio.com',
]);

/** Known platform domains where subdomain = site slug. */
const PLATFORM_DOMAINS = ['quicksites.ai', 'cedarsites.com', 'pointsevenstudio.com'];

/** Known org-level domains → org slug */
const ORG_DOMAINS: Record<string, string> = {
  // Production
  'pointsevenstudio.com': 'pointsevenstudio',
  'www.pointsevenstudio.com': 'pointsevenstudio',
  'cedarsites.com': 'cedarsites',
  'www.cedarsites.com': 'cedarsites',

  // Dev convenience
  'pointsevenstudio.localhost': 'pointsevenstudio',
  'www.pointsevenstudio.localhost': 'pointsevenstudio',
  'cedarsites.localhost': 'cedarsites',
  'www.cedarsites.localhost': 'cedarsites',

  // http://pointsevenstudio.localhost:3000/ → rewrites to /orgs/pointsevenstudio
  // http://pointsevenstudio.localhost:3000/about → rewrites to /orgs/pointsevenstudio/about
  // http://pointsevenstudio.localhost:3000/admin → goes to the app dashboard (not rewritten)
};


/** Paths we should never rewrite (Next internals, assets, specific APIs). */
const IGNORE_PATHS: RegExp[] = [
  /^\/_next\//,
  /^\/static\//,
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/manifest\.json$/,
  // common static extensions
  /\.(?:js(?:\.map)?|mjs|cjs|json|txt|xml|svg|ico|png|jpg|jpeg|gif|webp|avif|mp4|webm|css|woff2?|ttf)$/i,
  // webhooks / special APIs that must not be rewritten
  /^\/api\/twilio-callback/,
  /^\/api\/stripe\/webhook/,
  /^\/api\/commerce\/webhooks\/stripe/,
  /^\/api\/billing\/webhooks\/stripe/,
];

function isIgnored(pathname: string) {
  return IGNORE_PATHS.some((re) => re.test(pathname));
}

function splitHostPort(h: string) {
  const [hostname, port] = (h || '').toLowerCase().split(':');
  return { hostname: hostname ?? '', port: port ?? '' };
}

function subdomainFromDevHost(hostname: string): string | null {
  if (hostname.endsWith('.localhost')) {
    return hostname.slice(0, -'.localhost'.length);
  }
  if (hostname.endsWith('.lvh.me')) {
    return hostname.slice(0, -'.lvh.me'.length);
  }
  if (hostname.endsWith('.127.0.0.1.nip.io')) {
    return hostname.slice(0, -'.127.0.0.1.nip.io'.length);
  }
  return null;
}

/** If host ends with a known platform domain, return the leftmost label (site slug). */
function platformSubdomainSlug(hostname: string): string | null {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  for (const base of PLATFORM_DOMAINS) {
    const suffix = `.${base}`;
    if (h.endsWith(suffix)) {
      const left = h.slice(0, -suffix.length);
      if (!left || left === 'www' || left === 'app') return null;
      return left.split('.')[0];
    }
  }
  return null;
}

// cookies
const REF_COOKIE = 'qs_ref';
const REF_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

// hub recruit link (?hub=<code>) → sets a reseller's upline when they join
const HUB_COOKIE = 'qs_hub';
const HUB_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

const ORG_COOKIE = 'qs_org_slug';
const ORG_MAX_AGE = 60 * 60; // 1 hour
const ORG_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,63}$/i;

const COOKIE_SECURE = process.env.NODE_ENV === 'production';

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const { pathname, searchParams } = url;

  // --- capture ?ref=... (affiliates) ---
  const ref = searchParams.get('ref')?.trim();
  const wantsRefCookie = !!ref && ref.length <= 64;

  // --- capture ?hub=... (hub recruits a reseller) ---
  const hub = searchParams.get('hub')?.trim();
  const wantsHubCookie = !!hub && hub.length <= 64;

  // --- dev toggle: ?org=<slug> to override org; ?org=clear to remove ---
  const orgParam = searchParams.get('org')?.trim().toLowerCase() || null;
  const wantsOrgSet = !!orgParam && orgParam !== 'clear' && ORG_SLUG_RE.test(orgParam);
  const wantsOrgClear = orgParam === 'clear';

  const withCookies = (res: NextResponse) => {
    if (wantsRefCookie) {
      res.cookies.set({
        name: REF_COOKIE,
        value: ref!,
        httpOnly: false,
        sameSite: 'lax',
        secure: COOKIE_SECURE,
        path: '/',
        maxAge: REF_MAX_AGE,
      });
      res.headers.set('x-qsites-ref', ref!);
    }

    if (wantsHubCookie) {
      res.cookies.set({
        name: HUB_COOKIE,
        value: hub!,
        httpOnly: false,
        sameSite: 'lax',
        secure: COOKIE_SECURE,
        path: '/',
        maxAge: HUB_MAX_AGE,
      });
    }

    if (wantsOrgSet) {
      res.cookies.set({
        name: ORG_COOKIE,
        value: orgParam!,
        httpOnly: false,
        sameSite: 'lax',
        secure: COOKIE_SECURE,
        path: '/',
        maxAge: ORG_MAX_AGE,
      });
      res.headers.set('x-qsites-org', orgParam!);
    } else if (wantsOrgClear) {
      res.cookies.delete({ name: ORG_COOKIE, path: '/' });
      res.headers.set('x-qsites-org-cleared', '1');
    }
    return res;
  };

  if (
    isIgnored(pathname) ||
    pathname.startsWith('/host') ||
    pathname.startsWith('/_domains') ||
    pathname.startsWith('/sites') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api')
  ) {
    return withCookies(NextResponse.next());
  }

  // Host header
  const hostHeader = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  const host = hostHeader.toLowerCase();
  const { hostname } = splitHostPort(hostHeader);

  // If this is our app host, don't rewrite. Forward the current pathname as a
  // request header so server components (e.g. the admin layout) can see which
  // route is rendering.
  if (APP_HOSTS.has(host) || isLocalDevHost(host) || host.endsWith('.vercel.app')) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-pathname', pathname);
    const res = NextResponse.next({ request: { headers: requestHeaders } });

    // Authoritative guest gate: anonymous users may reach ONLY the template
    // editor — never the rest of /admin (those pages carry browser-client writes
    // gated only by getUser(), which anonymous users pass). Only runs when the
    // flag is on and only for the at-risk (non-editor) admin paths.
    if (
      GUEST_BUILD_ENABLED &&
      pathname.startsWith('/admin') &&
      !isGuestAllowedAdminPath(pathname)
    ) {
      // Loaded lazily so the Supabase client (and its Node-detection code) never
      // enters the Edge hot path unless the gate actually runs.
      const { createMiddlewareSupabaseClient } = await import(
        '@/lib/supabase/middlewareClient'
      );
      const supabase = createMiddlewareSupabaseClient(req, res);
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.is_anonymous) {
        return withCookies(NextResponse.redirect(new URL('/', req.url)));
      }
    }

    return withCookies(res);
  }

  // --- delivered.menu restaurant surface ---
  // Both `<slug>.delivered.menu` and `delivered.menu/<slug>` resolve to /sites/<slug>;
  // an `x-qsites-menu-host` request header lets the renderer serve an unclaimed draft
  // (watermarked, noindex) to the public and drop the watermark once published.
  // --- yardsalesites.com garage-sale surface ---
  // The branded front door for the printed stickers: yardsalesites.com/5BC-GP8 → /s/5BCGP8.
  // Both the path form (what the sticker prints) and a subdomain form resolve.
  if (yardSaleEnabled() && isYardSaleHost(host)) {
    const toSticker = (code: string) => {
      const rewriteUrl = req.nextUrl.clone();
      rewriteUrl.pathname = `/s/${code}`;
      const res = NextResponse.rewrite(rewriteUrl, { request: { headers: withPublicPath(req) } });
      res.headers.set('x-qsites-yardsale-code', code);
      res.headers.set('x-qsites-rewrite', rewriteUrl.pathname);
      return withCookies(res);
    };

    const subCode = yardSaleSubdomainCode(host);
    if (subCode) return toSticker(subCode);

    if (isYardSaleApexHost(host)) {
      const code = yardSaleCodeFromPath(pathname);
      if (code) return toSticker(code);

      // Apex root → the directory of sales.
      if (pathname === '/') {
        const rewriteUrl = req.nextUrl.clone();
        rewriteUrl.pathname = '/garage-sales';
        return withCookies(NextResponse.rewrite(rewriteUrl, { request: { headers: withPublicPath(req) } }));
      }

      // A few pages belong here; everything else is neither a code nor ours to show on a
      // stranger's yard-sale sign, so it goes to the directory rather than serving QuickSites'
      // marketing. See the note on APEX_PAGES for why this fence is inverted vs lemonyum's.
      if (!isYardSaleApexPage(pathname)) {
        return withCookies(NextResponse.redirect(`https://${host}/`, 307));
      }
      return withCookies(NextResponse.next());
    }
  }

  // --- lemonyum.com lemonade-stand surface ---
  // Same shape as the delivered.menu branch below, for the same reason: a branded consumer host
  // in front of an ordinary QuickSites site. `<slug>.lemonyum.com` and `lemonyum.com/<slug>` both
  // resolve to /sites/<slug>.
  //
  // ⚠️ There is NO directory here, and that is a decision rather than an omission — the apex is a
  // setup guide for parents. A searchable map of where children are selling lemonade on Saturday
  // morning is a different object from a sign on a corner. See docs/LEMONYUM_PLAN.md §2b.
  if (lemonYumEnabled() && isLemonYumHost(host)) {
    const toStand = (slug: string, restPath: string) => {
      const rewriteUrl = req.nextUrl.clone();
      rewriteUrl.pathname = `/sites/${slug}${restPath}`;
      const res = NextResponse.rewrite(rewriteUrl, { request: { headers: withPublicPath(req) } });
      res.headers.set('x-qsites-lemonyum-slug', slug);
      res.headers.set('x-qsites-rewrite', rewriteUrl.pathname + (rewriteUrl.search || ''));
      return withCookies(res);
    };

    const subSlug = lemonYumSubdomainSlug(host);
    if (subSlug) return toStand(subSlug, pathname === '/' ? '' : pathname);

    if (isLemonYumApexHost(host)) {
      const slug = lemonYumPathSlug(pathname);
      if (slug) return toStand(slug, pathname.replace(/^\/[^/]+/, ''));

      // Apex root → the parent-facing setup guide.
      if (pathname === '/') {
        const rewriteUrl = req.nextUrl.clone();
        rewriteUrl.pathname = '/lemonade-stands';
        return withCookies(NextResponse.rewrite(rewriteUrl, { request: { headers: withPublicPath(req) } }));
      }
      // Reserved paths (api/_next/setup/privacy/terms) pass through untouched.
      return withCookies(NextResponse.next());
    }
  }

  if (menuEnabled() && isMenuHost(host)) {
    const menuHeaders = () => {
      const h = withPublicPath(req);
      h.set('x-qsites-menu-host', '1');
      return h;
    };
    const toSite = (slug: string, restPath: string) => {
      const rewriteUrl = req.nextUrl.clone();
      rewriteUrl.pathname = `/sites/${slug}${restPath}`;
      const res = NextResponse.rewrite(rewriteUrl, { request: { headers: menuHeaders() } });
      res.headers.set('x-qsites-menu-slug', slug);
      res.headers.set('x-qsites-rewrite', rewriteUrl.pathname + (rewriteUrl.search || ''));
      return withCookies(res);
    };

    // Subdomain form: <slug>.delivered.menu/<path> → /sites/<slug>/<path>
    const subSlug = menuSubdomainSlug(host);
    if (subSlug) {
      return toSite(subSlug, pathname === '/' ? '' : pathname);
    }

    // Apex form: delivered.menu/<slug>/<path> → /sites/<slug>/<path>
    if (isMenuApexHost(host)) {
      // QuickSites' own marketing pages do not belong on the restaurant's address. 307 so the
      // choice stays reversible while the surface is young.
      const away = apexRedirectTarget(pathname);
      if (away) return withCookies(NextResponse.redirect(away, 307));

      // One directory, one URL: `/delivered` is the internal rewrite target of the apex root.
      if (pathname === '/delivered' || pathname.startsWith('/delivered/')) {
        return withCookies(NextResponse.redirect(`https://${host}/`, 307));
      }

      const slug = menuPathSlug(pathname);
      if (slug) {
        const rest = pathname.replace(/^\/[^/]+/, ''); // strip the /<slug> segment
        return toSite(slug, rest);
      }
      // Bare apex root → the live-restaurants directory; reserved app paths pass through.
      if (pathname === '/') {
        const rewriteUrl = req.nextUrl.clone();
        rewriteUrl.pathname = '/delivered';
        return withCookies(NextResponse.rewrite(rewriteUrl));
      }
      return withCookies(NextResponse.next());
    }
  }

  // --- Org-level domains ---
  const hostLc = hostname.toLowerCase().replace(/\.$/, '');
  if (ORG_DOMAINS[hostLc]) {
    const orgSlug = ORG_DOMAINS[hostLc];

    // Re-point the Point Seven Studio public domain to the studio hub page on HiveJournal
    // (the canonical, cross-product studio surface that links all mesh products) instead of the
    // old QuickSites org portfolio. 307 = temporary/reversible; promote to 308 once settled.
    // The app dashboard lives on app.pointsevenstudio.com (an APP_HOST handled earlier), so an
    // /admin passthrough is kept here just in case.
    if (orgSlug === 'pointsevenstudio' && !pathname.startsWith('/admin')) {
      return withCookies(
        NextResponse.redirect('https://www.hivejournal.com/point-seven-studio', 307),
      );
    }

    // Let /admin paths through untouched → app dashboard
    if (pathname.startsWith('/admin')) {
      return withCookies(NextResponse.next());
    }

    // Root → /orgs/<slug>, otherwise preserve the rest of the path
    const rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = `/orgs/${orgSlug}${pathname === '/' ? '' : pathname}`;
    const res = NextResponse.rewrite(rewriteUrl);
    res.headers.set('x-qsites-org-slug', orgSlug);
    res.headers.set('x-qsites-rewrite', rewriteUrl.pathname + (rewriteUrl.search || ''));
    return withCookies(res);
  }

  // --- Dev subdomain (foo.localhost:3000) ---
  const devSub = subdomainFromDevHost(hostname);
  if (devSub && !['www', 'app'].includes(devSub)) {
    const rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = `/sites/${devSub}${pathname === '/' ? '' : pathname}`;
    const res = NextResponse.rewrite(rewriteUrl, { request: { headers: withPublicPath(req) } });
    res.headers.set('x-qsites-dev-sub', devSub);
    res.headers.set('x-qsites-rewrite', rewriteUrl.pathname + (rewriteUrl.search || ''));
    return withCookies(res);
  }

  // --- Platform subdomain (*.quicksites.ai, etc) ---
  const platSlug = platformSubdomainSlug(hostname);
  if (platSlug) {
    const extra = pathname === '/' ? '/home' : pathname;
    const rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = `/sites/${platSlug}${extra}`;
    const res = NextResponse.rewrite(rewriteUrl, { request: { headers: withPublicPath(req) } });
    res.headers.set('x-qsites-platform-slug', platSlug);
    res.headers.set('x-qsites-rewrite', rewriteUrl.pathname + (rewriteUrl.search || ''));
    return withCookies(res);
  }

  // --- Arbitrary custom domain → slug from apex label ---
  const noWww = hostLc.replace(/^www\./, '');
  const parts = noWww.split('.');
  const apexLabel = (parts.length > 1 ? parts.slice(0, -1).join('.') : parts[0]) || noWww;
  const extra2 = pathname === '/' ? '/home' : pathname;
  const rewriteUrl = req.nextUrl.clone();
  rewriteUrl.pathname = `/sites/${apexLabel}${extra2}`;

  const res = NextResponse.rewrite(rewriteUrl, { request: { headers: withPublicPath(req) } });
  res.headers.set('x-qsites-host-in', hostname);
  res.headers.set('x-qsites-slug', apexLabel);
  res.headers.set('x-qsites-rewrite', rewriteUrl.pathname + (rewriteUrl.search || ''));
  return withCookies(res);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|.*\\.(?:js(?:\\.map)?|mjs|cjs|json|txt|xml|svg|ico|png|jpg|jpeg|gif|webp|avif|mp4|webm|css|woff2?|ttf)).*)',
  ],
};
