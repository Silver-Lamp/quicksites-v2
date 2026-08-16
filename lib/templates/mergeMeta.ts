// lib/templates/mergeMeta.ts
//
// ⚠️ THE EDITOR'S COPY OF `data.meta` IS NOT AUTHORITATIVE, SO A SAVE MAY NOT REPLACE IT.
//
// The editor posts its whole in-memory `data` blob, which means `meta` arrives complete and
// overwrites the stored object. Every key the browser's copy did not happen to hold is deleted
// — with no edit to that key, no warning, and nothing on screen to notice.
//
// Two losses on renton-lemonade-fxny inside one hour, both this:
//   • `meta.ecom.merchant_id`, written server-side through the sanctioned commit RPC, was gone
//     after the next settings save. The menu kept its "Add to order" buttons (those live under
//     `pages`) while the site lost its link to the merchant that can charge a card — a store
//     that looks open with no till behind it.
//   • A Venmo handle saved in the settings panel rendered in the preview and never reached the
//     row, because the toolbar serialised a `meta` captured before the patch landed.
//
// Same shape both times: a last-writer-wins whole-object write racing an out-of-band one.
// Merging makes the loss impossible rather than unlikely — a save can only change the keys it
// actually carries.
//
// Deleting now requires an explicit `null`. That is the right trade: silent deletion is not a
// feature anyone asked for, and every real deletion here (clearing a Venmo handle, unsetting a
// merchant) is a deliberate act that can afford to say so.

const isPlainObject = (v: any): v is Record<string, any> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Merge an incoming `data.meta` over the stored one. `null` on a key deletes it; anything else
 * replaces that key wholesale (shallow — a nested object is a value, not something to merge into,
 * so a panel that owns `meta.ecom` still writes it as a unit).
 *
 * Returns `incoming` unchanged when there is nothing stored to protect, and `stored` when there
 * is no incoming object — a save that carries no meta must not blank it.
 */
export function mergeTemplateMeta(stored: any, incoming: any): any {
  if (!isPlainObject(incoming)) return isPlainObject(stored) ? stored : incoming;
  if (!isPlainObject(stored)) return incoming;

  const merged: Record<string, any> = { ...stored };
  for (const [k, v] of Object.entries(incoming)) {
    if (v === null) delete merged[k];
    else merged[k] = v;
  }
  return merged;
}
