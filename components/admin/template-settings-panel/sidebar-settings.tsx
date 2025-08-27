// template-settings-panel/sidebar-settings.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import IdentityPanel from '../templates/panels/identity-panel';
import ServicesPanel from '../templates/panels/services-panel';
import SlugPanel from '../templates/panels/slug-panel';
import DomainPanel from '../templates/panels/domain-panel';
import SeoPanel from '../templates/panels/seo-panel';
import ThemePanel from '../templates/panels/theme-panel';
import TemplateJsonEditor from '../templates/template-json-editor';
import PaymentSettingsPanel from '../payments/payment-settings-panel';

import HoursPanel from '../templates/panels/hours-panel';

import type { Template, Page } from '@/types/template';
import { usePersistTemplate, useTemplateRef } from '@/hooks/usePersistTemplate';

/* ===================== Resizable settings ===================== */
const STORAGE_KEY = 'qs:sidebar:width';
const DEFAULT_WIDTH = 320;   // px
const MIN_WIDTH = 280;       // px
const MAX_WIDTH = 640;       // px
const EXPAND_WIDTH = 440;    // px (double-click target)

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/* ---- helpers ---- */
function getPages(t: Template): Page[] {
  const anyT: any = t ?? {};
  if (Array.isArray(anyT?.data?.pages)) return anyT.data.pages;
  if (Array.isArray(anyT?.pages)) return anyT.pages;
  return [];
}

/** Merge a patch into the current template and keep pages mirrored at both levels. */
function mergeTemplate(current: Template, patch: Partial<Template>): Template {
  const next: any = {
    ...current,
    ...patch,
    data: { ...(current as any).data, ...(patch as any).data },
  };

  // If patch contains pages either at root or under data, mirror them to both places.
  const patchedPages =
    (patch as any)?.pages ??
    (patch as any)?.data?.pages ??
    undefined;

  if (patchedPages) {
    next.pages = patchedPages;
    next.data = { ...(next.data ?? {}), pages: patchedPages };
  } else {
    // Ensure pages remain present at both levels for UI stability
    const pages = getPages(next);
    next.pages = pages;
    next.data = { ...(next.data ?? {}), pages };
  }

  return next as Template;
}

type Props = {
  template: Template;
  /** Accept partials to avoid clobbering state upstream (we'll pass full next template) */
  onChange: (patch: Partial<Template>) => void;
};

