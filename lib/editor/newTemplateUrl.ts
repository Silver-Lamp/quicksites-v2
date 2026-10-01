// lib/editor/newTemplateUrl.ts
//
// "This template was just created" — the one signal the editor had no way to know.
//
// ⚠️ WHY A SHARED HELPER RATHER THAN A PARAM TYPED AT EACH CALL SITE. There are SIX places that
// navigate into the editor straight after creating a template, across four files (the admin
// chooser's two branches, the guest hero's two flows, the start-your-site chooser, and duplicate
// from the card grid). Appending `?created=1` by hand at each is the exact shape of bug this repo
// keeps hitting: a seventh path appears later, silently misses it, and the only symptom is a
// drawer covering the hero on one route — which looks like nothing. `newTemplateEditorUrl()` is
// the one spelling, and `creationPathsUseHelper.test.ts` fails if a creation site hand-rolls one.
//
// The flag means exactly "a human just made this, show them the canvas", and nothing else. It is
// NOT a general first-run marker: the walkthrough (`?walkthrough=1`, DB-backed) and the coach hint
// (`qs:editor:coachHintDismissed`, localStorage) are separate mechanisms and stay separate.

export const NEW_TEMPLATE_PARAM = 'created';

/**
 * Where to send someone whose template was just created.
 *
 * `edit` picks the `/edit` sub-route some callers use; both land in the same editor.
 */
export function newTemplateEditorUrl(id: string, opts: { edit?: boolean } = {}): string {
  const base = `/admin/templates/${encodeURIComponent(id)}${opts.edit ? '/edit' : ''}`;
  return `${base}?${NEW_TEMPLATE_PARAM}=1`;
}

/**
 * Read the flag and strip it from the address bar, so a refresh is an ordinary editor load.
 *
 * ⚠️ Strips via `history.replaceState`, NOT a router navigation: re-rendering the editor to drop
 * a query param would remount the preview the flag exists to reveal.
 */
export function consumeNewTemplateFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get(NEW_TEMPLATE_PARAM) !== '1') return false;
    url.searchParams.delete(NEW_TEMPLATE_PARAM);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    return true;
  } catch {
    return false;
  }
}
