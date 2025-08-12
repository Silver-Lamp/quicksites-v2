// components/admin/templates/render-block.tsx
'use client';

import type { Block } from '@/types/blocks';
import { BlockType } from '@/types/blocks';
import { JSX } from 'react';
import { useBlockFix } from '@/components/ui/block-fix-context';
import DebugOverlay from '@/components/ui/debug-overlay';
import HeroRender from '@/components/admin/templates/render-blocks/hero';
import { DYNAMIC_RENDERERS } from '@/lib/dynamic-renderers';
import { blockContentSchemaMap } from '@/admin/lib/zod/blockSchema';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import TextRender from '@/components/admin/templates/render-blocks/text';

const isDev =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

/** Inline renderer for `text` blocks (rich HTML from Tiptap or legacy value) */
// function TextRender({
//   content,
//   compact,
// }: {
//   content: any;
//   compact?: boolean;
// }): JSX.Element {
//   const html = content?.html ?? content?.value ?? '';
//   return (
//     <div
//       className={`prose max-w-none ${compact ? 'prose-sm' : 'lg:prose-lg'}`}
//       dangerouslySetInnerHTML={{ __html: html }}
//     />
//   );
// }

const STATIC_RENDERERS: Partial<Record<BlockType, (props: any) => JSX.Element>> =
  {
    hero: HeroRender,
    text: TextRender,
  };

function assertAllRenderersCovered() {
  const handled = new Set([
    ...Object.keys(STATIC_RENDERERS),
    ...Object.keys(DYNAMIC_RENDERERS),
  ]);
  const missing = Object.keys(blockContentSchemaMap).filter(
    (type: string) => !handled.has(type)
  );
  if (missing.length > 0) {
    const msg = `[🛑 BLOCK_RENDERERS] Missing renderers for: ${missing.join(', ')}`;
    if (isDev) throw new Error(msg);
    else console.warn(msg);
  }
}

assertAllRenderersCovered();

function resolveRenderer(type: BlockType) {
  if (type in STATIC_RENDERERS)
    return STATIC_RENDERERS[type as keyof typeof STATIC_RENDERERS];
  if (type in DYNAMIC_RENDERERS) return DYNAMIC_RENDERERS[type];
  return fallbackRenderer(type);
}

type RenderProps = {
  block: Block;
  handleNestedBlockUpdate?: (updated: Block) => void;
  mode?: 'preview' | 'editor';
  disableInteraction?: boolean;
  compact?: boolean;
  previewOnly?: boolean;
  showDebug?: boolean;
  colorMode?: 'light' | 'dark';

  /** Optional editor actions wired by parent (no change to existing callers) */
  onEdit?: (block: Block) => void;
  onDelete?: (block: Block) => void;
};

export default function RenderBlock({
  block,
  handleNestedBlockUpdate,
  mode = 'preview',
  disableInteraction = false,
  compact = false,
  previewOnly = false,
  showDebug = false,
  colorMode = 'light',
  onEdit,
  onDelete,
}: RenderProps) {
  const { enabled: fixEnabled, draftFixes } = useBlockFix();

  if (!block || !block.type) {
    return (
      <div className="text-red-500 text-sm p-2 bg-red-900/10 rounded">
        ⚠️ Invalid block: missing or undefined type
      </div>
    );
  }

  const override = fixEnabled ? draftFixes[block._id || ''] : {};
  const safeContent = { ...block.content, ...override };

  const commonProps = {
    block,
    content: safeContent,
    mode,
    disableInteraction,
    compact,
    previewOnly,
    showDebug,
    colorMode,
  };

  // Hover-to-reveal border & controls via group + group-hover
  const wrapperProps = {
    'data-block-id': block._id || 'unknown',
    'data-block-type': block.type,
    className: [
      'relative group w-full rounded-md transition-colors',
      colorMode === 'light'
        ? 'bg-white text-black'
        : 'bg-neutral-950 text-white',
      // Border hidden until hover:
      'border border-transparent group-hover:border-neutral-200',
      'dark:group-hover:border-neutral-700',
    ].join(' '),
    ref: (el: HTMLDivElement | null) => {
      if (el) (el as any).__squatterContent = safeContent;
    },
  };

  const debugOverlay = showDebug ? (
    <DebugOverlay position="bottom-right">
      {`[Block: ${block.type}]
ID: ${block._id || 'n/a'}`}
    </DebugOverlay>
  ) : null;

  const Component = resolveRenderer(block.type);

  const showControlsBar =
    mode === 'editor' && !previewOnly && !disableInteraction;

  return (
    <div {...wrapperProps}>
      {/* Controls bar (hidden until hover) */}
      {showControlsBar && (
        <div
          className={[
            'pointer-events-none', // allow underlying content interactions unless over a button
            'absolute inset-x-0 -top-px', // sit on the border
            // Start hidden; reveal on hover
            'opacity-0 group-hover:opacity-100 transition-opacity',
            // Slight backdrop for contrast
            colorMode === 'light'
              ? 'bg-white/70'
              : 'bg-neutral-900/60',
            'flex items-center justify-between px-2 py-1 rounded-t-md',
            // Draw the border line only when hovered (matches wrapper on hover)
            'border border-transparent group-hover:border-neutral-200 dark:group-hover:border-neutral-700',
          ].join(' ')}
          // Let buttons be clickable
          style={{ pointerEvents: 'auto' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* Grab handle */}
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded cursor-grab active:cursor-grabbing"
              title="Drag to reorder"
              aria-label="Drag handle"
              data-dnd-handle
            >
              <GripVertical className="w-4 h-4 opacity-80" />
            </span>
            {/* Block name */}
            <span className="text-xs font-medium truncate opacity-90">
              {block.type}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Edit */}
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(block);
                // Fallback event for parent listeners if no prop is provided
                if (!onEdit) {
                  window.dispatchEvent(
                    new CustomEvent('qs:block:edit', { detail: { block } })
                  );
                }
              }}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>

            {/* Delete */}
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(block);
                if (!onDelete) {
                  window.dispatchEvent(
                    new CustomEvent('qs:block:delete', { detail: { block } })
                  );
                }
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>
      )}

      {debugOverlay}

      {/* Actual block content */}
      <div className="p-0"> 
        <Component
          {...(commonProps as any)}
          {...(block.type === 'grid' && handleNestedBlockUpdate
            ? { handleNestedBlockUpdate, parentBlock: block }
            : {})}
        />
      </div>
    </div>
  );
}

function fallbackRenderer(type: string): () => JSX.Element {
  return () => {
    console.error(`[🛑 fallbackRenderer] No renderer found for "${type}"`);
    return (
      <div className="text-red-500 bg-red-900/10 border border-red-500/30 p-2 rounded text-sm">
        ⚠️ No renderer for block type: <strong>{type}</strong>
      </div>
    );
  };
}
