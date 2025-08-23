// app/page.tsx
'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Head from 'next/head';
import BackgroundGlow from '@/components/background-glow';
import GlowConfigurator, { GlowConfig } from '@/components/glow-configurator';
import { useState, useEffect } from 'react';
import QuickSitesWidget from '@/components/quick-sites-widget';
import event from '@vercel/analytics';
import { useSafeAuth } from '../hooks/useSafeAuth';
import { SiteFlags } from '@/lib/site-config';
import useMediaQuery from '@/hooks/useMediaQuery';

const isProd = process.env.NODE_ENV === 'production';

const defaultGlowConfig = {
  size: 'xl',
  intensity: 0.2,
  colors: ['from-indigo-600', 'via-blue-400', 'to-fuchsia-500'],
};

const features = [
  "🚀 AI-generated websites in seconds",
  "🧠 Built-in SEO optimization",
  "📱 Mobile-ready, always",
  "🎨 Fully customizable designs",
  "🔒 Secure & privacy-respecting",
];

export default function HomePage() {
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
  const { user, role, isLoggedIn } = useSafeAuth();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const showWidget = SiteFlags.showMobileWidget || !isMobile;
  const showGlow = SiteFlags.showMobileGradients || !isMobile;

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
    <div className="relative min-h-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
      <Head>
        <title>QuickSites | One Click Websites</title>
        <meta name="description" content="Launch your local business site in seconds with AI." />
      </Head>
      {showGlow && (
        <>
          <BackgroundGlow />
          <GlowConfigurator defaultGlowConfig={defaultGlowConfig as GlowConfig} />
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

          {isLoggedIn && role !== 'guest' ? (
            <motion.a
              href="/admin/tools"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="inline-block mt-4 px-6 py-3 bg-green-600 hover:bg-green-700 text-white text-base font-medium rounded-lg shadow-lg transition-all"
            >
              Go to Admin Tools
            </motion.a>
          ) : isProd ? (
            <div className="mt-4 px-6 py-3 bg-zinc-700 text-white text-base font-medium rounded-lg shadow-lg opacity-70 cursor-not-allowed">
              Log In (Coming Soon)
            </div>
          ) : (
            <motion.a
              href="/login"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="inline-block mt-4 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-base font-medium rounded-lg shadow-lg transition-all"
              >
                Log In to Get Started
              </motion.a>
            )}                      
        </div>
      </main>

      <footer className="relative z-10 text-center text-xs text-zinc-600 py-4">
        &copy; {new Date().getFullYear()} QuickSites.ai — All rights reserved.
        <span className="mx-2">|</span>
        <a href="/legal/privacy" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">Privacy</a>
        <span className="mx-1">•</span>
        <a href="/legal/terms" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">Terms</a>

        {/* Widget always loaded */}
        <QuickSitesWidget forceVariant="puppy" />
      </footer>

    </div>
  );
}
