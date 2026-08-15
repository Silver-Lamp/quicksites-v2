// lib/ui/toolbarClearance.ts
//
// ⚠️ THE FLOATING EDITOR TOOLBAR SITS AT THE Z-INDEX CEILING, AND YOU CANNOT OUTRANK IT.
//
// `TemplateActionToolbar` renders `fixed bottom-4 z-[2147483647]` — INT32_MAX. Any panel with a
// bottom action bar therefore has its Save button covered whenever the toolbar is visible, and
// no z-index will fix it: at equal z the winner is DOM order, and the toolbar renders last.
//
// This has now cost three separate bugs, all reported as "it won't save" when the save path was
// perfectly fine:
//   • hero editor  — an operator picked an image, saw it in the preview, and had no reachable
//                    way to commit it. Closing the modal was the only available action, and
//                    closing discards local state (#802).
//   • menu editor  — "Save menu" half-behind the toolbar.
//   • site settings — the sticky save bar, same.
//
// The fix is spatial, not ordinal: reserve vertical space so the action bar sits ABOVE the strip
// the toolbar occupies. A component that does not need to be frontmost cannot lose a race for it.
//
// Use `TOOLBAR_CLEARANCE` on the footer/action bar of any panel that can be open while the editor
// toolbar is on screen. Do not "simplify" it to a z-index — that is the fix that already failed.

/**
 * Bottom margin that clears the floating editor toolbar (its own height plus its `bottom-4`
 * offset, with room for focus rings). Tailwind class so it participates in the same spacing
 * scale as everything around it.
 */
export const TOOLBAR_CLEARANCE = 'mb-24';

/**
 * Same clearance as padding, for containers that scroll their own content — a margin on a
 * sticky child collapses differently than padding on the scroll container, and the sticky
 * footers in the block editors need the margin form.
 */
export const TOOLBAR_CLEARANCE_PADDING = 'pb-24';
