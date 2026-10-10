'use client';
/**
 * True when this render is happening inside the builder/preview rather than on a published site.
 *
 * Client-only by nature — it reads `window`/`document`. On the server it returns false, which
 * deliberately errs toward "this is public, say nothing".
 *
 * ⚠️ "INSIDE AN IFRAME" IS NOT "INSIDE THE EDITOR" (2026-10-10). The first version returned true
 * for any frame, so the Evolve page — which frames a restaurant's draft as an exhibit — showed
 * the owner "Paste your embed ID to add narrated audio" and every other owner-only hint, which
 * reads as broken software. The editor's LivePreviewPane is the only frame that counts, and it
 * is same-origin on an /admin/ path; a cross-origin parent (deliveredmenu.com framed by
 * quicksites.ai) cannot be read at all, which is exactly the public case.
 */
export function isEditorParentPath(pathname: string | null | undefined): boolean {
  return typeof pathname === 'string' && pathname.startsWith('/admin/');
}

function framedByEditor(): boolean {
  try {
    if (typeof window.parent === 'undefined' || window.parent === window) return false;
    // Throws for a cross-origin parent — which is the answer: not our editor.
    return isEditorParentPath(window.parent.location.pathname);
  } catch {
    return false;
  }
}

export function isEditorContext(previewOnly?: boolean): boolean {
  if (previewOnly) return true;
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const inlineHints =
    document.body?.classList?.contains?.('qs-editor') === true ||
    (window as any).__QS_EDITOR__ === true;
  return inlineHints || framedByEditor();
}
