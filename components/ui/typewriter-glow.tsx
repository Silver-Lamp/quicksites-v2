// components/ui/typewriter-glow.tsx
'use client';

import * as React from 'react';

type Mode = 'delete' | 'clear';

type Props = {
  words: string[];
  typingMsPerChar?: number;    // default 70
  deletingMsPerChar?: number;  // default 40
  pauseAfterWordMs?: number;   // default 900
  className?: string;
  gradientClassName?: string;
  glowClassName?: string;
  ariaLabel?: string;
  loop?: boolean;
  mode?: Mode;                  // NEW: 'delete' (backspace) | 'clear' (jump)
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
  mode = 'delete',
}: Props) {
  const [i, setI] = React.useState(0);         // which word index
  const [sub, setSub] = React.useState(0);     // visible characters
  const [del, setDel] = React.useState(false); // deleting stage?
  const [hold, setHold] = React.useState(false);

  const wordsSafe = words?.filter(Boolean) ?? [];
  const word = wordsSafe[i] ?? '';

  React.useEffect(() => {
    if (wordsSafe.length === 0) return;

    // reached full word → pause
    if (!del && sub === word.length && !hold) {
      setHold(true);
      const t = setTimeout(() => setHold(false), pauseAfterWordMs);
      return () => clearTimeout(t);
    }

    // while paused, do nothing
    if (hold) return;

    // choose interval based on stage
    const ms = del ? deletingMsPerChar : typingMsPerChar;
    const t = setTimeout(() => {
      if (!del) {
        // typing forward
        if (sub < word.length) return setSub(sub + 1);
        // finished typing → either start delete, or jump (clear mode)
        if (mode === 'delete') return setDel(true);
        // clear mode: instantly move to next word
        setSub(0);
        const next = i + 1;
        if (next < wordsSafe.length) setI(next);
        else if (loop) setI(0);
      } else {
        // deleting backwards
        if (sub > 0) return setSub(sub - 1);
        // move to next word
        setDel(false);
        const next = i + 1;
        if (next < wordsSafe.length) setI(next);
        else if (loop) setI(0);
      }
    }, ms);

    return () => clearTimeout(t);
  }, [
    i,
    sub,
    del,
    hold,
    word,
    wordsSafe.length,
    typingMsPerChar,
    deletingMsPerChar,
    pauseAfterWordMs,
    loop,
    mode,
  ]);

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
      <style jsx>{`
        .tw-cursor {
          display: inline-block;
          width: 1ch;
          border-right: 2px solid rgba(240, 253, 244, 0.9);
          animation: tw-blink 1s steps(2, start) infinite;
        }
        @keyframes tw-blink { to { border-right-color: transparent; } }
      `}</style>
    </span>
  );
}
