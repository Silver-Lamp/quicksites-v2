'use client';

// lib/ui/bodyScrollLock.ts
//
// Lock/unlock page scrolling while an overlay is open — REFCOUNTED, so overlapping owners
// can't leave the page permanently stuck.
//
// ⚠️ THE BUG THIS REPLACES. Three components each did the obvious thing independently
// (modal-shell, drawer-shell, template-editor-content):
//
//     const prevOverflow = body.style.overflow;   // save
//     body.style.overflow = 'hidden';             // lock
//     return () => { body.style.overflow = prevOverflow; };   // restore
//
// That is correct for ONE owner and wrong for two. If a drawer opens while a modal is already
// open, the drawer saves `'hidden'` as its "previous" value — so when it closes it restores
// `'hidden'`, and if the modal has already unmounted there is nobody left to clear it. The page
// is scroll-locked with no overlay on screen and nothing to click to fix it. A reload is the
// only way out, and the user cannot tell why.
//
// The failure needs two overlays and an out-of-order unmount, which is exactly why it survives
// review: every component is individually right, and the bug lives in the space between them.
// Same shape as the `link`/`href` drift and the two block arrays — no wrong line anywhere,
// just two copies of one piece of state.
//
// A counter fixes it: the first lock saves the real previous value and applies the lock; nested
// locks only increment; the last release restores. Identical discipline to
// `lib/ui/documentBusy.ts`, which refcounts `aria-busy` for the same reason.
//
// ⚠️ NOT A CLAIM ABOUT A REPORTED BUG. This was found while investigating a "can't scroll"
// report on /merchant/audio. That page uses NO modal or drawer, so this is very unlikely to be
// its cause — see the note in the PR. It is a real defect found on the way, not the fix for
// that symptom.

let depth = 0;
let prevOverflow = '';
let prevPadRight = '';

/**
 * Lock body scrolling. Returns the release function — call it exactly once.
 *
 * Safe to nest: only the outermost lock touches the DOM, and only the last release restores.
 */
export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') return () => {};

  const body = document.body;
  const html = document.documentElement;

  if (depth === 0) {
    html.style.setProperty('scrollbar-gutter', 'stable');
    prevOverflow = body.style.overflow;
    prevPadRight = body.style.paddingRight;

    // Compensate for the scrollbar's width so the page doesn't shift sideways as it locks.
    const scrollbar = window.innerWidth - html.clientWidth;
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    body.style.overflow = 'hidden';
  }
  depth += 1;

  let released = false;
  return () => {
    // Guard double-release: React can invoke a cleanup twice in StrictMode, and a stray extra
    // call would decrement the count below the number of real owners and unlock too early.
    if (released) return;
    released = true;

    depth = Math.max(0, depth - 1);
    if (depth === 0) {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadRight;
    }
  };
}

/** Test-only: how many owners currently hold the lock. */
export function __lockDepth(): number {
  return depth;
}
