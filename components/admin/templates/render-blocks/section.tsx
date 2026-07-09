// components/admin/templates/render-blocks/section.tsx
'use client';

// Multi-column section: renders each column's child blocks side-by-side on desktop
// and stacked on mobile. Columns size by their `span` (fr units). Transparent
// wrapper so the page/banded background + theme show through; children are ordinary
// blocks (theme-token styled) rendered via RenderBlock. The nesting foundation for
// L4 (docs/LAYOUT_L4_PLAN.md).

import * as React from 'react';
import RenderBlock from '../render-block';
import { normalizeBlock } from '@/lib/utils/normalizeBlock';

type Col = { span?: number; items?: any[] };

/** In the editor (iframe or same-window flag), a nested child can request its own
 *  editor via the existing preview:edit-block bridge (handled by LiveEditorPreviewFrame). */
function useEditorContext(): boolean {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    const inIframe = typeof window !== 'undefined' && window.parent !== window;
    const flag = typeof window !== 'undefined' && (window as any).__QS_EDITOR__ === true;
    setOn(inIframe || flag);
  }, []);
  return on;
}

function requestEditBlock(id: string) {
  try {
    if (window.parent && window.parent !== window) {
      // Iframe preview → the frame's message bridge forwards to the editor.
      window.parent.postMessage({ type: 'preview:edit-block', blockId: id }, '*');
    } else {
      // Inline preview (same window) → the editor listens for this directly.
      window.dispatchEvent(new CustomEvent('qs:edit-block', { detail: { id } }));
    }
  } catch {
    /* no-op */
  }
}

/** Container child ops (move/delete/add): inline → CustomEvent; iframe → bridge. */
function emitChildOp(
  op: 'qs:move-child' | 'qs:move-child-col' | 'qs:move-child-to' | 'qs:delete-child' | 'qs:add-child',
  detail: any,
) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'preview:child-op', op, detail }, '*');
    } else {
      window.dispatchEvent(new CustomEvent(op, { detail }));
    }
  } catch {
    /* no-op */
  }
}

/** Wrap a click handler so it never bubbles to the block/section selection. */
const stop = (fn: () => void) => (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  fn();
};

const GAP: Record<string, string> = { sm: 'gap-4', md: 'gap-8', lg: 'gap-12' };
const ALIGN: Record<string, string> = { start: 'items-start', center: 'items-center', stretch: 'items-stretch' };

function pickContent(block: any, override: any) {
  return (override ?? block?.content ?? block?.props ?? {}) as any;
}

