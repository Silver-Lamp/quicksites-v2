// app/page.tsx
'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Head from 'next/head';
import Link from 'next/link';
import BackgroundGlow from '@/components/background-glow';
import GlowConfigurator, { GlowConfig } from '@/components/glow-configurator';
import { useState, useEffect, useMemo } from 'react';
import QuickSitesWidget from '@/components/quick-sites-widget';
import event from '@vercel/analytics';
import { useSafeAuth } from '../hooks/useSafeAuth';
import { SiteFlags } from '@/lib/site-config';
import useMediaQuery from '@/hooks/useMediaQuery';
import SiteHeader from '@/components/site/site-header';
import { createClient as createBrowserClient } from '@supabase/supabase-js';
import LazyVideoEmbed from '@/components/ui/lazy-video-embed';

// 🔹 New: brand hook (already exists elsewhere in your app)
import { useBrand } from '@/app/providers';
import { HomepageWidgetVariant } from '@/components/quick-sites-widget';

const isProd = process.env.NODE_ENV === 'production';

type FeatureRow = {
  id: string;
  title: string;
  blurb: string;
  category?: string | null;
  video_url?: string | null;
  doc_href?: string | null;
  badge?: string | null;
  created_at?: string | null;
};

// Minimal brand shape we care about here
type Branding = {
  name?: string;                // "QuickSites" | "CedarSites"
  domain?: string;              // "QuickSites.ai" | "CedarSites.com"
  logoUrl?: string | null;
  darkLogoUrl?: string | null;
  faviconUrl?: string | null;
  colors?: { gradient?: string[]; primary?: string };
  hero?: { headline?: string; subhead?: string };
  copy?: { featuresTitle?: string; featuresSubtitle?: string };
  flags?: {
    showPuppyWidget?: boolean;      // default true for QuickSites, likely false for CedarSites
    showGlow?: boolean;             // force-enable/disable gradient/glow
    showMobileWidget?: boolean;     // whether widget is allowed on small screens
    showMobileGradients?: boolean;  // whether gradients are allowed on small screens
    forceWidgetVariant?: string | null; // e.g. 'puppy'
  };
};

const defaultGlowConfig = {
  size: 'xl',
  intensity: 0.2,
  colors: ['from-indigo-600', 'via-blue-400', 'to-fuchsia-500'],
} satisfies GlowConfig;

