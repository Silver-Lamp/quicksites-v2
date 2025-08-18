'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useMediaQuery from '@/hooks/useMediaQuery';
import event from '@vercel/analytics';

const features = [
  '🚀 AI-generated websites in seconds',
  '🧠 Built-in SEO optimization',
  '📱 Mobile-ready, always',
  '🎨 Fully customizable designs',
  '🔒 Secure & privacy-respecting',
];

export default function PuppyWidget({ showOnMobile = true }: { showOnMobile?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeatureIndex((i) => (i + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTooltipVisible(true);

      if (isMobile) {
        const autoHide = setTimeout(() => {
          setTooltipVisible(false);
          setTooltipDismissed(true);
          event.track('tooltip_auto_hidden', { isMobile: true });
        }, 7000);
        return () => clearTimeout(autoHide);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isMobile]);

  const handleClick = () => {
    event.track('puppy_clicked', { isMobile });
    setIsExpanded((prev) => !prev);
    setTooltipVisible(false);
    setTooltipDismissed(false);
  };

  return (
    <div className={`fixed bottom-2 right-4 z-50 md:block ${showOnMobile ? '' : 'hidden'}`}>
      <div className="relative w-[60px] h-[60px]">
        {/* Puppy Video pinned to bottom right */}
        <motion.div
          onClick={handleClick}
          whileTap={isMobile ? { scale: 1.15 } : undefined}
          className="absolute bottom-0 right-0 cursor-pointer w-16 h-16 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-white shadow-lg transition-all hover:scale-105"
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
        </motion.div>

        {/* Tooltip - final position tweak */}
        <AnimatePresence>
          {!isExpanded && tooltipVisible && (
            <motion.div
              key="tooltip"
              initial={{ opacity: 0, x: isMobile ? 10 : -50, y: isMobile ? 30 : 0 }}
              animate={{ opacity: 1, x: isMobile ? 10 : -50, y: isMobile ? 30 : 0 }}
              exit={{ opacity: 0, x: isMobile ? 10 : -50, y: isMobile ? 30 : 0 }}
              transition={{ duration: 0.3 }}
              className="absolute left-[-200px] bottom-[100px] w-[220px] sm:w-[240px] bg-zinc-900 text-white text-xs rounded-lg shadow-xl p-3 border border-zinc-700
                relative pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100"
            >
              <div className="font-semibold text-sm text-indigo-400 mb-1">Did you know?</div>
              <p className="text-zinc-300 leading-snug">{features[currentFeatureIndex]}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.95, y: isMobile ? -50 : -50, x: isMobile ? 0 : -20 }}
              animate={{ opacity: 1, scale: 1, y: isMobile ? -50 : -50, x: isMobile ? 0 : -20 }}
              exit={{ opacity: 0, scale: 0.95, y: isMobile ? -50 : -50, x: isMobile ? 0 : -20 }}
              transition={{ duration: 0.3 }}
              className="absolute left-[-260px] bottom-[140px] w-[280px] bg-zinc-950 border border-zinc-700 rounded-lg shadow-2xl p-4 space-y-3 text-white text-sm
                relative pointer-events-auto"
            >
              <h3 className="font-semibold text-lg text-indigo-400">QuickSites Features</h3>
              <ul className="list-none pl-5 space-y-1 text-zinc-300">
                {features.map((f, i) => (
                  <li key={i}>{f.replace(/^.+? /, '')}</li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Show tip button */}
        {tooltipDismissed && !isExpanded && (
          <button
            onClick={() => {
              setTooltipVisible(true);
              setTooltipDismissed(false);
              event.track('tooltip_manually_restored', { isMobile });
            }}
            className="absolute bottom-0 right-0 translate-y-full mt-2 text-xs text-zinc-400 hover:text-white underline"
          >
            Show tip
          </button>
        )}
      </div>
    </div>
  );
}