// components/home/home-client.tsx
'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import BackgroundGlow from '@/components/background-glow';
import QuickSitesWidget, { HomepageWidgetVariant } from '@/components/quick-sites-widget';
import { track as trackEvent } from '@/lib/analytics/syntheticTraffic';
import { useSafeAuth } from '@/hooks/useSafeAuth';
import { SiteFlags } from '@/lib/site-config';
import useMediaQuery from '@/hooks/useMediaQuery';
import SiteHeader from '@/components/site/site-header';
import DefaultScreensaver from '@/components/brand/default-screensaver';
import { useBrand } from '@/app/providers';
import { guestBuildEnabled } from '@/lib/flags/guestBuild';
import GuestStart from '@/components/home/guest-start';
import HomeColorLab from '@/components/home/home-color-lab';
import SectionBackdrop from '@/components/home/section-backdrop';
import InYourVoice from '@/components/home/in-your-voice';
import { INDUSTRIES } from '@/lib/industries';

const isProd = process.env.NODE_ENV === 'production';

// A sample of the industry starters, shown as pills. The COUNT is derived from
// INDUSTRIES (never hard-coded) so adding an industry can't leave the homepage
// claiming a stale number — the copy stays true by construction.
const INDUSTRY_PILLS = [
  'Restaurant',
  'Plumbing',
  'Real Estate',
  'HVAC',
  'Salon & Spa',
  'Deck Builder',
  'Roofing',
  'Photography',
  'Author',
  'Auto Repair',
  'Fitness',
  'Landscaping',
  'Lemonade Stand',
] as const;

// White-label-overridable brand shape (orgs can theme the homepage).
type Branding = {
  name?: string;
  domain?: string;
  billingMode?: 'central' | 'reseller' | 'none';
  logoUrl?: string | null;
  faviconUrl?: string | null;
  hero?: { headline?: string; subhead?: string };
  flags?: { showPuppyWidget?: boolean; showGlow?: boolean; showMobileWidget?: boolean; showMobileGradients?: boolean; forceWidgetVariant?: string | null };
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-left">
      <h4 className="text-base font-semibold text-white">{title}</h4>
      <p className="mt-2 text-sm text-zinc-400">{children}</p>
    </div>
  );
}

