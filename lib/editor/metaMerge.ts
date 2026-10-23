// lib/editor/metaMerge.ts
//
// ⚠️ `qs:template:merge` WITH A `{ meta }` PAYLOAD HAD NO LISTENER THAT SAVED IT (found 2026-10-23).
// The hero editor sends every site-type / industry choice — including the free text typed under
// "Other" — as `qs:template:merge { meta: {...} }`. The only listener was the identity side panel,
// mounted only while the sidebar is open, so the choice reached no template state and no save:
// a customer typed "Consulting", pressed Next, and the editor asked "What kind of site are you
// building?" again every time she opened the hero (recorded walkthrough, 2026-10-22). Same shape
// as the `qs:toolbar:save-now` bug — a dispatcher with no listener cannot fail loudly.
//
// The toolbar now applies a META-ONLY merge. Anything else on this event (a whole server template
// after a commit, a `{ data }` payload) is still ignored here: those callers pair the merge with
// `qs:template:apply-patch`, and applying a server copy over in-flight local edits would be wrong.

/** The meta fields to merge, when `detail` is exactly `{ meta: {...} }`; otherwise null. */
export function metaOnlyMerge(detail: unknown): Record<string, unknown> | null {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null;
  const keys = Object.keys(detail as object);
  if (keys.length !== 1 || keys[0] !== 'meta') return null;
  const meta = (detail as { meta?: unknown }).meta;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  return meta as Record<string, unknown>;
}

/** `data` with `meta` merged one level deep; never drops pages or other data keys. */
export function applyMetaMerge<D extends { meta?: unknown }>(data: D | null | undefined, meta: Record<string, unknown>): D {
  const base = (data ?? {}) as D;
  const cur = (base.meta && typeof base.meta === 'object' ? base.meta : {}) as Record<string, unknown>;
  return { ...base, meta: { ...cur, ...meta } } as D;
}