export default function SidebarSettings({ template, onChange }: Props) {
  // ====== Resizable state ======
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWRef = useRef(0);
  const [forceOpenHours, setForceOpenHours] = useState(false);
  const hoursPanelRef = useRef<HTMLDivElement>(null);
  const [spotlightHours, setSpotlightHours] = useState(false);


  // Load persisted width
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const w = raw ? parseInt(raw, 10) : DEFAULT_WIDTH;
      setWidth(clamp(isFinite(w) ? w : DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH));
    } catch {
      setWidth(DEFAULT_WIDTH);
    }
  }, []);
  useEffect(() => {
    function onOpenPanel(ev: Event) {
      const e = ev as CustomEvent<{ panel: string; openEditor?: boolean; scroll?: boolean; spotlightMs?: number }>;
      if (!e.detail || e.detail.panel !== 'hours') return;
  
      setForceOpenHours(!!e.detail.openEditor);
      if (e.detail.scroll !== false) hoursPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setSpotlightHours(true);
      const id = setTimeout(() => setSpotlightHours(false), e.detail.spotlightMs ?? 900);
      return () => clearTimeout(id);
    }
    window.addEventListener('qs:open-settings-panel' as any, onOpenPanel as any);
    return () => window.removeEventListener('qs:open-settings-panel' as any, onOpenPanel as any);
  }, []);
  
  const persistWidth = useCallback((w: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(w));
    } catch {}
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!draggingRef.current) return;
    const delta = e.clientX - startXRef.current; // handle on the right edge
    const next = clamp(startWRef.current + delta, MIN_WIDTH, MAX_WIDTH);
    setWidth(next);
  }, []);

  const endDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.cursor = '';
    (document.body.style as any).userSelect = '';
    persistWidth(width);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
  }, [onPointerMove, persistWidth, width]);

  const beginDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWRef.current = width;
    document.body.style.cursor = 'col-resize';
    (document.body.style as any).userSelect = 'none';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
  }, [endDrag, onPointerMove, width]);

  const onHandleDoubleClick = useCallback(() => {
    // Toggle between default and expanded width
    const next = Math.abs(width - EXPAND_WIDTH) < 8 ? DEFAULT_WIDTH : EXPAND_WIDTH;
    setWidth(clamp(next, MIN_WIDTH, MAX_WIDTH));
    persistWidth(next);
  }, [persistWidth, width]);

  const onHandleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 20 : 10;
    if (e.key === 'ArrowLeft') {
      const next = clamp(width - step, MIN_WIDTH, MAX_WIDTH);
      setWidth(next);
      persistWidth(next);
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      const next = clamp(width + step, MIN_WIDTH, MAX_WIDTH);
      setWidth(next);
      persistWidth(next);
      e.preventDefault();
    } else if (e.key.toLowerCase() === 'r') {
      setWidth(DEFAULT_WIDTH);
      persistWidth(DEFAULT_WIDTH);
      e.preventDefault();
    }
  }, [persistWidth, width]);

  // ====== Persist template helpers ======
  const tplRef = useTemplateRef(template);

  // Persist (debounced) to /api/templates/:id/edit
  const { persistSoon } = usePersistTemplate(
    (template as any).id,
    () => tplRef.current,
    {
      debounceMs: 350,
      onError: (e) => console.error('[sidebar persist] failed:', e),
    }
  );

  /** Apply a patch: merge → set state (parent) → persist soon */
  const applyPatch = useCallback(
    (patch: Partial<Template>) => {
      const next = mergeTemplate(tplRef.current, patch);
      onChange(next as Partial<Template>); // parent does setTemplate+onChange downstream
      persistSoon(next);
    },
    [onChange, persistSoon, tplRef]
  );

  /** Helper so we always update canon + legacy in one go */
  const applyPages = useCallback(
    (pages: Page[]) => {
      applyPatch({ pages, data: { ...(template.data ?? {}), pages } as any });
    },
    [applyPatch, template.data]
  );

  // ====== Content ======
  const content = useMemo(() => (
    <div
      className="space-y-4 px-4 pt-2 h-full overflow-y-auto"
      id="sidebar-settings-inner"
    >
      {/* Theme updates color_mode; apply + persistSoon */}
      <ThemePanel
        template={template}
        onChange={(patch) => applyPatch(patch)}
      />

      {/* Identity, Services, Slug, Domain all emit partials; we merge + persist */}
      <IdentityPanel
        template={template}
        onChange={(patch) => applyPatch(patch)}
      />

      <ServicesPanel
        template={template}
        onChange={(patch) => applyPatch(patch)}
      />

      <SlugPanel
        template={template}
        onChange={(patch) => applyPatch(patch)}
      />

      <DomainPanel
        template={template}
        isSite={template.is_site ?? false}
        onChange={(patch) => applyPatch(patch)}
      />

      <SeoPanel
        template={template}
        onChange={(patch) => applyPatch(patch)}
      />

      {/* New top-level Hours panel (reuses block editor internally) */}
      <HoursPanel
        template={template}
        onChange={(patch) => applyPatch(patch)}
        panelRef={hoursPanelRef as any}
        forceOpenEditor={forceOpenHours}
        spotlight={spotlightHours}
      />

      <PaymentSettingsPanel
        siteId={template.id}
        merchantId={'00001'}
        initialPlatformFeeBps={75}
      />

      {/* Optional: JSON viewer (read-only here) */}
      <TemplateJsonEditor
        rawJson={JSON.stringify(template, null, 2)}
        setRawJson={() => {}}
        sidebarValues={template}
        setSidebarValues={() => {}}
        colorMode={(template.color_mode as 'light' | 'dark') ?? 'light'}
      />
    </div>
  ), [applyPatch, template]);

  return (
    <aside
      className="relative flex-shrink-0 border-r"
      style={{ width: `${width}px`, minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH }}
      aria-label="Template settings sidebar"
    >
      {/* Content */}
      {content}

      {/* Resize handle on the right edge */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        tabIndex={0}
        onPointerDown={beginDrag}
        onDoubleClick={onHandleDoubleClick}
        onKeyDown={onHandleKeyDown}
        className={[
          'absolute top-0 right-0 h-full',
          'w-2 cursor-col-resize touch-none select-none',
          'bg-transparent hover:bg-foreground/5 active:bg-foreground/10',
          'transition-colors',
        ].join(' ')}
        title="Drag to resize • Double-click to toggle • Shift+Arrow for bigger steps • R to reset"
      />
    </aside>
  );
}
