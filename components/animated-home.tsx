// components/animated-home.tsx
'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useBrand } from '@/app/providers';

type Branding = {
  name?: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  hero?: { headline?: string; subhead?: string };
  domain?: string;
};

export default function AnimatedHome() {
  const brand = (useBrand?.() as Branding) || {};
  const productName = brand.name || 'QuickSites';
  const logoSrc = brand.logoUrl || brand.faviconUrl || '/favicon.ico';
  const headline = brand.hero?.headline || 'Your Website. One Click Away.';
  const subhead = brand.hero?.subhead || 'Turn your local business into a digital presence in minutes. No code. No hassle.';
  const domain = brand.domain || 'QuickSites.ai';

  return (
    <main className="relative min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-6 py-12 overflow-hidden">

      {/* Logo & Title */}
      <div className="z-10 text-center space-y-6">
        <div className="flex items-center justify-center gap-3">
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
          {headline}
        </motion.h2>

        <p className="text-zinc-400 text-lg max-w-xl mx-auto">
          {subhead}
        </p>

        <motion.a
          href="/login"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          className="inline-block mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-base font-medium rounded-lg shadow-lg transition-all"
        >
          Log In to Get Started
        </motion.a>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-6 text-xs text-zinc-600 z-10">
        &copy; {new Date().getFullYear()} {domain} — All rights reserved.
      </footer>
    </main>
  );
}
