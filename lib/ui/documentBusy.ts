'use client';

// lib/ui/documentBusy.ts
//
// Mark the DOCUMENT as busy while a multi-second wait is on screen.
//
// ⚠️ WHY THIS EXISTS: STABILITY IS NOT READINESS.
//
// Anything that reads a page by extracting text — an automated browser, a scraper, one of
// HiveJournal's browsing personas — needs to know when the page is DONE. The obvious heuristic
// is "wait until the text stops changing," and it correctly catches text that is still
// arriving (a typewriter, a streaming response).
//
// It cannot catch the opposite failure, and the opposite failure is ours. A loading state is
// MAXIMALLY STABLE: "✨ Generating your site — writing your copy and a hero image (~20s)…" does
// not change for twenty seconds. A settle-on-stability reader sees a string that isn't growing,
// concludes the page has finished, and extracts a loading screen as if it were the product.
// Growth-based settling distinguishes "still arriving" from "arrived" — it cannot distinguish
// "finished" from "not started."
//
// That window is not hypothetical here. It is the guest build path: /build → create → editor,
// where first open auto-runs copy + hero generation and gpt-image-1 takes ~20s.
//
// So we say so, in the one place a reader can check without knowing anything about our
// components: `aria-busy="true"` on <body>. Standard ARIA, already meaningful to assistive
// tech, and a single attribute rather than a bespoke convention every consumer must learn.
//
// REFERENCE COUNTED on purpose: two waits can overlap (the full-screen BrandLoader during
// creation, the autogen bar once the editor opens). If each cleared the flag on unmount, the
// first one to finish would report the document ready while the second was still running —
// reintroducing the exact bug, but harder to see.

import { useEffect } from 'react';

let busyCount = 0;

/** Increment the document-busy refcount, returning a release fn. Safe on the server (no-op). */
export function markDocumentBusy(): () => void {
  if (typeof document === 'undefined') return () => {};
  busyCount += 1;
  document.body.setAttribute('aria-busy', 'true');
  let released = false;
  return () => {
    if (released) return; // a double-release must not decrement someone else's hold
    released = true;
    busyCount = Math.max(0, busyCount - 1);
    if (busyCount === 0) document.body.removeAttribute('aria-busy');
  };
}

/**
 * Flag <body aria-busy="true"> for as long as `active` is true.
 *
 * Use for waits long enough that someone (or something) could read the page mid-flight —
 * site generation, publish, a long save. Not for a button spinner; that belongs on the button.
 */
export function useDocumentBusy(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return markDocumentBusy();
  }, [active]);
}
