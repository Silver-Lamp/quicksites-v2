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
import { Button } from '@/components/ui/button';
import { Save, Loader2 } from 'lucide-react';

import type { Template, Page } from '@/types/template';
import { Collapsible } from '@/components/ui/collapsible';

// simple live ref
function useLiveRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; }, [value]);
  return ref;
}

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

  const patchedPages =
    (patch as any)?.pages ??
    (patch as any)?.data?.pages ??
    undefined;

  if (patchedPages) {
    next.pages = patchedPages;
    next.data = { ...(next.data ?? {}), pages: patchedPages };
  } else {
    const pages = getPages(next);
    next.pages = pages;
    next.data = { ...(next.data ?? {}), pages };
  }

  return next as Template;
}

/* ======= Commit API (autosave of data only) ======= */
function useCommitApi(templateId?: string) {
  const [pending, setPending] = useState(false);
  const revRef = useRef<number | null>(null);

  const loadRev = useCallback(async () => {
    if (!templateId) return null;
    const res = await fetch(`/api/templates/state?id=${templateId}`, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'Failed to load state');
    const rev = json?.infra?.template?.rev ?? 0;
    revRef.current = rev;
    return rev;
  }, [templateId]);

  useEffect(() => { void loadRev(); }, [loadRev]);

  const commit = useCallback(
    async (dataPatch: any, kind: 'save' | 'autosave' = 'autosave') => {
      if (!templateId) return;
      const baseRev = revRef.current ?? (await loadRev()) ?? 0;
      setPending(true);
      const res = await fetch('/api/templates/commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: templateId, baseRev, patch: { data: dataPatch }, kind }),
      });
      const json = await res.json();
      setPending(false);
      if (!res.ok) throw new Error(json?.error || 'Commit failed');
      if (typeof json?.rev === 'number') revRef.current = json.rev;
      try { window.dispatchEvent(new CustomEvent('qs:truth:refresh')); } catch {}
      return json;
    },
    [templateId, loadRev]
  );

  // simple debounce
  const tRef = useRef<any>(null);
  const commitSoon = useCallback((dataPatch: any) => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => { void commit(dataPatch, 'autosave').catch(() => {}); }, 400);
  }, [commit]);

  return { pending, commit, commitSoon };
}

type Props = {
  template: Template;
  onChange: (patch: Partial<Template>) => void;
};

export default function SidebarSettings({ template, onChange }: Props) {
  // ====== Resizable state ======
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const draggingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const startWRef = useRef<number>(0);
  const [forceOpenHours, setForceOpenHours] = useState(false);
  const hoursPanelRef = useRef<HTMLDivElement | null>(null);
  const [spotlightHours, setSpotlightHours] = useState(false);

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
    try { localStorage.setItem(STORAGE_KEY, String(w)); } catch {}
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!draggingRef.current) return;
    const delta = e.clientX - startXRef.current;
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
    const next = Math.abs(width - EXPAND_WIDTH) < 8 ? DEFAULT_WIDTH : EXPAND_WIDTH;
    setWidth(clamp(next, MIN_WIDTH, MAX_WIDTH));
    persistWidth(next);
  }, [persistWidth, width]);

  const onHandleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 20 : 10;
    if (e.key === 'ArrowLeft') {
      const next = clamp(width - step, MIN_WIDTH, MAX_WIDTH);
      setWidth(next); persistWidth(next); e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      const next = clamp(width + step, MIN_WIDTH, MAX_WIDTH);
      setWidth(next); persistWidth(next); e.preventDefault();
    } else if (e.key.toLowerCase() === 'r') {
      setWidth(DEFAULT_WIDTH); persistWidth(DEFAULT_WIDTH); e.preventDefault();
    }
  }, [persistWidth, width]);

  // ====== Commit autosave helpers ======
  const tplRef = useLiveRef(template);
  const { pending, commit, commitSoon } = useCommitApi((template as any)?.id);

  const applyPatch = useCallback(
    (patch: Partial<Template>) => {
      const next = mergeTemplate(tplRef.current, patch);
      onChange(next as Partial<Template>);
      try { commitSoon((next as any).data); } catch {}
    },
    [onChange, commitSoon, tplRef]
  );

  const applyPages = useCallback(
    (pages: Page[]) => {
      applyPatch({ pages, data: { ...(template.data ?? {}), pages } as any });
    },
    [applyPatch, template.data]
  );

  // explicit save (non-debounced)
  const saveNow = useCallback(async () => {
    try {
      await commit((tplRef.current as any).data, 'save');
    } catch (e) {
      console.error('[sidebar saveNow] failed', e);
    }
  }, [commit, tplRef]);

  // ====== Content ======
  const content = useMemo(() => (
    <div className="space-y-4 px-4 pt-2 h-full overflow-y-auto" id="sidebar-settings-inner">
      {/* Sticky save bar */}
      <div className="sticky top-0 z-10 -mx-4 mb-2 border-b bg-background/95 px-4 py-2 backdrop-blur flex items-center gap-2">
        <Button size="sm" className="gap-2" onClick={saveNow} disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {pending ? 'Saving…' : 'Save now'}
        </Button>
        <span className="text-xs text-muted-foreground">Autosaves on change</span>
      </div>

      {/* Theme, Identity, Services, Slug, Domain, SEO */}
      <ThemePanel template={template} onChange={(patch) => applyPatch(patch)} />

      <IdentityPanel template={template} onChange={(patch) => applyPatch(patch)} />

      <ServicesPanel template={template} onChange={(patch) => applyPatch(patch)} />

      <SlugPanel template={template} onChange={(patch) => applyPatch(patch)} />

      <DomainPanel template={template} isSite={template.is_site ?? false} />

      <SeoPanel template={template} onChange={(patch) => applyPatch(patch)} />

      {/* Hours */}
      <Collapsible title="Hours" id="hours" defaultOpen={false} ref={hoursPanelRef}>  
        <HoursPanel
          template={template}
          onChange={(patch) => applyPatch(patch)}
          panelRef={hoursPanelRef as any}
          forceOpenEditor={forceOpenHours}
          spotlight={spotlightHours}
        />
      </Collapsible>

      {/* Payments (separate flow) */}
      <PaymentSettingsPanel
        siteId={template.id}
        merchantId={'00001'}
        initialPlatformFeeBps={75}
      />

      {/* Optional read-only JSON viewer */}
      {/* <TemplateJsonEditor
        rawJson={JSON.stringify(template, null, 2)}
        setRawJson={() => {}}
        sidebarValues={template}
        setSidebarValues={() => {}}
        colorMode={(template.color_mode as 'light' | 'dark') ?? 'light'}
      /> */}
    </div>
  ), [applyPatch, forceOpenHours, pending, saveNow, spotlightHours, template]);

  return (
    <aside
      className="relative flex-shrink-0 border-r"
      style={{ width: `${width}px`, minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH }}
      aria-label="Template settings sidebar"
    >
      {content}

      {/* Resize handle */}
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
