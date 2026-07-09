# Layout L4 — True Nested Multi-Column Sections (design + scope)

> The one remaining piece of [`LAYOUT_VARIATION_PLAN.md`](LAYOUT_VARIATION_PLAN.md):
> a real `section`/`columns` container that holds child blocks **side-by-side**,
> editable via drag-and-drop. This doc scopes it from a read-only editor-impact
> spike and proposes a phased plan that ships the visible payoff **before** the
> expensive part.

Status: **scoped, not started.** Prereq: PR #245 (theme + layout L1–L3) merges first.

---

## 1. What the spike found (the shape of the problem)

- **The page is a flat `Block[]` everywhere** — DnD, insert/replace, autosave paths,
  validation. Nesting is not modeled except in one place.
- **`grid` is the only nesting primitive, and it's a dead-end**: its nested-edit UI
  (`grid.tsx` `SortableGridBlock`/`BlockSidebar`) only activates when a caller threads
  `handleNestedBlockUpdate` — which **the production editor
  (`LiveEditorPreviewFrame`) never does**. It's hard-coded to `type==='grid'`
  ([`render-block.tsx:545`](../components/admin/templates/render-block.tsx#L545)), index-based,
  and one level deep. **Reuse its ideas, not its machinery.**
- **Two things are already recursive / cheap:**
  - **Schema** — `BlockSchema` is `z.lazy(...)` and `grid` already does
    `items: z.array(z.lazy(() => BlockSchema))`
    ([`blockSchema.ts:395`](../admin/lib/zod/blockSchema.ts#L395)). A `section` container
    reuses this verbatim. *Lowest-risk part.*
  - **Render** — a container renders children by calling `RenderBlock` per child
    (grid already does). A `section.tsx` renderer is straightforward. *Low risk.*
- **The autosave patch bus ships the entire block array as the patch `value`**
  ([`template-editor-content.tsx:216`](../components/admin/templates/template-editor-content.tsx#L216)),
  so a nested tree **persists fine** as long as the getter/setter produce it. The one
  brittle spot: the mirror regex
  ([`LiveEditorPreviewFrame.tsx:548`](../components/editor/live-editor/LiveEditorPreviewFrame.tsx#L548))
  only matches depth-1 array paths.
- **The hard part is exactly one thing: cross-container drag-and-drop.** The whole
  production editor is a single flat dnd-kit `SortableContext` + `verticalListSortingStrategy`
  + `arrayMove(from,to)` on one array (`applyReorder`, `LiveEditorPreviewFrame.tsx:581`).
  Dragging a block *between* columns is a fundamentally different dnd-kit architecture
  (per-container droppables, custom collision, `onDragOver` moves, tree reconstruction).

## 2. The nested model

A new container block type — `section` (alias `columns`):

```ts
// blockContentSchemaMap entry (admin/lib/zod/blockSchema.ts) — reuses the grid idiom
section: {
  columns: z.array(z.object({
    span: z.number().int().min(1).max(12).optional(),      // grid span
    items: z.array(z.lazy(() => BlockSchema)).default([]),  // child blocks
  })).default([]),
  gap: z.enum(['sm','md','lg']).optional(),
  vAlign: z.enum(['start','center','stretch']).optional(),
  reverseOnMobile: z.boolean().optional(),                  // stack order on small screens
}
```

Renders (`components/admin/templates/render-blocks/section.tsx`, new) as a CSS grid of
columns; each column maps its `items` → `RenderBlock`. Stacks to one column on mobile.
Theme-aware for free (children already use semantic tokens after the block sweep).

## 3. The refactor that unlocks it: recursive tree helpers

Replace the flat `findIndex`/`splice` operations with `_id`-keyed tree ops (new
`lib/blocks/tree.ts`), then point the editor at them:

```ts
findBlockById(tree, id): { block, parentItems, index } | null   // recurse into container children
replaceBlockById(tree, id, next): Block[]
insertBlockInto(tree, containerId, colIdx, index, block): Block[]
removeBlockById(tree, id): Block[]
moveBlock(tree, id, target): Block[]                            // target = {containerId?, colIdx?, index}
```

Callers to migrate (all currently flat):
`template-editor-content.tsx` `replaceBlockById`/`insertBlockAfter`/`getPageBlocks`
(so **editing a nested child actually saves** — today `replaceBlockById` can't find it
and silently no-ops), and `LiveEditorPreviewFrame`'s accessor. Replace the
`type==='grid'` special-case with a **container-type registry** so `grid` + `section`
share one path.

## 4. Phased plan — ship the payoff before the hard DnD

### L4.0 — Sections that render + scaffold emits them (NO cross-container DnD)
- Add the `section` schema + `section.tsx` recursive renderer (theme-aware, mobile-stacking).
- Add recursive `findBlockById`/`replaceBlockById` so **editing a child inside a section
  saves** via the existing edit drawer (selection is already `_id`-based).
- Teach the L3 archetypes / `industryScaffold` to **emit sections**: a real **split-hero**
  (`section` = [text+cta | image]) and **about-beside-image**, driven by the theme's
  `layout.heroLayout === 'split'` (currently mapped to `inline`).
- **Payoff:** generated sites get genuine side-by-side layouts immediately; children are
  editable via the drawer. No dnd-kit rewrite. This satisfies most of "not just a stack"
  for *generated* sites at a fraction of the cost.

### L4.1 — Generic container editing (within a column)
- Recursive tree helpers everywhere (`insert`/`remove`/`move`); container registry replaces
  `=== 'grid'`. Unify grid + section under one model.
- Add child add/delete/reorder **within** a single column (one `SortableContext` per column —
  no cross-container yet). Column controls: add/remove column, span, gap.

### L4.2 — Cross-container drag-and-drop (the hard part)
- Multi-container dnd-kit in `LiveEditorPreviewFrame`: per-container droppables, custom
  collision detection, `onDragOver` to move between containers, tree reconstruction on drop.
- Drag blocks between columns, into/out of sections, and at the top level.
- Fix the mirror regex (`LiveEditorPreviewFrame.tsx:548`) to handle nested paths, or keep
  whole-array patching (already the case) and drop the regex mirror for nested ops.

### L4.3 — Polish
- Recurse `validateTemplateBlocks` (nested children currently unvalidated).
- Banding/width interplay with sections; per-column theme banding rules.
- Editor affordances: column-count presets, drag handles, empty-column placeholders.

## 5. Effort / risk

| Phase | Effort | Risk | Delivers |
|---|---|---|---|
| L4.0 | S–M | Low | Side-by-side generated sites, drawer-editable |
| L4.1 | M | Low–Med | Unified container editing, in-column reorder |
| L4.2 | **L** | **High** | Full drag-anywhere UX (the make-or-break) |
| L4.3 | S–M | Low | Validation + polish |

**Biggest risk/unknown (L4.2):** the production editor's single flat `SortableContext` +
`arrayMove` cannot express cross-container moves; that engine must be substantially
rewritten and it *is* the core editing UX. Everything else (schema, render, persistence,
scaffold emission) is comparatively cheap.

## Progress

- ✅ **L4.0** (render + scaffold, no cross-container DnD): `section` block registered
  (schema with recursive `columns[].items`, renderer, category, default content,
  createDefaultBlock); `section.tsx` renders columns side-by-side (fr spans) and
  stacks on mobile, theme-aware. `industryScaffold` emits a 2-column "About | Why
  choose us" section after the hero for split-layout themes (warm/professional).
  Tests in `archetype.test.ts`.
- ✅ **L4.1** (nested-child in-place editing): `lib/blocks/tree.ts` — recursive
  `findBlockById`/`replaceBlockById` that descend into `section`/`grid` children
  (unit-tested, immutability-preserving). The editor's `editingBlockObj` +
  `replaceBlockById` now use them, so editing/saving a nested child works. The
  `section` renderer shows a per-child "Edit" affordance in the editor (iframe →
  `preview:edit-block` postMessage; inline → `qs:edit-block` CustomEvent, both
  routed to the block editor). `LiveEditorPreviewFrame` sets `__QS_EDITOR__` for
  inline detection.

## 6. Recommendation

**Do L4.0 first as its own PR after #245 lands** — it delivers the visible "blocks
side-by-side" win for generated sites using the already-recursive schema + render, plus a
contained recursive-lookup fix, with **no dnd-kit rewrite**. Then decide whether L4.2's
full drag-anywhere editing is worth its cost, or whether drawer-based nested editing
(L4.0/L4.1) is enough for the product. Don't start L4.2 until L4.0 proves the model in prod.