export default function SectionRender(props: any) {
  const { block, content, template, colorMode, previewOnly, device } = props ?? {};
  const c = pickContent(block, content);
  const editorCtx = useEditorContext();
  // Native drag-and-drop state (editor only): the id being dragged + the column
  // currently hovered, for the drop highlight. Scoped to this section — does not
  // touch the top-level dnd-kit reorder.
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = React.useState<number | null>(null);

  const columns: Col[] = (Array.isArray(c.columns) ? c.columns : []).filter(
    (col: any) => col && Array.isArray(col.items),
  );
  if (!columns.length) return null;

  const gapCls = GAP[c.gap] ?? GAP.md;
  const alignCls = ALIGN[c.align] ?? ALIGN.stretch;
  const reverse = c.reverseOnMobile ? 'flex-col-reverse' : 'flex-col';
  // Desktop column proportions from spans (fr units) via a CSS var so it can be
  // responsive (mobile = single column, md+ = the fr template).
  const cols = columns.map((col) => `${col.span && col.span > 0 ? col.span : 1}fr`).join(' ');

  return (
    <section className="w-full px-4 py-10 md:px-6 lg:px-8">
      {c.title ? (
        <h2 className="mx-auto mb-6 max-w-6xl text-2xl font-bold tracking-tight text-foreground">{c.title}</h2>
      ) : null}
      <div
        className={`mx-auto flex max-w-6xl ${reverse} md:grid md:[grid-template-columns:var(--qs-cols)] ${gapCls} ${alignCls}`}
        style={{ ['--qs-cols' as any]: cols }}
      >
        {columns.map((col, i) => {
          const items = (Array.isArray(col.items) ? col.items : []).map((b: any) => normalizeBlock(b));
          const sectionId = String(block?._id ?? block?.id ?? '');
          return (
            <div
              key={i}
              className={`min-w-0 rounded-md transition ${editorCtx && dragOverCol === i ? 'ring-2 ring-primary/60' : ''}`}
              onDragOver={editorCtx ? (e) => { if (draggingId) { e.preventDefault(); setDragOverCol(i); } } : undefined}
              onDrop={editorCtx ? (e) => {
                e.preventDefault();
                if (draggingId) emitChildOp('qs:move-child-to', { id: draggingId, sectionId, colIdx: i });
                setDraggingId(null);
                setDragOverCol(null);
              } : undefined}
            >
              {items.map((b: any, j: number) => {
                const cid = String(b?._id ?? b?.id ?? '');
                const child = (
                  <RenderBlock
                    block={b}
                    template={template}
                    colorMode={colorMode}
                    previewOnly={previewOnly}
                    device={device}
                    showDebug={false}
                  />
                );
                // In the editor, overlay a hover toolbar so nested children can be
                // edited / reordered / removed in place (L4.1 + L4.2).
                if (!editorCtx || !cid) return <div key={cid || j}>{child}</div>;
                return (
                  <div
                    key={cid}
                    className="group/qsb relative cursor-move rounded-md"
                    draggable
                    onDragStart={(e) => {
                      setDraggingId(cid);
                      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', cid); } catch { /* no-op */ }
                    }}
                    onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
                    onDragOver={(e) => {
                      if (draggingId && draggingId !== cid) { e.preventDefault(); e.stopPropagation(); setDragOverCol(i); }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (draggingId && draggingId !== cid) {
                        emitChildOp('qs:move-child-to', { id: draggingId, sectionId, colIdx: i, beforeId: cid });
                      }
                      setDraggingId(null);
                      setDragOverCol(null);
                    }}
                    style={draggingId === cid ? { opacity: 0.4 } : undefined}
                  >
                    <div className="absolute right-1.5 top-1.5 z-20 hidden items-center gap-0.5 rounded-md bg-black/75 p-0.5 text-white shadow group-hover/qsb:flex">
                      <button type="button" title="Edit" onClick={stop(() => requestEditBlock(cid))} className="rounded px-1.5 py-0.5 text-[11px] font-medium hover:bg-white/20">Edit</button>
                      <button type="button" title="Move up" onClick={stop(() => emitChildOp('qs:move-child', { id: cid, dir: 'up' }))} className="rounded px-1 py-0.5 text-xs hover:bg-white/20">↑</button>
                      <button type="button" title="Move down" onClick={stop(() => emitChildOp('qs:move-child', { id: cid, dir: 'down' }))} className="rounded px-1 py-0.5 text-xs hover:bg-white/20">↓</button>
                      {columns.length > 1 ? (
                        <button type="button" title="Move to next column" onClick={stop(() => emitChildOp('qs:move-child-col', { id: cid, dir: 'next' }))} className="rounded px-1 py-0.5 text-xs hover:bg-white/20">⇄</button>
                      ) : null}
                      <button type="button" title="Delete" onClick={stop(() => emitChildOp('qs:delete-child', { id: cid }))} className="rounded px-1 py-0.5 text-xs text-red-300 hover:bg-white/20">✕</button>
                    </div>
                    {child}
                  </div>
                );
              })}
              {editorCtx && sectionId ? (
                <button
                  type="button"
                  onClick={stop(() => emitChildOp('qs:add-child', { sectionId, colIdx: i }))}
                  className="mt-2 w-full rounded-md border border-dashed border-border py-1.5 text-xs text-muted-foreground transition hover:bg-muted"
                >
                  + Add block
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