export default function HomeClient({
  showcase,
}: {
  showcase?: React.ReactNode;
  /** ⚠️ `resellerSlot` was removed 2026-09-25 with the three partner sections. The reseller
   *  diagram now renders on /partners, where the audience for it is. Re-adding a slot here means
   *  re-adding the pitch — see docs/AUDIENCE_SPLIT_PLAN.md before you do. */
}) {
  const { user, role, isLoggedIn } = useSafeAuth();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const brand = (useBrand?.() as Branding) || {};
  const productName = brand.name || 'QuickSites';
  const siteDomain = brand.domain || 'QuickSites.ai';
  const logoSrc = brand.logoUrl || brand.faviconUrl || '/qs-default-favicon.ico';

  // The QuickSites motif character — never on a white-labeled reseller homepage.
  const showCharacter = (brand.billingMode ?? 'central') !== 'reseller';

  // ⚠️ BRAND-AWARE, NOT A BLANKET STRING. Leading with the brand name helps the branded query —
  // Search Console has us at average position 12.3 for "quicksites", our own name, and the <h1>
  // never said it. But this fallback is ALSO what a white-label reseller lands on when they
  // haven't set their own headline, and putting "QuickSites" on a reseller's homepage would
  // undo the entire point of white-labelling. Same guard as the motif character above.
  const heroHeadline =
    brand.hero?.headline ||
    (showCharacter
      ? 'QuickSites — a site, a store, and a CRM. Built in.'
      : 'A site, a store, and a CRM. Built in.');
  const heroSubhead =
    brand.hero?.subhead ||
    'A powerful, efficient website builder with e-commerce built in — drag-and-drop pages, a product catalog, and Stripe-powered checkout. Every paid order builds a customer you can segment and email — all published to your own domain.';

  const allowMobileWidget = brand.flags?.showMobileWidget ?? SiteFlags.showMobileWidget;
  const allowMobileGlow = brand.flags?.showMobileGradients ?? SiteFlags.showMobileGradients;
  const showWidget = (brand.flags?.showPuppyWidget ?? true) && (allowMobileWidget || !isMobile);
  const showGlow = (brand.flags?.showGlow ?? true) && (allowMobileGlow || !isMobile);
  const widgetVariant = brand.flags?.forceWidgetVariant || 'puppy';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    trackEvent('landing_page_viewed', {
      user: user?.id || user?.email || 'guest',
      role,
      isLoggedIn,
      brand: productName,
    });
  }, [user?.id, user?.email, role, isLoggedIn, productName]);

  const isRealUser = isLoggedIn && role !== 'guest';
  // Guest quick-start: show the in-hero builder to anyone who isn't a signed-in
  // real user, when the feature flag is on. Otherwise fall back to the old CTAs.
  const showGuestStart = guestBuildEnabled() && !isRealUser;

  const primaryHref = isRealUser ? '/admin/templates/list' : isProd ? '/pricing' : '/login';
  const primaryLabel = isRealUser ? 'Go to Templates' : isProd ? 'See Pricing' : 'Start building';

  return (
    <>
      <SiteHeader sticky />
      {/* Ambient fireplace screensaver on our own homepage (default ON, opt-out) — the same
          wow-factor site builders can enable on their sites. Only on the default brand. */}
      {showCharacter && <DefaultScreensaver preset="fireplace" idleSeconds={150} />}
      {/* Color playground surfaced for anon/guest visitors (temporary — until we
          pick a default palette); also available to anyone via ?colorlab=1. */}
      <HomeColorLab show={!isRealUser} />
      <div className="relative min-h-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
        {/* Glow defaults to 0 opacity so the section backgrounds read clearly; the
            homepage color lab exposes a slider (--qs-glow-opacity) to dial it up. */}
        {showGlow && <BackgroundGlow intensity={0} />}

        {/* ───────── Hero ───────── */}
        <main id="start" className="relative z-10 flex flex-col items-center px-6 pt-16 pb-12 text-center">
          {/* QuickSites motif hero background (default brand only). Scrimmed so the
              headline stays readable; fades into the page top + bottom. */}
          {showCharacter && (
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: 'url(/brand/qs-hero-bg.jpg)', opacity: 0.45 }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950/20 to-zinc-950" />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Image src={logoSrc} width={40} height={40} alt={`${productName} logo`} className="rounded-full" />
            <span className="text-2xl font-bold tracking-tight">{productName}</span>
          </div>


          <motion.h1
            className="mt-8 max-w-3xl text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent"
            // Accent-driven so the homepage color lab recolors the title live;
            // fallbacks match the original sky gradient.
            style={{
              backgroundImage:
                'linear-gradient(to right, var(--qs-accent, #38bdf8), var(--qs-accent-2, #bae6fd))',
            }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {heroHeadline}
          </motion.h1>

          <p className="mt-5 max-w-2xl text-lg text-zinc-400">
            {showGuestStart
              ? 'Describe your business and watch a real site appear — edit it live, publish when you sign up.'
              : heroSubhead}
          </p>

          {showGuestStart ? (
            <GuestStart />
          ) : (
            <>
              {/* ⚠️ The second CTA here used to be "Become a partner" — a channel pitch in the
                  first thing a business owner sees. See docs/AUDIENCE_SPLIT_PLAN.md: this page
                  sells to a merchant and nothing else. Partners reach /partners from the footer,
                  from search, or from a person. */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={primaryHref}
                  className="inline-block rounded-lg bg-sky-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-sky-400"
                >
                  {primaryLabel}
                </Link>
                <Link
                  href="/features"
                  className="inline-block rounded-lg border border-sky-500 px-6 py-3 text-base font-medium text-sky-300 transition hover:bg-sky-500/10 hover:text-sky-200"
                >
                  See what you get
                </Link>
              </div>
              <p className="mt-3 text-xs text-zinc-500">No code. Your domain. Your storefront.</p>
            </>
          )}
        </main>

        {/* ───────── Industries ─────────
            Added 2026-07-28 from persona finding c130316f: a first-time visitor
            trying to answer "is this for me?" got an all-commerce/reseller pitch,
            and the only industry surface on the page was an optional dropdown in
            the start form. The breadth below was already built — it just wasn't
            stated anywhere a visitor would look. */}
        <section className="relative z-10 w-full border-t border-zinc-800/70">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl md:text-3xl font-semibold">Starts as your industry, not a blank page</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Pick your trade and the first draft already has the right pages, services, and
              look — {INDUSTRIES.length} of them, from towing to bookshops. Change anything.
            </p>

            <ul className="mt-6 flex flex-wrap gap-2">
              {INDUSTRY_PILLS.map((label) => (
                <li
                  key={label}
                  className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-300"
                >
                  {label}
                </li>
              ))}
              <li className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs text-sky-300">
                +{INDUSTRIES.length - INDUSTRY_PILLS.length} more
              </li>
            </ul>

            <p className="mt-8 max-w-2xl text-sm text-zinc-400">
              Some go further than a starter — a few trades get tools built for how they
              actually sell:
            </p>
            <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              <Card title="Restaurants">
                A menu-forward ordering site, not a brochure. Diners order from the menu and you
                take payment — no delivery app in the middle.
              </Card>
              <Card title="Real estate">
                Listings with a mortgage calculator, home valuation, affordability tools, and
                area guides that bring searchers in.
              </Card>
              <Card title="Trades with quotes">
                Fencing, concrete, roofing, paving and more get an instant estimator, so a
                visitor gets a number instead of a callback.
              </Card>
              <Card title="Authors & makers">
                Sell books, posters and apparel that are printed and shipped when ordered — no
                inventory, no boxes in your garage.
              </Card>
              <Card title="Lemonade stands">
                A menu, a QR code, and a printable table sign. The customer with no cash pays by
                phone, straight into a grown-up’s own Venmo or Cash App — no account to open, and
                nothing deducted.
              </Card>
            </div>
          </div>
        </section>

        {/* ───────── Build ───────── */}
        <section className="relative z-10 w-full border-t border-zinc-800/70 bg-zinc-950/60">
          <SectionBackdrop image="meadow" />
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl md:text-3xl font-semibold">A builder that gets out of your way</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Schema-driven, drag-and-drop pages — fast to build, easy to hand off.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              <Card title="Drag-and-drop blocks">
                Compose pages from typed, reusable blocks. Validated content, live preview, versioned snapshots.
              </Card>
              <Card title="AI-assisted">
                Generate hero copy, services, FAQs, and images in a click — metered so costs never surprise you.
              </Card>
              <Card title="One-click publish">
                Go live on a subdomain or a custom domain you provision automatically. SEO and sitemaps included.
              </Card>
            </div>
          </div>
        </section>

        {/* ───────── Sell ───────── */}
        <section className="relative z-10 w-full border-t border-zinc-800/70">
          <SectionBackdrop image="bokeh" />
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl md:text-3xl font-semibold">Commerce, built in — not bolted on</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Every site can sell. Products, services, or digital goods — with a real checkout and a real ledger.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              <Card title="Catalog → cart → checkout">
                A product catalog and storefront on every site, with cart and Stripe-powered checkout out of the box.
              </Card>
              {/* ⚠️ This card used to read "You take a platform fee — your take-rate, set per
                  merchant." That is written to a RESELLER, in the middle of a section a business
                  owner is reading about their own store: they do not take the fee, they pay it.
                  See docs/AUDIENCE_SPLIT_PLAN.md. */}
              <Card title="You get paid directly">
                Stripe pays into your own account on every order — we are never in the middle of your
                money. A small per-order platform fee is the only thing we take; see{' '}
                <Link href="/pricing" className="underline hover:text-zinc-300">pricing</Link>.
              </Card>
              <Card title="Refunds & revenue, tracked">
                Refund an order and the fee reverses automatically. A revenue dashboard reconciles what
                you sold, what you kept, and what is still settling.
              </Card>
            </div>
          </div>
        </section>

        {/* ───────── Keep (customer CRM) ───────── */}
        <section className="relative z-10 w-full border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl md:text-3xl font-semibold">A CRM that fills itself</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Every paid order becomes a customer record — so you can bring buyers back, not just chase new ones.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              <Card title="Customers, automatically">
                Every sale builds a deduplicated customer with lifetime value, order history, and an activity timeline — no data entry.
              </Card>
              <Card title="Segment in a click">
                Filter by opted-in, repeat, recent, or lapsed buyers plus your own tags. Add private notes and manage marketing consent.
              </Card>
              <Card title="Email that pays for itself">
                Send a consent-gated campaign to a segment and see the orders + revenue it drove — attribution built in, one-click unsubscribe included.
              </Card>
            </div>
          </div>
        </section>

        {/* ───────── In Your Voice (owner-voice narration moat) — default brand only ───────── */}
        {showCharacter && <InYourVoice />}

        {/* ───────── Showcase (real published sites) — SSR'd via server page ───────── */}
        {showcase}

        {/* ⚠️ THREE SECTIONS WERE DELETED HERE ON 2026-09-25, AND DELETED RATHER THAN HIDDEN.
            "White-label it. Resell it. Earn the slice." · "Grow the network. Earn on all of it."
            (recruit link / downline / lifetime override) · "We power the platform. You resell it
            as your own."

            They were ~45% of this page's body, and they close it — so the last thing a business
            owner read here was our channel compensation plan. A "for partners" toggle would have
            been the same information in front of the same person plus a click; the point is that
            the merchant homepage sells one thing. None of the content is lost: it lives at
            /partners, and the reseller diagram moved there with it.

            See docs/AUDIENCE_SPLIT_PLAN.md. Do not re-add a partner pitch to this page. */}

        {/* ───────── How it works ───────── */}
        <section className="relative z-10 w-full border-t border-zinc-800/70 bg-zinc-950/60">
          <SectionBackdrop image="meadow" />
          <div className="mx-auto max-w-6xl px-6 py-14 text-center">
            {/* ⚠️ Was "Build → Sell → Earn", and step 2 read "merchants get paid, YOU take the
                fee" — addressed to a reseller, on the merchant homepage, in the closing summary.
                Step 3 was "Earn the margin: per-order take-rate + residual commissions". Rewritten
                to the second person a business owner actually is. docs/AUDIENCE_SPLIT_PLAN.md */}
            <h2 className="text-2xl md:text-3xl font-semibold">Build → Sell → Get paid</h2>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 font-bold text-zinc-950">1</div>
                <h4 className="mt-3 font-semibold">Build the site</h4>
                <p className="mt-1 text-sm text-zinc-400">Drag-and-drop pages, add a catalog, publish to a domain.</p>
              </div>
              <div>
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 font-bold text-zinc-950">2</div>
                <h4 className="mt-3 font-semibold">Sell with checkout</h4>
                <p className="mt-1 text-sm text-zinc-400">Customers pay by card through Stripe, right on your site.</p>
              </div>
              <div>
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 font-bold text-zinc-950">3</div>
                <h4 className="mt-3 font-semibold">Get paid</h4>
                <p className="mt-1 text-sm text-zinc-400">Stripe deposits into your account. Orders, refunds and revenue reconciled for you.</p>
              </div>
            </div>
            <div className="mt-10">
              <Link
                href={showGuestStart ? '#start' : primaryHref}
                className="inline-block rounded-lg bg-sky-500 px-7 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-sky-400"
              >
                {showGuestStart ? 'Start building — free' : primaryLabel}
              </Link>
            </div>
          </div>
        </section>

        <footer className="relative z-10 border-t border-zinc-800/70 py-6 text-center text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} {siteDomain} — All rights reserved.
          <span className="mx-2">|</span>
          <a href="/pricing" className="underline hover:text-zinc-300">Pricing</a>
          <span className="mx-1">•</span>
          <a href="/legal/privacy" className="underline hover:text-zinc-300">Privacy</a>
          <span className="mx-1">•</span>
          <a href="/legal/terms" className="underline hover:text-zinc-300">Terms</a>
          <span className="mx-1">•</span>
          <a href="/contact" className="underline hover:text-zinc-300">Contact</a>
          <span className="mx-1">•</span>
          {/* The channel pitch lives here now, not in the hero and not in three sections above.
              Someone looking for it finds it; a business owner is not sold it. */}
          <a href="/partners" className="underline hover:text-zinc-300">Partners</a>
          <span className="mx-1">•</span>
          made by{' '}
          <a href="https://www.hivejournal.com/point-seven-studio" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-300">Point Seven Studio</a>
          {showWidget && (
            // Hidden on phones so the floating mascot doesn't cover the hero CTA;
            // shown at sm+ (a display:none ancestor also hides its fixed child).
            <div className="hidden sm:block">
              <QuickSitesWidget forceVariant={widgetVariant as HomepageWidgetVariant} />
            </div>
          )}
        </footer>
      </div>
    </>
  );
}
