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

/** Normalize a block's content so renderers always receive an object. */
function getSafeContent(block: any, override: Record<string, any>) {
  const raw =
    (block && typeof block === 'object' && (block as any).content) ??
    (block && typeof block === 'object' && (block as any).props) ??
    {};
  const base = raw && typeof raw === 'object' ? raw : {};
  return { ...base, ...override };
}

/** Build a small signature for hero text so we can force remounts when it changes. */
function heroTextSig(block: any, safeContent: any) {
  const p = (block?.props ?? {}) as any;
  const c = (safeContent ?? block?.content ?? {}) as any;
  const heading = p.heading ?? c.headline ?? '';
  const sub = p.subheading ?? c.subheadline ?? '';
  const cta = p.ctaLabel ?? c.cta_text ?? '';
  return `${heading}|${sub}|${cta}`;
}

/** Local error boundary to prevent a bad block from blanking the page. */
class BlockBoundary extends React.Component<
  React.PropsWithChildren<{ fallback?: React.ReactNode }>,
  { err?: unknown }
> {
  constructor(props: React.PropsWithChildren<{ fallback?: React.ReactNode }>) {
    super(props);
    this.state = { err: undefined };
  }
  static getDerivedStateFromError(err: unknown) {
    return { err };
  }
  componentDidCatch() { /* noop */ }
  render() {
    if (this.state.err) {
      return (
        this.props.fallback ?? (
          <div className="text-red-500 text-sm p-2 bg-red-900/10 rounded">
            ⚠️ Block crashed while rendering.
          </div>
        )
      );
    }
    return this.props.children as React.ReactNode;
  }
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
  /** Optional override; if omitted we infer from template JSON */
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
  colorMode, // NOTE: no default here; we compute from template if undefined
  onEdit,
  onDelete,
}: RenderProps) {
  const { enabled: fixEnabled, draftFixes } = useBlockFix();

  if (!block || !(block as any).type) {
    return (
      <div className="text-red-500 text-sm p-2 bg-red-900/10 rounded">
        ⚠️ Invalid block: missing or undefined type
      </div>
    );
  }

  // ── Infer color mode from template when not explicitly provided
  const computedMode: 'light' | 'dark' = React.useMemo(() => {
    const t: any = template || {};
    const tmpl =
      t.color_mode ??
      t.colorMode ??
      t?.data?.theme?.mode ??
      t?.data?.meta?.mode ??
      t?.meta?.mode ??
      null;
    const chosen = (colorMode ?? tmpl ?? 'light') as string;
    return String(chosen).toLowerCase() === 'dark' ? 'dark' : 'light';
  }, [template, colorMode]);

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
  const safeContent = getSafeContent(block, override);

  // Ensure child renderers that read `block.content` get a value
  const blockForChild = React.useMemo(
    () => ({ ...(block as any), content: safeContent }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [safeContent, (block as any).type, (block as any)._id, (block as any).id]
  );

  // 🔑 compute a render key that changes when hero text changes (forces remount on autosave)
  const componentKey = React.useMemo(() => {
    const t = (block as any).type;
    if (t === 'hero') {
      return `${blockId}|hero|${heroTextSig(block, safeContent)}`;
    }
    return `${blockId}|${t}`;
  }, [
    blockId,
    (block as any).type,
    // deps for hero text; safeContent covers content.* and props fallback via heroTextSig
    safeContent?.headline,
    safeContent?.subheadline,
    safeContent?.cta_text,
    (block as any)?.props?.heading,
    (block as any)?.props?.subheading,
    (block as any)?.props?.ctaLabel,
  ]);

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
    block: blockForChild,
    content: safeContent,
    template,
    identity,
    mode,
    disableInteraction,
    compact,
    previewOnly,
    showDebug,
    colorMode: computedMode, // ⬅️ pass down the computed mode
  };

  // wrapper — hover border only when embedded
  const wrapperProps = {
    id: `block-${blockId}`,
    'data-block-id': blockId,
    'data-block-type': (block as any).type,
    'data-block-path': blockPath ?? undefined,
    className: [
      // Put a local 'dark' class so any `dark:` utilities inside descendants activate
      computedMode === 'dark' ? 'dark' : '',
      'qs-block',
      'relative group w-full rounded-none transition-colors',
      computedMode === 'light' ? 'bg-white text-black' : 'bg-neutral-950 text-white',
      isEmbedded
        ? 'border border-transparent group-hover:border-neutral-200 dark:group-hover:border-neutral-700'
        : '',
    ].join(' '),
    ref: setWrapperRef,
  };

  const debugOverlay = showDebug ? (
    <DebugOverlay position="bottom-right">
      {`[Block: ${(block as any).type}]
ID: ${blockId || 'n/a'}`}
    </DebugOverlay>
  ) : null;

  const Component = getClientRenderer((block as any).type);
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
            computedMode === 'light' ? 'bg-white/70' : 'bg-neutral-900/60',
            'flex items-center justify-between px-2 py-1 rounded-t-none',
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
            <span className="text-xs font-medium truncate opacity-90">{(block as any).type}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              data-no-edit
              type="button"
              className={[
                'inline-flex items-center justify-center h-7 w-7 rounded-md transition',
                'bg-white/95 text-neutral-900 border border-neutral-300 shadow-sm',
                'hover:bg-white',
                'dark:bg-white/10 dark:text-white dark:border-white/15 dark:shadow-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60',
              ].join(' ')}
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(blockForChild as any);
                if (!onEdit) window.dispatchEvent(new CustomEvent('qs:block:edit', { detail: { block: blockForChild } }));
              }}
              aria-label="Edit block"
              title="Edit"
            >
              <Pencil className="w-4 h-4" strokeWidth={2.25} />
            </button>

            <button
              data-no-edit
              type="button"
              className="inline-flex items-center justify-center h-7 w-7 rounded-md transition"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(blockForChild as any);
                if (!onDelete) window.dispatchEvent(new CustomEvent('qs:block:delete', { detail: { block: blockForChild } }));
              }}
              aria-label="Delete block"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" strokeWidth={2.25} />
              <span className="sr-only">Delete</span>
            </button>
          </div>
        </div>
      )}

      {debugOverlay}

      <div className="p-0" suppressHydrationWarning>
        <BlockBoundary
          fallback={
            <div className="text-red-500 text-sm p-2 bg-red-900/10 rounded">
              ⚠️ Block failed to render.
            </div>
          }
        >
          <Suspense fallback={<span />}>
            {mounted ? (
              <Component
                // {/* ⬅️ force remount when hero text changes */}
                key={componentKey}       
                previewOnly={mode === 'editor' || previewOnly}   
                {...(commonProps as any)}
                {...(refReady ? ({ scrollRef: blockRef } as any) : {})}
                {...((block as any).type === 'grid' && handleNestedBlockUpdate
                  ? { handleNestedBlockUpdate, parentBlock: blockForChild }
                  : {})}
                {...((block as any).type === 'services'
                  ? { services: identity?.services ?? (template as any)?.services ?? [] }
                  : {})}
              />
            ) : null}
          </Suspense>
        </BlockBoundary>
      </div>
    </div>
  );
}
