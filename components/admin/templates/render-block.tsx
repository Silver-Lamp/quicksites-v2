// components/admin/templates/render-block.tsx
'use client';

import type { Block, BlockType } from '@/types/blocks';
import type { JSX } from 'react';
import React, { Suspense } from 'react';

import { useBlockFix } from '@/components/ui/block-fix-context';
import DebugOverlay from '@/components/ui/debug-overlay';
import HeroRender from '@/components/admin/templates/render-blocks/hero';
import TextRender from '@/components/admin/templates/render-blocks/text';

import { DYNAMIC_RENDERERS } from '@/lib/blockRegistry';
import { blockContentSchemaMap } from '@/admin/lib/zod/blockSchema';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';

const isDev =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

// Client-safe static renderers
const STATIC_RENDERERS: Partial<Record<BlockType, (props: any) => JSX.Element>> = {
  hero: HeroRender,
  text: TextRender,
};

// Cache React.lazy wrappers
const lazyCache = new Map<string, React.ComponentType<any>>();

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

function fallbackRenderer(type: string): React.ComponentType<any> {
  return () => (
    <div className="text-red-500 bg-red-900/10 border border-red-500/30 p-2 rounded text-sm">
      ⚠️ No renderer for block type: <strong>{type}</strong>
    </div>
  );
}

function getClientRenderer(type: BlockType): React.ComponentType<any> {
  const Static = STATIC_RENDERERS[type as keyof typeof STATIC_RENDERERS];
  if (Static) return Static;

  const loader = DYNAMIC_RENDERERS[type as keyof typeof DYNAMIC_RENDERERS];
  if (loader) {
    const key = String(type);
    const cached = lazyCache.get(key);
    if (cached) return cached;
    const Lazy = React.lazy(loader as any);
    lazyCache.set(key, Lazy);
    return Lazy;
  }

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

  // 1) Hydration gate (client-only)
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  // 2) Ref that blocks can use for motion/useScroll
  const blockRef = React.useRef<HTMLDivElement | null>(null);
  const setWrapperRef = React.useCallback((el: HTMLDivElement | null) => {
    blockRef.current = el;
  }, []);

  // 3) Wait one frame AFTER mount so ref is actually attached
  const [refReady, setRefReady] = React.useState(false);
  React.useEffect(() => {
    if (!hydrated) return;
    const id = requestAnimationFrame(() => setRefReady(!!blockRef.current));
    return () => cancelAnimationFrame(id);
  }, [hydrated]);

  // (optional) keep debug content on the element
  React.useEffect(() => {
    if (blockRef.current) {
      (blockRef.current as any).__squatterContent = safeContent;
    }
  }, [safeContent]);

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

  const wrapperProps = {
    id: `block-${block._id || 'unknown'}`,
    'data-block-id': block._id || 'unknown',
    'data-block-type': block.type,
    className: [
      'relative group w-full rounded-md transition-colors',
      colorMode === 'light' ? 'bg-white text-black' : 'bg-neutral-950 text-white',
      'border border-transparent group-hover:border-neutral-200',
      'dark:group-hover:border-neutral-700',
    ].join(' '),
    ref: setWrapperRef,
  };

  const debugOverlay = showDebug ? (
    <DebugOverlay position="bottom-right">
      {`[Block: ${block.type}]
ID: ${block._id || 'n/a'}`}
    </DebugOverlay>
  ) : null;

  const Component = getClientRenderer(block.type);
  const showControlsBar = mode === 'editor' && !previewOnly && !disableInteraction;

  // Only pass scrollRef once the ref is **attached** (avoids Motion error)
  const runtimeProps = hydrated && refReady ? { scrollRef: blockRef } : {};

  return (
    <div {...(wrapperProps as any)}>
      {/* Controls bar (hidden until hover) */}
      {showControlsBar && (
        <div
          data-no-edit
          className={[
            'pointer-events-auto',
            'absolute inset-x-0 -top-px',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            colorMode === 'light' ? 'bg-white/70' : 'bg-neutral-900/60',
            'flex items-center justify-between px-2 py-1 rounded-t-md',
            'border border-transparent group-hover:border-neutral-200 dark:group-hover:border-neutral-700',
          ].join(' ')}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              data-no-edit
              className="inline-flex items-center justify-center w-6 h-6 rounded cursor-grab active:cursor-grabbing"
              title="Drag to reorder"
              aria-label="Drag handle"
              data-dnd-handle
            >
              <GripVertical className="w-4 h-4 opacity-80" />
            </span>
            <span className="text-xs font-medium truncate opacity-90">{block.type}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              data-no-edit
              type="button"
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(block);
                if (!onEdit) {
                  window.dispatchEvent(new CustomEvent('qs:block:edit', { detail: { block } }));
                }
              }}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>

            <button
              data-no-edit
              type="button"
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(block);
                if (!onDelete) {
                  window.dispatchEvent(new CustomEvent('qs:block:delete', { detail: { block } }));
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

      {/* Block content */}
      <div className="p-0">
        <Suspense fallback={<div className="p-2 text-sm text-muted-foreground">Loading block…</div>}>
          {hydrated && refReady ? (
            <Component
              {...(commonProps as any)}
              {...(runtimeProps as any)} // scrollRef only when attached
              {...(block.type === 'grid' && handleNestedBlockUpdate
                ? { handleNestedBlockUpdate, parentBlock: block }
                : {})}
            />
          ) : null}
        </Suspense>
      </div>
    </div>
  );
}
