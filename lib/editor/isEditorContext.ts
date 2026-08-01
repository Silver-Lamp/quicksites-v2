'use client';

// lib/editor/isEditorContext.ts
//
// "Am I being rendered inside the builder, or on somebody's live website?"
//
// ⚠️ WHY THIS IS SHARED. Block renderers carry hints written for the SITE OWNER — "No services
// configured", "Map unavailable", "No links configured." Those are useful in the editor and
// corrosive in public: a visitor reads them as a business that is half-built, or as our software
// failing. One of them even named an internal data path (`template.data.services`) on a
// customer-facing page.
//
// The footer had this detection inline. services.tsx and header.tsx had none at all, and shipped
// their hints to visitors. Copying the footer's three-line check into each renderer would put
// the rule in three places, two of which would drift — the same argument the painterly contract
// makes about rules 7/8/9 living in one component. So it lives here, once.
//
// The signals, in the order they became necessary:
//   • an iframe        — the editor renders the site in one
//   • `qs-editor` on   — the inline (non-iframe) editor marks the body
//     the body / a
//     window flag
//   • an explicit prop — callers that already know (previewOnly) pass it in
//
// ⚠️ IT MUST FAIL CLOSED, AND "CLOSED" HERE MEANS *PUBLIC*. During SSR there is no window, so
// this returns false and the hint is omitted. That is the right default: a hint missing from the
// editor for one render costs an owner nothing, while a hint shown to a customer is the bug.

/**
 * True when this render is happening inside the builder/preview rather than on a published site.
 *
 * Client-only by nature — it reads `window`/`document`. On the server it returns false, which
 * deliberately errs toward "this is public, say nothing".
 */
export function isEditorContext(previewOnly?: boolean): boolean {
  if (previewOnly) return true;
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const inIframe = typeof window.parent !== 'undefined' && window.parent !== window;
  const inlineHints =
    document.body?.classList?.contains?.('qs-editor') === true ||
    (window as any).__QS_EDITOR__ === true;

  return inIframe || inlineHints;
}
