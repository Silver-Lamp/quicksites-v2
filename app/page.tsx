'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

export default function HomePage() {
  return (
    <main className="relative min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      {/* Background SVG */}
      <svg
        className="absolute inset-0 w-full h-full opacity-10 animate-pulse pointer-events-none"
        viewBox="0 0 1024 1024"
        fill="none"
      >
        <circle cx="512" cy="512" r="400" stroke="url(#grad)" strokeWidth="1" />
        <defs>
          <radialGradient id="grad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
      </svg>

      {/* Logo & Title */}
      <div className="z-10 text-center space-y-6">
        <div className="flex items-center justify-center gap-3">
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

        <p className="text-zinc-400 text-lg max-w-xl mx-auto">
          Turn your local business into a digital presence in minutes. No code. No hassle.
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
        &copy; {new Date().getFullYear()} QuickSites.ai — All rights reserved.
      </footer>
    </main>
  );
}
