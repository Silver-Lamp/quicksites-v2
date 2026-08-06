// components/admin/templates/block-editors/heroEditorState.ts
//
// When may the hero editor throw away what the operator is doing and reload from the block?
//
// ⚠️ ONLY WHEN IT IS A DIFFERENT BLOCK. Extracted from hero-editor.tsx because the answer was
// previously "whenever `initialLocal`'s identity changes", and that memo depends on `template` —
// a fresh object on every autosave round-trip. The result was an editor that discarded an
// in-flight image choice before the operator could press Save.
//
// It lives in its own module so the rule can be tested without mounting a 1,500-line editor, and
// so the next person changing it has to read this comment first.

/**
 * `prev` and `next` are block identities (`_id` ?? `id`), not content hashes.
 *
 * Content changing is NOT a reason to reload: the operator's unsaved edits are, by definition,
 * newer than anything the block can tell us.
 */
export function shouldReloadLocal(prev: string | null | undefined, next: string | null | undefined): boolean {
  return String(prev ?? '') !== String(next ?? '');
}
