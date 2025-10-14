'use client';

import * as React from 'react';

type Props = {
  words: string[];
  typingMsPerChar?: number;    // default 70
  deletingMsPerChar?: number;  // default 40
  pauseAfterWordMs?: number;   // default 900
  className?: string;          // tailwind classes for positioning/size
  gradientClassName?: string;  // tailwind gradient (bg-clip-text text-transparent)
  glowClassName?: string;      // drop-shadow glow
  ariaLabel?: string;          // screen-reader label
  loop?: boolean;
};

export default function TypewriterGlow({
  words,
  typingMsPerChar = 70,
  deletingMsPerChar = 40,
  pauseAfterWordMs = 900,
  className = '',
  gradientClassName = 'bg-gradient-to-r from-emerald-300 via-teal-300 to-sky-300 bg-clip-text text-transparent',
  glowClassName = 'drop-shadow-[0_0_20px_rgba(16,185,129,0.35)]',
  ariaLabel = 'highlighted service',
  loop = true,
}: Props) {
  const [i, setI] = React.useState(0);           // which word
  const [sub, setSub] = React.useState(0);       // how many chars are shown
  const [del, setDel] = React.useState(false);   // deleting?
  const [hold, setHold] = React.useState(false); // pausing at full word?

  const word = words[i] ?? '';

  React.useEffect(() => {
    if (!words.length) return;

    if (!del && sub === word.length && !hold) {
      setHold(true);
      const t = setTimeout(() => setHold(false), pauseAfterWordMs);
      return () => clearTimeout(t);
    }

    const ms = del ? deletingMsPerChar : typingMsPerChar;
    const t = setTimeout(() => {
      if (hold) return;

      if (!del) {
        // typing
        if (sub < word.length) setSub(sub + 1);
        else setDel(true);
      } else {
        // deleting
        if (sub > 0) setSub(sub - 1);
        else {
          setDel(false);
          const next = i + 1;
          if (next < words.length) setI(next);
          else if (loop) setI(0);
        }
      }
    }, ms);

    return () => clearTimeout(t);
  }, [sub, del, hold, i, word, words.length, typingMsPerChar, deletingMsPerChar, pauseAfterWordMs, loop]);

  const visible = word.slice(0, sub);

  return (
    <span
      className={`inline-flex items-baseline font-semibold ${className}`}
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      <span className={`${gradientClassName} ${glowClassName}`}>{visible}</span>
      <span className="tw-cursor ml-[2px]" aria-hidden="true" />
      {/* component-scoped cursor keyframes */}
      <style jsx>{`
        .tw-cursor {
          display: inline-block;
          width: 1ch;
          border-right: 2px solid rgba(240, 253, 244, 0.9);
          animation: tw-blink 1s steps(2, start) infinite;
        }
        @keyframes tw-blink {
          to { border-right-color: transparent; }
        }
      `}</style>
    </span>
  );
}
