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

/** Normalize so renderers always get text immediately.
 *  Merge content + props (PROPS win), then apply any override. */
function getSafeContent(block: any, override: Record<string, any>) {
  const c = block && typeof block === 'object' && typeof (block as any).content === 'object'
    ? (block as any).content
    : {};
  const p = block && typeof block === 'object' && typeof (block as any).props === 'object'
    ? (block as any).props
    : {};
  return { ...c, ...p, ...override };
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

/** Build a small signature for generic text so we remount when it changes. */
function textSig(block: any, safeContent: any) {
  const p = (block?.props ?? {}) as any;
  const c = (safeContent ?? block?.content ?? {}) as any;
  const v = c.text ?? c.html ?? c.value ?? p.text ?? p.html ?? p.value ?? '';
  const s = typeof v === 'string' ? v : JSON.stringify(v ?? '');
  return s.slice(0, 256);
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
            ⚠️ Block failed to render.
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
  device?: 'mobile' | 'tablet' | 'desktop';
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
  device,
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

  // Ensure children that read either `content` OR `props` see the latest fields
  const blockForChild = React.useMemo(
    () => {
      const original: any = block || {};
      const mergedProps = { ...(original.props ?? {}), ...safeContent };
      return { ...original, content: safeContent, props: mergedProps };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [safeContent, (block as any).type, (block as any)._id, (block as any).id]
  );

  /** Build a small signature for generic text so we remount when it changes. */
  function textSigFromContent(payload: any) {
    try {
      return JSON.stringify(payload ?? {}).slice(0, 400);
    } catch {
      return String(payload ?? '');
    }
  }

  // 🔑 compute a render key that changes when hero/text changes (forces remount on autosave)
  const componentKey = React.useMemo(() => {
    const t = (block as any).type;
    if (t === 'hero') {
      return `${blockId}|hero|${heroTextSig(block, safeContent)}`;
    }
    if (t === 'text' || t === 'rich_text' || t === 'paragraph' || t === 'markdown') {
      return `${blockId}|text|${textSigFromContent(safeContent)}`;
    }
    return `${blockId}|${t}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId, (block as any).type, textSigFromContent(safeContent)]);

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
    const t: any = template ?? {};

    const get = (obj: any, path: string) =>
      path.split('.').reduce((acc, k) => (acc != null ? acc[k] : undefined), obj);
    const first = (...vals: any[]) =>
      vals.find((v) => v !== undefined && v !== null && String(v).trim() !== '');

    const email = first(
      t.contact_email,
      t.contactEmail,
      get(t, 'meta.contact_email'),
      get(t, 'meta.contact.email'),
      get(t, 'data.meta.contact_email'),
      get(t, 'data.meta.contact.email'),   // ← your sites row stores it here
      get(t, 'data.contact.email'),
      get(t, 'site.data.meta.contact.email'),
      get(t, 'identity.contact_email'),
      get(t, 'identity.email')
    ) || '';

    const phoneRaw = first(
      t.phone,
      t.contact_phone,
      t.contactPhone,
      get(t, 'meta.contact_phone'),
      get(t, 'data.meta.contact_phone'),
      get(t, 'data.meta.contact.phone'),
      get(t, 'data.contact.phone'),
      get(t, 'site.data.meta.contact.phone')
    ) || '';

    const business = first(
      t.business_name,
      t.businessName,
      get(t, 'meta.business_name'),
      get(t, 'data.meta.business'),
      get(t, 'data.meta.business_name'),
      get(t, 'site.data.meta.business'),
      get(t, 'identity.business_name')
    ) || '';

    const services =
      get(t, 'services') ??
      get(t, 'data.meta.services') ??
      get(t, 'data.services') ??
      get(t, 'site.data.meta.services') ??
      [];

    return {
      contact_email: String(email).trim(),
      phone: String(phoneRaw).replace(/\D/g, ''),
      business_name: String(business).trim(),
      services: Array.isArray(services)
        ? services.map((s: any) => String(s).trim()).filter(Boolean)
        : [],
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
    device,
  };

  // Explicit theme text color (surface is inherited)
  const themeText = computedMode === 'dark' ? 'text-white' : 'text-zinc-950';

  // Hover border per mode (no global `dark:` variant)
  const hoverBorder =
    isEmbedded
      ? (computedMode === 'dark'
          ? 'border border-transparent group-hover:border-neutral-700'
          : 'border border-transparent group-hover:border-neutral-200')
      : '';

  // wrapper — inherits surface from parent; no global dark class
  const wrapperProps = {
    id: `block-${blockId}`,
    'data-block-id': blockId,
    'data-block-type': (block as any).type,
    'data-block-path': blockPath ?? undefined,
    className: [
      'qs-block',
      'relative group w-full rounded-none transition-colors',
      'bg-transparent',
      themeText,
      hoverBorder,
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

  // Toolbar chrome colors per mode (no global dark variant)
  const toolbarBg = computedMode === 'light' ? 'bg-white/70' : 'bg-neutral-900/60';
  const editBtn =
    computedMode === 'light'
      ? 'bg-white/95 text-neutral-900 border border-neutral-300 shadow-sm hover:bg-white'
      : 'bg-white/10 text-white border border-white/15 hover:bg-white/10';

  // Typography variables to force `.prose` colors to match site mode
  const proseVars =
    computedMode === 'dark'
      ? ({
        // dark mode (unchanged)
        ['--tw-prose-body' as any]: 'rgb(229 231 235)',  // zinc-200
        ['--tw-prose-headings' as any]: 'rgb(255 255 255)',
        ['--tw-prose-links' as any]: 'rgb(147 197 253)',
        ['--tw-prose-bold' as any]: 'rgb(255 255 255)',
        ['--tw-prose-quotes' as any]: 'rgb(229 231 235)',
      } as React.CSSProperties)
    : ({
        // light mode (make darker here)
        ['--tw-prose-body' as any]: 'rgb(9 9 11)',        // zinc-950  ← darker
        ['--tw-prose-headings' as any]: 'rgb(17 24 39)',  // slate-900
        ['--tw-prose-links' as any]: 'rgb(29 78 216)',    // blue-700 (a bit deeper)
        ['--tw-prose-bold' as any]: 'rgb(17 24 39)',
        ['--tw-prose-quotes' as any]: 'rgb(9 9 11)',
      } as React.CSSProperties);
      function resolveContainerClass(block: any) {
        const type = String(block?.type || '');
      
        // Header / footer are usually full width
        if (type === 'header' || type === 'footer') return 'w-full';
      
        const props = block?.props || {};
        const content = block?.content || {};
      
        // Common flags that should force full-bleed
        const full =
          props.fullWidth ?? props.full_bleed ?? props.full ??
          content.fullWidth ?? content.full_bleed ?? content.full ?? false;
      
        if (full === true) return 'w-full';
      
        // Optional presets: 'narrow' | 'default' | 'wide' | 'full'
        const preset =
          props.container ?? props.width ?? props.layout ??
          content.container ?? content.width ?? content.layout ?? 'default';
      
        if (preset === 'full' || preset === 'full-bleed') return 'w-full';
        if (preset === 'narrow') return 'mx-auto w-full max-w-3xl px-4 sm:px-6';
        if (preset === 'wide') return 'mx-auto w-full max-w-[1280px] px-4 sm:px-8';
      
        // Default
        return 'mx-auto w-full max-w-[1100px] px-4 sm:px-6 pt-8';
      }
      
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
            'flex items-center justify-between px-2 py-1 rounded-t-none',
            toolbarBg,
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
                'inline-flex items-center justify-center h-7 w-7 rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60',
                editBtn,
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
              // Wrap renderer in a vars-scope so `.prose` colors follow site mode
              <div className={resolveContainerClass(blockForChild)} style={proseVars}>
                <Component
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
              </div>
            ) : null}
          </Suspense>
        </BlockBoundary>
      </div>
    </div>
  );
}
