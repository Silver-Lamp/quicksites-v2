// components/home/home-client.tsx
'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import BackgroundGlow from '@/components/background-glow';
import QuickSitesWidget, { HomepageWidgetVariant } from '@/components/quick-sites-widget';
import event from '@vercel/analytics';
import { useSafeAuth } from '@/hooks/useSafeAuth';
import { SiteFlags } from '@/lib/site-config';
import useMediaQuery from '@/hooks/useMediaQuery';
import SiteHeader from '@/components/site/site-header';
import { useBrand } from '@/app/providers';
import { guestBuildEnabled } from '@/lib/flags/guestBuild';
import GuestStart from '@/components/home/guest-start';
import HomeColorLab from '@/components/home/home-color-lab';
import SectionBackdrop from '@/components/home/section-backdrop';

const isProd = process.env.NODE_ENV === 'production';

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
  resellerSlot,
}: {
  showcase?: React.ReactNode;
  resellerSlot?: React.ReactNode;
}) {
  const { user, role, isLoggedIn } = useSafeAuth();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const brand = (useBrand?.() as Branding) || {};
  const productName = brand.name || 'QuickSites';
  const siteDomain = brand.domain || 'QuickSites.ai';
  const logoSrc = brand.logoUrl || brand.faviconUrl || '/qs-default-favicon.ico';

  // The QuickSites motif character — never on a white-labeled reseller homepage.
  const showCharacter = (brand.billingMode ?? 'central') !== 'reseller';

  const heroHeadline = brand.hero?.headline || 'A site, a store, and a CRM. Built in.';
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
    event.track('landing_page_viewed', {
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
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={primaryHref}
                  className="inline-block rounded-lg bg-sky-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-sky-400"
                >
                  {primaryLabel}
                </Link>
                <Link
                  href="/partners"
                  className="inline-block rounded-lg border border-sky-500 px-6 py-3 text-base font-medium text-sky-300 transition hover:bg-sky-500/10 hover:text-sky-200"
                >
                  Become a partner
                </Link>
              </div>
              <p className="mt-3 text-xs text-zinc-500">No code. Your domain. Your storefront. Your margin.</p>
            </>
          )}
        </main>

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
              <Card title="You take a platform fee">
                Collect a percentage of every order via Stripe Connect — your take-rate, set per merchant.
              </Card>
              <Card title="Refunds & revenue, tracked">
                Refunds reverse the fee automatically; a revenue dashboard reconciles what you’ve earned.
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

        {/* ───────── Showcase (real published sites) — SSR'd via server page ───────── */}
        {showcase}

        {/* ───────── Earn (partners / resellers) ───────── */}
        <section className="relative z-10 w-full border-t border-zinc-800/70 bg-gradient-to-b from-sky-950/30 to-transparent">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
              <div className="text-left">
                <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
                  For partners &amp; resellers
                </span>
                <h2 className="mt-4 text-3xl md:text-4xl font-bold">White-label it. Resell it. Earn the slice.</h2>
                <p className="mt-4 text-zinc-400">
                  Bring {productName} to your network under your own brand. Onboard merchants through your
                  whitelisted payment processor, set your platform fee, and earn on every order they process —
                  plus recurring on hosting. Free or near-free hosting brings them in; the take-rate is yours.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/partners"
                    className="inline-block rounded-lg bg-sky-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-sky-400"
                  >
                    Become a partner
                  </Link>
                  <a
                    href="mailto:partners@quicksites.ai?subject=QuickSites%20reseller%20partnership"
                    className="inline-block rounded-lg border border-zinc-700 px-6 py-3 text-base font-medium text-zinc-300 transition hover:bg-zinc-800"
                  >
                    Talk to us
                  </a>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Card title="Your brand">White-label theming per partner — your logo, your domain, your customers.</Card>
                <Card title="Whitelisted processors">Onboard merchants through approved payment processors via Stripe Connect.</Card>
                <Card title="Your take-rate">Set the platform fee; collect on every order automatically.</Card>
                <Card title="Residual commissions">Earn recurring on referred merchants — tracked in a commission ledger.</Card>
              </div>
            </div>
          </div>
        </section>

        {/* ───────── Hub referral (refer resellers → lifetime override) ───────── */}
        <section className="relative z-10 w-full border-t border-zinc-800/70 bg-gradient-to-b from-amber-950/20 to-transparent">
          <div className="mx-auto max-w-4xl px-6 py-16 text-center">
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
              Refer resellers
            </span>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold">Grow the network. Earn on all of it.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
              Know people who&apos;d resell {productName}? Bring them on and earn a{' '}
              <span className="font-semibold text-zinc-200">lifetime override</span> on every order their merchants
              process — on top of your own residual. Their resellers, your income, ongoing.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
              <Card title="Share one link">Send your recruit link. Anyone who signs up to resell through it becomes your downline.</Card>
              <Card title="Earn an override">You keep a lifetime cut of their sales — funded from the platform&apos;s share, so your resellers keep 100% of theirs.</Card>
              <Card title="Paid automatically">Overrides accrue to your commission ledger and pay out with the rest — nothing to chase.</Card>
            </div>
            <div className="mt-8">
              <Link
                href="/partners/resellers"
                className="inline-block rounded-lg bg-amber-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-amber-400"
              >
                Become a hub
              </Link>
            </div>
          </div>
        </section>

        {/* ───────── Reseller model (1 platform → many resellers) ───────── */}
        <section className="relative z-10 w-full border-t border-zinc-800/70">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="mx-auto max-w-2xl text-center">
              <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
                One platform · many brands
              </span>
              <h2 className="mt-4 text-2xl md:text-3xl font-semibold">
                We power the platform. You resell it as your own.
              </h2>
              <p className="mt-3 text-sm text-zinc-400">
                {productName} is the engine. Resellers put their own brand and domain on top and serve
                their own merchants — one platform behind many businesses.{' '}
                <span className="text-zinc-300">CedarSites</span> is a live example; your brand can be the next.
              </p>
            </div>

            <div className="mt-10">
              {resellerSlot}
            </div>

            <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
              <Card title="Your brand, your domain">
                White-label theming per reseller — logo, colors, and domain (e.g. cedarsites.com). Your customers never see us.
              </Card>
              <Card title="Bring your existing sites">
                Already run client sites? Migrate them onto the platform and manage them all in one place.
              </Card>
              <Card title="Earn on every order">
                Set your platform fee; collect on every sale your merchants process, with residual commissions tracked for you.
              </Card>
            </div>

            <div className="mt-8 text-center">
              <Link
                href="/partners"
                className="inline-block rounded-lg bg-sky-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-sky-400"
              >
                Become a reseller
              </Link>
            </div>
          </div>
        </section>

        {/* ───────── How it works ───────── */}
        <section className="relative z-10 w-full border-t border-zinc-800/70 bg-zinc-950/60">
          <SectionBackdrop image="meadow" />
          <div className="mx-auto max-w-6xl px-6 py-14 text-center">
            <h2 className="text-2xl md:text-3xl font-semibold">Build → Sell → Earn</h2>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 font-bold text-zinc-950">1</div>
                <h4 className="mt-3 font-semibold">Build the site</h4>
                <p className="mt-1 text-sm text-zinc-400">Drag-and-drop pages, add a catalog, publish to a domain.</p>
              </div>
              <div>
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 font-bold text-zinc-950">2</div>
                <h4 className="mt-3 font-semibold">Sell with checkout</h4>
                <p className="mt-1 text-sm text-zinc-400">Customers buy via Stripe; merchants get paid, you take the fee.</p>
              </div>
              <div>
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 font-bold text-zinc-950">3</div>
                <h4 className="mt-3 font-semibold">Earn the margin</h4>
                <p className="mt-1 text-sm text-zinc-400">Per-order take-rate + residual commissions, reconciled for you.</p>
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
