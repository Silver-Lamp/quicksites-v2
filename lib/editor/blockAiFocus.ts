'use client';

// Bridges the canvas "AI" block button (LiveEditorPreviewFrame) to a block
// editor's AI panel: the button calls requestBlockAiFocus(blockId), the matching
// editor attaches useBlockAiFocus(blockId) to its AI section, and on open the
// section scrolls into view + briefly flashes. Handles both the "editor mounts
// after the click" case (module-level pending) and the "editor already open"
// case (qs:block:ai event).

import * as React from 'react';

let pendingBlockId: string | null = null;

/** Fired by the canvas AI button; opens/targets the given block's AI panel. */
export function requestBlockAiFocus(blockId: string) {
  pendingBlockId = blockId || null;
  try {
    window.dispatchEvent(new CustomEvent('qs:block:ai', { detail: { blockId } }));
  } catch {}
}

/** Attach the returned ref to a block editor's AI section. */
export function useBlockAiFocus<T extends HTMLElement = HTMLDivElement>(blockId?: string | null) {
  const ref = React.useRef<T | null>(null);

  const focus = React.useCallback(() => {
    let tries = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        catch { el.scrollIntoView(); }
        el.classList.add('qs-ai-flash');
        window.setTimeout(() => el.classList.remove('qs-ai-flash'), 1600);
        return;
      }
      // The panel may render a beat late (async editor / step change) — retry briefly.
      if (tries++ < 8) window.setTimeout(tick, 150);
    };
    tick();
  }, []);

  // Editor mounted just after the button was clicked → consume the pending id.
  React.useEffect(() => {
    if (blockId && pendingBlockId === blockId) {
      pendingBlockId = null;
      focus();
    }
  }, [blockId, focus]);

  // Editor already open when the button is clicked.
  React.useEffect(() => {
    const onAi = (e: Event) => {
      const id = (e as CustomEvent).detail?.blockId;
      if (blockId && id === blockId) {
        pendingBlockId = null;
        focus();
      }
    };
    window.addEventListener('qs:block:ai', onAi as EventListener);
    return () => window.removeEventListener('qs:block:ai', onAi as EventListener);
  }, [blockId, focus]);

  return ref;
}
