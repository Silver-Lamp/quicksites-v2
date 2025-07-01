'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

const features = [
  '🚀 AI-generated websites in seconds',
  '🧠 Built-in SEO optimization',
  '📱 Mobile-ready, always',
  '🎨 Fully customizable designs',
  '🔒 Secure & privacy-respecting',
];

export default function PuppyWidget() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);

  const LOCAL_KEY = 'quicksites::pup-expanded';

  // Rotate feature messages every 3s
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeatureIndex((i) => (i + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Load expansion state from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LOCAL_KEY);
      if (saved === 'true') setIsExpanded(true);
    }
  }, []);

  // Save expansion state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_KEY, isExpanded.toString());
    }
  }, [isExpanded]);

  return (
    <div className="fixed bottom-4 right-4 z-50 group hidden md:block">
      {/* Floating Circular Puppy */}
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        className="cursor-pointer w-24 h-24 rounded-full overflow-hidden border-2 border-white shadow-lg transition-all hover:scale-105"
        title="Click to learn more"
      >
        <video
          src="/videos/pet-dog-2-small.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
        />
      </div>

      {/* Tooltip on hover */}
      <AnimatePresence>
        {!isExpanded && (
          <motion.div
            key="tooltip"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-28 right-0 w-[240px] bg-zinc-900 text-white text-xs rounded-lg shadow-xl p-3 border border-zinc-700 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100"
          >
            <div className="font-semibold text-sm text-indigo-400 mb-1">Did you know?</div>
            <p className="text-zinc-300 leading-snug">{features[currentFeatureIndex]}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Info Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-32 right-0 w-[280px] bg-zinc-950 border border-zinc-700 rounded-lg shadow-2xl p-4 space-y-3 text-white text-sm"
          >
            <h3 className="font-semibold text-lg text-indigo-400">QuickSites Features</h3>
            <ul className="list-disc pl-5 space-y-1 text-zinc-300">
              {features.map((f, i) => (
                <li key={i}>{f.replace(/^.+? /, '')}</li>
              ))}
            </ul>
            <Link
              // href="/login"
              className="block text-center mt-2 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition"
            >
              Log In to Explore (Coming Soon)
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
