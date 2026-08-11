'use client';

// Publish a fixed bottom bar's height as a CSS variable, so the layers above it can sit clear.
//
// ⚠️ THREE THINGS OWNED THE SAME PIXEL. On an unclaimed restaurant draft the phone's bottom edge
// carried the claim bar (`bottom-0`), the mobile order bar (`bottom-0`) and the "Hear this page"
// launcher (`bottom-4`) — all fixed, all positioned against the viewport, none aware the others
// existed. Whichever had the highest z-index won and the rest were simply underneath it.
//
// ⚠️ AND A HARD-CODED OFFSET WOULD NOT FIX IT. The claim bar's height is not a constant: it stacks
// on mobile, its copy changes ("Is this your restaurant?" vs "N people tried to order"), and the
// order bar is present on some drafts and not others. Any `bottom-[7rem]` is right for one
// combination of content and wrong the moment the copy changes — the kind of fix that looks
// correct in the screenshot that prompted it and breaks silently everywhere else.
//
// So each bar measures ITSELF and publishes its own height. Nothing needs to know what else is on
// screen; the stack composes from whatever happens to be mounted.

import * as React from 'react';

export function useFixedBottomVar<T extends HTMLElement>(varName: string) {
  const ref = React.useRef<T | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!el) return;

    const write = () => root.style.setProperty(varName, `${el.offsetHeight}px`);
    write();

    // Height changes with copy, wrapping and orientation — observe rather than measure once.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(write) : null;
    ro?.observe(el);
    window.addEventListener('resize', write);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', write);
      // ⚠️ Clear on unmount. A stale variable would leave the layers above floating over a gap
      // where a bar used to be — a dismissed claim bar leaving a hole is worse than the overlap.
      root.style.removeProperty(varName);
    };
  }, [varName]);

  return ref;
}