export default function HomePage() {
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
  const { user, role, isLoggedIn } = useSafeAuth();
  const isMobile = useMediaQuery('(max-width: 768px)');

  // 🔹 Pull brand from provider and compute safe fallbacks
  const brand = (useBrand?.() as Branding) || {};
  const productName = brand.name || 'QuickSites';
  const siteDomain = brand.domain || 'QuickSites.ai';
  const logoSrc =
    brand.logoUrl ||
    brand.faviconUrl ||
    '/qs-default-favicon.ico';

  const heroHeadline =
    brand.hero?.headline || 'Your Website. One Click Away.';
  const heroSubhead =
    brand.hero?.subhead || 'Turn your local business into a digital presence in minutes. No code. No hassle.';

  const featuresTitle =
    brand.copy?.featuresTitle || 'Featured demos';
  const featuresSubtitle =
    brand.copy?.featuresSubtitle || `Hand-picked highlights from what ${productName} can do.`;

  // Decide on widget/glow behavior with brand overrides
  const allowMobileWidget = brand.flags?.showMobileWidget ?? SiteFlags.showMobileWidget;
  const allowMobileGlow = brand.flags?.showMobileGradients ?? SiteFlags.showMobileGradients;

  const showWidget = (brand.flags?.showPuppyWidget ?? true) && (allowMobileWidget || !isMobile);
  const showGlow = (brand.flags?.showGlow ?? true) && (allowMobileGlow || !isMobile);
  const widgetVariant = brand.flags?.forceWidgetVariant || 'puppy';

  // --- Featured demos (from Supabase) ---
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );
  const [featured, setFeatured] = useState<FeatureRow[]>([]);
  const [featLoading, setFeatLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setFeatLoading(true);
        // Pull up to 6 latest entries
        const { data } = await supabase
          .from('features')
          .select('*')
          .eq('featured', true)
          .order('feature_order', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(6);
        if (mounted) setFeatured((data || []) as FeatureRow[]);
      } finally {
        if (mounted) setFeatLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeatureIndex((i) => (i + 1) % 5);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const traceId = (document?.body as any)?.dataset?.traceId ?? '';
      const sessionId = (document?.body as any)?.dataset?.sessionId ?? '';

      event.track('landing_page_viewed', {
        user: user?.id || user?.email || 'guest',
        role,
        isLoggedIn,
        featureIndex: currentFeatureIndex,
        traceId,
        sessionId,
        brand: productName,
      });
    }
  }, [user?.id, user?.email, role, isLoggedIn, currentFeatureIndex, productName]);

  return (
    <>
      <SiteHeader sticky={true} />
      <div className="relative min-h-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
        <Head>
          <title>{productName} | One Click Websites</title>
          <meta name="description" content={heroSubhead} />
        </Head>

        {showGlow && (
          <>
            <BackgroundGlow />
            {/* <GlowConfigurator defaultGlowConfig={defaultGlowConfig} /> */}
          </>
        )}

        {/* Main Content */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="space-y-6 max-w-xl">
            <div className="flex justify-center items-center gap-3">
              <Image
                src={logoSrc}
                width={40}
                height={40}
                alt={`${productName} Logo`}
                className="rounded-full"
              />
              <h1 className="text-3xl font-bold tracking-tight text-white">{productName}</h1>
            </div>

            <motion.h2
              className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {heroHeadline}
            </motion.h2>

            <p className="text-zinc-400 text-lg">
              {heroSubhead}
            </p>

            {/* CTAs */}
            {isLoggedIn && role !== 'guest' ? (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <motion.a
                  href="/admin/templates/list"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-block px-6 py-3 bg-green-600 hover:bg-green-700 text-white text-base font-medium rounded-lg shadow-lg transition-all"
                >
                  Go to Templates
                </motion.a>
                <motion.a
                  href="/pricing"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-block px-6 py-3 border border-zinc-700 hover:bg-zinc-800 text-white text-base font-medium rounded-lg transition-all"
                >
                  See Pricing
                </motion.a>
              </div>
            ) : isProd ? (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <div className="px-6 py-3 bg-zinc-700 text-white text-base font-medium rounded-lg shadow-lg opacity-70 cursor-not-allowed">
                  Log In (Coming Soon)
                </div>
                <motion.a
                  href="/pricing"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-block px-6 py-3 border border-zinc-700 hover:bg-zinc-800 text-white text-base font-medium rounded-lg transition-all"
                >
                  See Pricing
                </motion.a>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <motion.a
                  href="/login"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-base font-medium rounded-lg shadow-lg transition-all"
                >
                  Log In to Get Started
                </motion.a>
                <motion.a
                  href="/pricing"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-block px-6 py-3 border border-zinc-700 hover:bg-zinc-800 text-white text-base font-medium rounded-lg transition-all"
                >
                  See Pricing
                </motion.a>
              </div>
            )}
          </div>
        </main>

        {/* --- Featured demos row --- */}
        <section className="relative z-10 w-full border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <div className="flex items-end justify-between gap-3 mb-6">
              <div className="text-left">
                <h3 className="text-2xl font-semibold">{featuresTitle}</h3>
                <p className="text-sm text-zinc-400">
                  {featuresSubtitle}
                </p>
              </div>
              <Link href="/features" className="inline-flex">
                <button className="inline-flex h-9 items-center rounded-md border border-zinc-700 px-3 text-sm hover:bg-zinc-800">
                  See all features
                </button>
              </Link>
            </div>

            {featLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-zinc-500/30">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-full overflow-hidden rounded-md border border-zinc-700/60">
                    <div className="animate-pulse aspect-video bg-zinc-800/50" />
                    <div className="p-4">
                      <div className="h-4 w-1/2 bg-zinc-800/70 rounded animate-pulse mb-2" />
                      <div className="h-3 w-full bg-zinc-800/50 rounded mb-2 animate-pulse" />
                      <div className="h-3 w-3/4 bg-zinc-800/50 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-3 gap-6 border-zinc-500/30">
                {featured.map((f) => (
                  <div key={f.id} className="h-full flex flex-col overflow-hidden rounded-md border border-zinc-700/60">
                    <div className="aspect-video w-full border-b border-zinc-700/60 overflow-hidden">
                      {f.video_url ? (
                        <LazyVideoEmbed url={f.video_url} title={f.title} className="h-full w-full" />
                      ) : (
                        <div className="h-full w-full grid place-items-center text-zinc-400 text-sm bg-zinc-900/60">
                          Demo coming soon
                        </div>
                      )}
                    </div>
                    <div className="p-4 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="text-base font-medium">{f.title}</div>
                        {f.badge ? (
                          <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200">
                            {f.badge}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="px-4 pb-4 text-sm text-zinc-400">
                      {f.blurb}
                      <div className="mt-4">
                        <Link href={`/features?q=${encodeURIComponent(f.title)}`} className="inline-flex">
                          <button className="inline-flex h-8 items-center rounded-md border border-zinc-700 px-3 text-xs hover:bg-zinc-800">
                            {f.video_url ? 'Watch demo' : 'Learn more'}
                          </button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
                {featured.length === 0 && (
                  <div className="col-span-full rounded-md border border-zinc-700/60">
                    <div className="py-10 text-center text-zinc-400">
                      No featured items yet. Mark some features as “Featured” in Admin.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <footer className="relative z-10 text-center text-xs text-zinc-600 py-4 border-t border-zinc-700/50">
          &copy; {new Date().getFullYear()} {siteDomain} — All rights reserved.
          <span className="mx-2">|</span>
          <a href="/pricing" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">Pricing</a>
          <span className="mx-1">•</span>
          <a href="/legal/privacy" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">Privacy</a>
          <span className="mx-1">•</span>
          <a href="/legal/terms" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">Terms</a>

          {/* 🔹 Only include the widget if the org wants it */}
          {showWidget && <QuickSitesWidget forceVariant={widgetVariant as HomepageWidgetVariant} />}
        </footer>
      </div>
    </>
  );
}
