'use client';

// Types a string out character-by-character with a blinking caret, then calls
// onDone. Code-point safe (won't split emoji/surrogate pairs) and respects
// prefers-reduced-motion (renders instantly). Reusable anywhere a line should
// feel "spoken" to the user.
import * as React from 'react';

export default function Typewriter({
  text,
  speed = 26,
  startDelay = 300,
  onDone,
  className,
}: {
  text: string;
  speed?: number;
  startDelay?: number;
  onDone?: () => void;
  className?: string;
}) {
  const chars = React.useMemo(() => Array.from(text), [text]);
  const [n, setN] = React.useState(0);
  const onDoneRef = React.useRef(onDone);
  onDoneRef.current = onDone;

  React.useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setN(chars.length);
      onDoneRef.current?.();
      return;
    }
    setN(0);
    let i = 0;
    let interval: ReturnType<typeof setInterval>;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setN(i);
        if (i >= chars.length) {
          clearInterval(interval);
          onDoneRef.current?.();
        }
      }, speed);
    }, startDelay);
    return () => {
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [chars, speed, startDelay]);

  const done = n >= chars.length;
  return (
    <span className={className} aria-label={text}>
      <span aria-hidden>{chars.slice(0, n).join('')}</span>
      {!done && (
        <>
          <span
            aria-hidden
            className="ml-0.5 inline-block w-[2px] animate-pulse bg-current align-middle"
            style={{ height: '1em' }}
          />
          {/*
            The untyped remainder stays in the DOM, transparent — never removed. Two reasons,
            and the first is why this changed:

            1. ANIMATE PRESENTATION, NEVER CONTENT. While typing, the visible text is a partial
               sentence, so anything reading rendered text (an automated browser, a scraper, a
               screenshot-and-extract agent) sees a truncated claim for the first seconds. The
               a11y tree was always fine — the wrapper carries aria-label={text} — but that only
               covers readers that consult it. `opacity-0` keeps the words in the text layer, so
               the full sentence is readable at every instant while still appearing to type.
            2. No reflow. The line reserves its final width up front instead of pushing
               neighbouring content around character by character.
          */}
          <span aria-hidden className="opacity-0">
            {chars.slice(n).join('')}
          </span>
        </>
      )}
    </span>
  );
}
