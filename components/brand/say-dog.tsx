'use client';

// "Say Dog" — a friendly video mascot pinned bottom-right that pops a speech bubble when tapped.
// The toggle-able, config-driven generalization of the homepage PuppyWidget. Bubble content
// comes from the MascotConfig source: QuickSites features, HiveJournal's daily quote (fetched
// via /api/mascot/quote), or owner-written business facts. Each tap advances to the next line.

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { MascotConfig } from '@/lib/mascot/config';

const DOG_VIDEO = '/videos/pet-dog-2-small.mp4';

export default function SayDog({
  config,
  messages,
  siteId,
}: {
  config: MascotConfig;
  /** Pre-resolved lines for 'features'/'facts'. For 'quote' the dog fetches its own line. */
  messages: string[];
  /** Passed as `ref` to the quote proxy for per-site attribution. */
  siteId?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [idx, setIdx] = React.useState(0);
  const [quote, setQuote] = React.useState<{ quote: string; author: string } | null>(null);
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Quote source: fetch the daily line once, lazily on first interest.
  const loadQuote = React.useCallback(async () => {
    if (config.source !== 'quote' || quote) return;
    try {
      const r = await fetch(`/api/mascot/quote?ref=${encodeURIComponent(siteId || 'anonymous')}`, {
        cache: 'no-store',
      });
      if (r.ok) {
        const j = await r.json();
        if (j?.quote) setQuote({ quote: j.quote, author: j.author || '' });
      }
    } catch {
      /* ignore — bubble just won't show for the quote source */
    }
  }, [config.source, quote, siteId]);

  const armAutoHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setOpen(false), 6000);
  };

  const onTap = async () => {
    if (config.source === 'quote') {
      await loadQuote();
      setOpen((o) => !o);
      armAutoHide();
      return;
    }
    if (!messages.length) return;
    // Toggle open on first tap; advance on subsequent taps while open.
    setOpen((o) => {
      if (!o) return true;
      setIdx((i) => (i + 1) % messages.length);
      return true;
    });
    armAutoHide();
  };

  React.useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    []
  );

  const title = config.title || (config.source === 'quote' ? 'Quote of the day' : 'Did you know?');
  const bubbleText =
    config.source === 'quote'
      ? quote
        ? `“${quote.quote}”${quote.author ? ` — ${quote.author}` : ''}`
        : null
      : messages[idx];

  // Nothing to say (e.g. facts source with no facts + no services) → don't render.
  if (config.source !== 'quote' && !messages.length) return null;

  return (
    <div className="fixed bottom-2 right-4 z-50">
      <div className="relative h-[60px] w-[60px]">
        <motion.div
          onClick={onTap}
          whileTap={{ scale: 1.15 }}
          className="absolute bottom-0 right-0 h-16 w-16 cursor-pointer overflow-hidden rounded-full border-2 border-white shadow-lg transition-all hover:scale-105 md:h-24 md:w-24"
          title="Tap me!"
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={DOG_VIDEO}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
          />
        </motion.div>

        <AnimatePresence>
          {open && bubbleText && (
            <motion.div
              key="bubble"
              initial={{ opacity: 0, x: -40, y: 10 }}
              animate={{ opacity: 1, x: -40, y: 0 }}
              exit={{ opacity: 0, x: -40, y: 10 }}
              transition={{ duration: 0.25 }}
              className="absolute bottom-[100px] left-[-200px] w-[240px] rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs text-white shadow-xl"
            >
              <div className="mb-1 text-sm font-semibold text-indigo-400">{title}</div>
              <p className="leading-snug text-zinc-300">{bubbleText}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
