'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white">
      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
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

          <motion.a
            href="/login"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            className="inline-block mt-4 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-base font-medium rounded-lg shadow-lg transition-all"
          >
            Log In to Get Started
          </motion.a>
        </div>
      </main>

      {/* Sticky Footer */}
      <footer className="text-center text-xs text-zinc-600 py-4">
        &copy; {new Date().getFullYear()} QuickSites.ai — All rights reserved.
      </footer>
    </div>
  );
}
