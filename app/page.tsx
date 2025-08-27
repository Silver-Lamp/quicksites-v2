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

// shadcn/ui
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// supabase
import { createClient as createBrowserClient } from '@supabase/supabase-js';
import LazyVideoEmbed from '@/components/ui/lazy-video-embed';


const isProd = process.env.NODE_ENV === 'production';

const defaultGlowConfig = {
  size: 'xl',
  intensity: 0.2,
  colors: ['from-indigo-600', 'via-blue-400', 'to-fuchsia-500'],
};

const features = [
  '🚀 AI-generated websites in seconds',
  '🧠 Built-in SEO optimization',
  '📱 Mobile-ready, always',
  '🎨 Fully customizable designs',
  '🔒 Secure & privacy-respecting',
];

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

export default function HomePage() {
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
  const { user, role, isLoggedIn } = useSafeAuth();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const showWidget = SiteFlags.showMobileWidget || !isMobile;
  const showGlow = SiteFlags.showMobileGradients || !isMobile;

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
        const { data, error } = await supabase
          .from('features')
          .select('*')
          .eq('featured', true)
          .order('feature_order', { ascending: true, nullsFirst: false }) // ← new
          .order('created_at', { ascending: false })                      // tie-break
          .limit(6);
        if (!error && mounted) setFeatured((data || []) as FeatureRow[]);
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
      setCurrentFeatureIndex((i) => (i + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const traceId = document?.body?.dataset?.traceId ?? '';
      const sessionId = document?.body?.dataset?.sessionId ?? '';

      event.track('landing_page_viewed', {
        user: user?.id || user?.email || 'guest',
        role,
        isLoggedIn,
        feature: features[currentFeatureIndex],
        traceId,
        sessionId,
      });
    }
  }, [user?.id, user?.email, role, isLoggedIn, currentFeatureIndex]);

  return (
    <>
    <SiteHeader sticky={true} />
    <div className="relative min-h-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
      <Head>
        <title>QuickSites | One Click Websites</title>
        <meta name="description" content="Launch your local business site in seconds with AI." />
      </Head>

      {showGlow && (
        <>
          <BackgroundGlow />
          {/* <GlowConfigurator defaultGlowConfig={defaultGlowConfig as GlowConfig} /> */}
        </>
      )}

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="space-y-6 max-w-xl">
          <div className="flex justify-center items-center gap-3">
            <Image
              src="/favicon.ico"
              width={40}
              height={40}
              alt="QuickSites Logo"
              className="rounded-full"
            />
            <h1 className="text-3xl font-bold tracking-tight text-white">QuickSites</h1>
          </div>

          <motion.h2
            className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Your Website. One Click Away.
          </motion.h2>

          <p className="text-zinc-400 text-lg">
            Turn your local business into a digital presence in minutes. No code. No hassle.
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
            <h3 className="text-2xl font-semibold">Featured demos</h3>
            <p className="text-sm text-zinc-400">
              Hand-picked highlights from what QuickSites can do.
            </p>
          </div>
          <Link href="/features" className="inline-flex">
            <Button variant="outline" size="sm">See all features</Button>
          </Link>
        </div>

        {featLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-zinc-500/30">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="h-full overflow-hidden">
                <div className="animate-pulse aspect-video bg-zinc-800/50" />
                <CardHeader className="pb-2">
                  <div className="h-4 w-1/2 bg-zinc-800/70 rounded animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="h-3 w-full bg-zinc-800/50 rounded mb-2 animate-pulse" />
                  <div className="h-3 w-3/4 bg-zinc-800/50 rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-3 gap-6 border-zinc-500/30">
            {featured.map((f) => (
              <Card key={f.id} className="h-full flex flex-col overflow-hidden">
                <div className="aspect-video w-full border-b border-zinc-500/30 overflow-hidden">
                  {f.video_url ? (
                    <LazyVideoEmbed url={f.video_url} title={f.title} className="h-full w-full" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-zinc-400 text-sm bg-zinc-900/60">
                      Demo coming soon
                    </div>
                  )}
                </div>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{f.title}</CardTitle>
                    {f.badge ? <Badge variant="secondary">{f.badge}</Badge> : null}
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-zinc-400">
                  {f.blurb}
                  <div className="mt-4">
                    <Link href={`/features?q=${encodeURIComponent(f.title)}`} className="inline-flex">
                      <Button size="sm" variant="secondary">
                        {f.video_url ? 'Watch demo' : 'Learn more'}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
            {featured.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="py-10 text-center text-zinc-400">
                  No featured items yet. Mark some features as “Featured” in Admin.
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </section>

      <footer className="relative z-10 text-center text-xs text-zinc-600 py-4 border-t border-zinc-500/30">
        &copy; {new Date().getFullYear()} QuickSites.ai — All rights reserved.
        <span className="mx-2">|</span>
        <a href="/pricing" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">Pricing</a>
        <span className="mx-1">•</span>
        <a href="/legal/privacy" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">Privacy</a>
        <span className="mx-1">•</span>
        <a href="/legal/terms" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">Terms</a>

        {/* Widget always loaded */}
        <QuickSitesWidget forceVariant="puppy" />
      </footer>
    </div>
    </>
  );
}
