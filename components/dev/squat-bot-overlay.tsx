'use client';

import { useEffect, useState } from 'react';
import { PanelLeftClose, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';

const quotes = [
  "Those margins? I've seen toddlers space better.",
  "Your layout slaps. Not in the good way.",
  "Hero block looking heroic — I’ll allow it.",
  "That's a lot of padding... compensating for something?",
  "Your colors are bold. Bold like Comic Sans.",
  "Fast site. Faster than your squat depth.",
  "This layout's tighter than my quad routine.",
  "CTA needs a glow-up. Or a nap.",
  "Your font hierarchy is a social hierarchy.",
  "I'm not saying it's bad... but I'm not not saying that.",
];

function getRandomQuote() {
  return quotes[Math.floor(Math.random() * quotes.length)];
}

export default function SquatBotOverlay() {
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState(getRandomQuote());

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === '.' && e.metaKey && e.shiftKey) {
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      setQuote(getRandomQuote());
    }, 10000);
    return () => clearInterval(id);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-50 bg-purple-600 text-white p-3 rounded-full shadow-lg hover:bg-purple-700 transition-all"
        aria-label="Toggle SquatBot"
      >
        <Sparkles className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-20 right-4 z-50 w-[300px] bg-neutral-900 text-white rounded-xl shadow-lg border border-white/10"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-purple-300">
                  🦾 SquatBot v0.1
                </h2>
                <button
                  onClick={() => setOpen(false)}
                  className="text-white/70 hover:text-white"
                  aria-label="Close SquatBot"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm italic">{quote}</p>
              <div className="mt-4 text-xs text-zinc-400">
                Tip: <code className="bg-zinc-800 px-1 rounded">⌘+⇧+.</code> to toggle
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
