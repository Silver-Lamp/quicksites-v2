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
import type { Template } from '@/types/template';

const isDev =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

const STATIC_RENDERERS: Partial<Record<BlockType, (props: any) => JSX.Element>> = {
  hero: HeroRender,
  text: TextRender,
};

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
  template: Template;
  blockPath?: string;
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
  template,
  blockPath,
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

  // ── Show chrome only when embedded inside the editor iframe
  const [isEmbedded, setIsEmbedded] = React.useState(false);
  React.useEffect(() => {
    try {
      const host = document.getElementById('site-renderer-page');
      const flagged = host?.getAttribute('data-editor-chrome') === '1';
      if (flagged) {
        setIsEmbedded(true);
        return;
      }
      setIsEmbedded(window.self !== window.top);
    } catch {
      setIsEmbedded(false);
    }
  }, []);

  // Stable id used by bridge
  const generatedIdRef = React.useRef<string | null>(null);
  if (!generatedIdRef.current) {
    const seed =
      (block as any)._id ||
      (block as any).id ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    generatedIdRef.current = String(seed);
  }
  const blockId = (block as any)._id || (block as any).id || generatedIdRef.current;

  const override = fixEnabled ? draftFixes[(block as any)._id || (block as any).id || ''] : {};
  const safeContent = { ...block.content, ...override };

  // hydration + ref ready
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const blockRef = React.useRef<HTMLDivElement | null>(null);
  const setWrapperRef = React.useCallback((el: HTMLDivElement | null) => {
    blockRef.current = el;
  }, []);

  const [refReady, setRefReady] = React.useState(false);
  React.useEffect(() => {
    if (!hydrated) return;
    const id = requestAnimationFrame(() => setRefReady(!!blockRef.current));
    return () => cancelAnimationFrame(id);
  }, [hydrated]);

  React.useEffect(() => {
    if (blockRef.current) {
      (blockRef.current as any).__squatterContent = safeContent;
    }
  }, [safeContent]);

  const identity = React.useMemo(() => {
    const t: any = template || {};
    const normArr = (v: any) =>
      Array.isArray(v) ? v.map((s) => String(s ?? '').trim()).filter(Boolean) : [];
    const phoneDigits = String(t.phone ?? '').replace(/\D/g, '');
    return {
      services: normArr(t.services),
      contact_email: (t.contact_email ?? '').toString().trim(),
      business_name: (t.business_name ?? '').toString().trim(),
      phone: phoneDigits,
    };
  }, [template]);

  const commonProps = {
    block,
    content: safeContent,
    template,
    identity,
    mode,
    disableInteraction,
    compact,
    previewOnly,
    showDebug,
    colorMode,
  };

  // wrapper — hover border only when embedded
  const wrapperProps = {
    id: `block-${blockId}`,
    'data-block-id': blockId,
    'data-block-type': block.type,
    'data-block-path': blockPath ?? undefined,
    className: [
      'qs-block',
      'relative group w-full rounded-md transition-colors',
      colorMode === 'light' ? 'bg-white text-black' : 'bg-neutral-950 text-white',
      isEmbedded
        ? 'border border-transparent group-hover:border-neutral-200 dark:group-hover:border-neutral-700'
        : '',
    ].join(' '),
    ref: setWrapperRef,
  };

  const debugOverlay = showDebug ? (
    <DebugOverlay position="bottom-right">
      {`[Block: ${block.type}]
ID: ${blockId || 'n/a'}`}
    </DebugOverlay>
  ) : null;

  const Component = getClientRenderer(block.type);
  const showControlsBar = isEmbedded && mode === 'editor' && !previewOnly && !disableInteraction;
  const runtimeProps = hydrated && refReady ? { scrollRef: blockRef } : {};

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    if (!hydrated) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [hydrated]);

  return (
    <div {...(wrapperProps as any)}>
      {/* Admin bar (drag + icons) — only inside editor */}
      {showControlsBar && (
        <div
          data-no-edit
          className={[
            'pointer-events-auto',
            'absolute inset-x-0 -top-px',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            colorMode === 'light' ? 'bg-white/70' : 'bg-neutral-900/60',
            'flex items-center justify-between px-2 py-1 rounded-t-md',
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
            {/* EDIT (admin bar) */}
            <button
              data-no-edit
              type="button"
              className={[
                'inline-flex items-center justify-center h-7 w-7 rounded-md transition',
                // Light mode: opaque pill + proper border/shadow
                'bg-white/95 text-neutral-900 border border-neutral-300 shadow-sm',
                'hover:bg-white',
                // Dark mode
                'dark:bg-white/10 dark:text-white dark:border-white/15 dark:shadow-none',
                // Focus ring
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60',
              ].join(' ')}
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(block);
                if (!onEdit) window.dispatchEvent(new CustomEvent('qs:block:edit', { detail: { block } }));
              }}
              aria-label="Edit block"
              title="Edit"
            >
              <Pencil className="w-4 h-4" strokeWidth={2.25} />
            </button>

            {/* DELETE (admin bar) */}
            <button
              data-no-edit
              type="button"
              className={[
                'inline-flex items-center justify-center h-7 w-7 rounded-md transition',
                // 'bg-gray-500/95 text-neutral-900 border border-neutral-300 shadow-sm',
                // 'hover:bg-white',
                // 'dark:bg-white/10 dark:text-white dark:border-white/15 dark:shadow-none',
                // 'border: 1px solid rgba(168,85,247,.35);',
                // 'background: rgba(0,0,0,.55);',
                // 'color: #fff; font-weight: 800; font-size: 18px; line-height: 1;',
                // 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60',
              ].join(' ')}
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(block);
                if (!onDelete) window.dispatchEvent(new CustomEvent('qs:block:delete', { detail: { block } }));
              }}
              aria-label="Delete block"
              title="Deletez"
            >
              <Trash2 className="w-4 h-4" strokeWidth={2.25} />
              <span className="text-xs font-medium truncate opacity-90">Deletez</span>
            </button>
          </div>
        </div>
      )}

      {/* Icon-only preview chrome (top-right) — only inside editor */}
      {isEmbedded && (
        <div className="pointer-events-none absolute right-2 top-2 z-40 hidden group-hover:flex items-center gap-1">
          {/* EDIT (icon chrome) */}
          <button
            type="button"
            data-action="edit-block"
            className={[
              'pointer-events-auto inline-flex items-center justify-center h-9 w-9 rounded-full transition',
              'backdrop-blur border shadow-sm',
              // 'bg-white/95 text-neutral-900 border-neutral-300 ring-1 ring-black/5 hover:bg-white',
              // 'dark:bg-white/10 dark:text-white dark:border-white/15 dark:ring-0 dark:shadow-none',
              // 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60',
              'border: 1px solid rgba(168,85,247,.35);',
              'background: rgba(0,0,0,.55);',
              'color: #fff; font-weight: 800; font-size: 18px; line-height: 1;',
            ].join(' ')}
            aria-label="Edit block"
            title="Edit"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(block);
              if (!onEdit) window.dispatchEvent(new CustomEvent('qs:block:edit', { detail: { block } }));
            }}
          >
            <Pencil className="w-4 h-4" strokeWidth={2.25} />
          </button>

          {/* DELETE (icon chrome) */}
          <button
            type="button"
            data-action="delete-block"
            className={[
              'pointer-events-auto inline-flex items-center justify-center h-9 w-9 rounded-full transition',
              'backdrop-blur border shadow-sm',
              // 'bg-white/95 text-neutral-900 border-neutral-300 ring-1 ring-black/5 hover:bg-white',
              // 'dark:bg-white/10 dark:text-white dark:border-white/15 dark:ring-0 dark:shadow-none',
              // 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60',
              'border: 1px solid rgba(168,85,247,.35);',
              'background: rgba(0,0,0,.55);',
              'color: #fff; font-weight: 800; font-size: 18px; line-height: 1;',
            ].join(' ')}
            aria-label="Delete block"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(block);
            }}
          >
            <Trash2 className="w-4 h-4" strokeWidth={2.25} />
          </button>
        </div>
      )}

      {debugOverlay}

      <div className="p-0" suppressHydrationWarning>
        <Suspense fallback={<span />}>
          {mounted ? (
            <Component
              {...(commonProps as any)}
              {...(refReady ? (runtimeProps as any) : {})}
              {...(block.type === 'grid' && handleNestedBlockUpdate
                ? { handleNestedBlockUpdate, parentBlock: block }
                : {})}
              {...(block.type === 'services'
                ? { services: identity?.services ?? template?.services ?? [] }
                : {})}
            />
          ) : null}
        </Suspense>
      </div>
    </div>
  );
}
