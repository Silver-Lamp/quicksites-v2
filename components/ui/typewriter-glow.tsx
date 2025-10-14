// components/ui/typewriter-glow.tsx
'use client';

import * as React from 'react';

type Mode = 'delete' | 'clear';

type Props = {
  words: string[];
  typingMsPerChar?: number;
  deletingMsPerChar?: number;
  pauseAfterWordMs?: number;
  className?: string;
  gradientClassName?: string;
  glowClassName?: string;
  ariaLabel?: string;
  loop?: boolean;
  mode?: Mode;                 // 'delete' backspaces; 'clear' jumps to next word
  reserve?: 'max' | 'none';    // NEW: 'max' = reserve width/height with ghost
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
  reserve = 'max',
}: Props) {
  const list = (words ?? []).filter(Boolean);
  const [index, setIndex] = React.useState(0);
  const [sub, setSub] = React.useState(0);
  const [phase, setPhase] = React.useState<'typing' | 'pause' | 'deleting'>('typing');

  const word = list[index] ?? '';
  const longest = React.useMemo(() => list.reduce((a, b) => (b.length > a.length ? b : a), ''), [list]);

  React.useEffect(() => {
    if (index >= list.length) setIndex(0);
  }, [list.length, index]);

  React.useEffect(() => {
    if (!list.length) return;
    let t: ReturnType<typeof setTimeout> | undefined;

    if (phase === 'typing') {
      if (sub < word.length) {
        t = setTimeout(() => setSub((n) => n + 1), typingMsPerChar);
      } else {
        setPhase('pause');
      }
    } else if (phase === 'pause') {
      t = setTimeout(() => {
        if (mode === 'delete') {
          setPhase('deleting');
        } else {
          const next = index + 1;
          setIndex(next < list.length ? next : loop ? 0 : index);
          setSub(0);
          setPhase('typing');
        }
      }, pauseAfterWordMs);
    } else if (phase === 'deleting') {
      if (sub > 0) {
        t = setTimeout(() => setSub((n) => n - 1), deletingMsPerChar);
      } else {
        const next = index + 1;
        setIndex(next < list.length ? next : loop ? 0 : index);
        setPhase('typing');
      }
    }

    return () => t && clearTimeout(t);
  }, [
    list.length,
    word,
    index,
    sub,
    phase,
    typingMsPerChar,
    deletingMsPerChar,
    pauseAfterWordMs,
    loop,
    mode,
  ]);

  const visible = word.slice(0, sub);

  // Wrapper reserves the size of the LONGEST word so no layout shift occurs.
  return (
    <span
      className={`relative inline-block align-baseline ${className}`}
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      {reserve === 'max' && (
        <span
          aria-hidden="true"
          className="invisible select-none whitespace-nowrap"
        >
          {longest || ' '}
        </span>
      )}

      <span
        className={`absolute inset-0 ${reserve === 'none' ? '' : 'whitespace-nowrap'}`}
        // ensure the overlay sits exactly atop the reserved box
      >
        <span className={`${gradientClassName} ${glowClassName}`}>{visible}</span>
        <span className="tw-cursor ml-[2px]" aria-hidden="true" />
      </span>

      <style jsx>{`
        .tw-cursor {
          display: inline-block;
          width: 1ch;                  /* fixed caret width → no width jitter */
          border-right: 2px solid rgba(240, 253, 244, 0.9);
          animation: tw-blink 1s steps(2, start) infinite;
          vertical-align: baseline;
        }
        @keyframes tw-blink { to { border-right-color: transparent; } }
      `}</style>
    </span>
  );
}
