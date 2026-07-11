'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui';
import toast from 'react-hot-toast';
import {
  RotateCcw, RotateCw, AlertTriangle, X, Maximize2, Minimize2,
  Smartphone, Tablet, Monitor, SlidersHorizontal, Check, Sun, Moon,
  Settings as SettingsIcon, Trash2, Database, Minus, Wrench, Palette, Shuffle,
} from 'lucide-react';
import { ThemeShufflePanel } from '@/components/admin/templates/theme-shuffle-panel';
import { pickCuratedTheme } from '@/lib/theme/pickTheme';
import { toStampedTheme, type CuratedTheme } from '@/lib/theme/curatedThemes';

import type { Template } from '@/types/template';
import PageManagerToolbar from '@/components/admin/templates/page-manager-toolbar';
import AsyncGifOverlay from '@/components/ui/async-gif-overlay';

import {
  getTemplatePagesLoose,
  withPages,
  normalizePageBlocksShape,
  pretty,
  baseSlug,
  toCacheRow,
} from '@/components/admin/templates/template-action-toolbar/saveUtils';

import { useCommitQueue } from '@/components/admin/templates/template-action-toolbar/useCommitQueue';
import {
  loadVersionRow,
  createSnapshot,
  publishSnapshot,
} from '@/components/admin/templates/template-action-toolbar/versionsApi';

import {
  dispatchTemplateCacheInvalidate,
  dispatchTemplateCacheUpdate,
  readTemplateCache,
} from '@/lib/templateCache';
import { templateSig } from '@/lib/editor/saveGuard';
import { resolveIndustryKey } from '@/lib/industries';

/* ----------------------------- minimal history hook ----------------------------- */
function useUndoRedo(template: Template) {
  type TData = any;
  const MAX_HISTORY = 120;
  const undoStackRef = useRef<TData[]>([]);
  const redoStackRef = useRef<TData[]>([]);
  const prevDataRef  = useRef<TData | null>(null);
  const lastKeyRef   = useRef<string>('');
  const [stats, setStats] = useState({ past: 0, future: 0 });
  const isReplayingRef = useRef(false);
  const initRef = useRef(false);
  const deepClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

  const publish = () =>
    setStats({ past: undoStackRef.current.length, future: redoStackRef.current.length });

  
  useEffect(() => {
    const data = (template as any)?.data;
    if (!data) return;
    const key = JSON.stringify(data);
    if (!initRef.current) {
      initRef.current  = true;
      lastKeyRef.current = key;
      prevDataRef.current = deepClone(data);
      publish();
      return;
    }
    if (isReplayingRef.current) {
      lastKeyRef.current = key;
      prevDataRef.current = deepClone(data);
      publish();
      return;
    }
    if (key !== lastKeyRef.current) {
      if (prevDataRef.current) {
        undoStackRef.current.push(deepClone(prevDataRef.current));
        if (undoStackRef.current.length > MAX_HISTORY) undoStackRef.current.shift();
      }
      redoStackRef.current = [];
      lastKeyRef.current   = key;
      prevDataRef.current  = deepClone(data);
      publish();
    }
  }, [template?.data]);

  useEffect(() => {
    const onCapture = () => {
      const data = (template as any)?.data;
      if (!data) return;
      const snap = deepClone(data);
      undoStackRef.current.push(snap);
      if (undoStackRef.current.length > MAX_HISTORY) undoStackRef.current.shift();
      redoStackRef.current = [];
      lastKeyRef.current = JSON.stringify(data);
      prevDataRef.current = snap;
      publish();
    };
    const onReq = () => publish();

    window.addEventListener('qs:history:capture', onCapture as any);
    window.addEventListener('qs:history:request-stats', onReq as any);
    return () => {
      window.removeEventListener('qs:history:capture', onCapture as any);
      window.removeEventListener('qs:history:request-stats', onReq as any);
    };
  }, [template]);

  const applyTransient = (nextData: any) => {
    try {
      isReplayingRef.current = true;
      window.dispatchEvent(
        new CustomEvent('qs:template:apply-patch', {
          detail: { data: nextData, __transient: true } as any,
        })
      );
    } finally {
      setTimeout(() => { isReplayingRef.current = false; }, 0);
    }
  };

  const undo = () => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    const current = prevDataRef.current ?? (template as any)?.data;
    redoStackRef.current.push(JSON.parse(JSON.stringify(current)));
    applyTransient(prev);
    publish();
  };

  const redo = () => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    const current = prevDataRef.current ?? (template as any)?.data;
    undoStackRef.current.push(JSON.parse(JSON.stringify(current)));
    applyTransient(next);
    publish();
  };

  return { stats, undo, redo };
}

/* -------------------------------- component -------------------------------- */
type SaveWarning = { field: string; message: string };

type Props = {
  template: Template;
  /** NEW: shown inline near the Save button (optional) */
  autosaveStatus?: string;
  onSaveDraft?: (maybeSanitized?: Template) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onOpenPageSettings?: () => void;
  onApplyTemplate: (next: Template) => void;
  onSetRawJson?: (json: string) => void;
};

export default function TemplateActionToolbar({
  template,
  autosaveStatus,
  onSaveDraft,
  onUndo,
  onRedo,
  onOpenPageSettings,
  onApplyTemplate,
  onSetRawJson,
}: Props) {
  const tplRef = useRef(template);
  useEffect(() => { tplRef.current = template; }, [template]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* status + dirty tracking */
  const [status, setStatus] = useState<'Draft'|'Published'>('Draft');
  const [dirty,  setDirty]  = useState(false);
  const savedSigRef = useRef<string>('');
  useEffect(() => { savedSigRef.current = templateSig(template); }, []); // initial
  useEffect(() => {
    setDirty(templateSig(template) !== savedSigRef.current);
    setStatus((template as any)?.publishedSnapshotId ? 'Published' : 'Draft');
  }, [template]);

  /* commit queue */
  const { queueFullSave, pending, error: saveError } = useCommitQueue(tplRef);

  /* history */
  const { stats, undo, redo } = useUndoRedo(template);

  /* misc UI state */
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayMsg,  setOverlayMsg]  = useState('Working…');
  const [saveWarnings, setSaveWarnings] = useState<SaveWarning[]>([]);

  const [toolbarCollapsed, setToolbarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return (localStorage.getItem('qs:toolbar:collapsed') ?? '0') === '1'; } catch { return false; }
  });
// Toggle toolbar collapse (t) and page manager (p) when not typing
useEffect(() => {
    const isTyping = (n: EventTarget | null) => {
      const el = n as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable) return true;
      const tag = (el.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el.closest?.('.cm-editor,.ProseMirror');
    };
  
    const onKey = (e: KeyboardEvent) => {
      // only plain key (no modifiers)
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const k = (e.key || '').toLowerCase();
      if (k !== 't' && k !== 'p') return;
      if (isTyping(e.target)) return;
      e.preventDefault();
      if (k === 't') {
        setToolbarCollapsed((v) => !v);
      } else if (k === 'p') {
        setPageMgrOpen((v) => !v);
      }
    };
  
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey as any, { capture: true } as any);
  }, []);
  
  useEffect(() => {
    try { localStorage.setItem('qs:toolbar:collapsed', toolbarCollapsed ? '1' : '0'); } catch {}
    window.dispatchEvent(new CustomEvent('qs:toolbar:collapsed', { detail: toolbarCollapsed }));
  }, [toolbarCollapsed]);

  const [pageMgrOpen, setPageMgrOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try { return (localStorage.getItem('qs:toolbar:pageMgrOpen') ?? '1') !== '0'; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('qs:toolbar:pageMgrOpen', pageMgrOpen ? '1' : '0'); } catch {}
    window.dispatchEvent(new CustomEvent('qs:toolbar:page-manager:open', { detail: pageMgrOpen }));
  }, [pageMgrOpen]);

  const [viewport, setViewport] = useState<'mobile'|'tablet'|'desktop'>(() => {
    try { return (localStorage.getItem('qs:preview:viewport') as any) || 'desktop'; } catch { return 'desktop'; }
  });
  const setViewportAndEmit = (v: 'mobile'|'tablet'|'desktop') => {
    setViewport(v);
    try { localStorage.setItem('qs:preview:viewport', v); } catch {}
    window.dispatchEvent(new CustomEvent('qs:preview:set-viewport', { detail: v }));
  };

  const fireCapture = () => window.dispatchEvent(new CustomEvent('qs:history:capture'));

  const apply = (next: Template) => {
    onApplyTemplate(next);
    onSetRawJson?.(pretty(next));
  };

  // Persisted light/dark for this template (drives the inline preview + the live site).
  const colorMode: 'light' | 'dark' =
    (((template as any)?.color_mode ?? (template as any)?.data?.color_mode ?? 'dark') === 'light') ? 'light' : 'dark';
  const setColorModeAndEmit = (m: 'light' | 'dark') => {
    const cur: any = (tplRef.current ?? template) || {};
    apply({ ...cur, color_mode: m, data: { ...(cur.data ?? {}), color_mode: m } } as Template);
    try { localStorage.setItem('qs:preview:color', m); } catch {}
    window.dispatchEvent(new CustomEvent('qs:preview:set-color-mode', { detail: m }));
  };

  // ---- Theme gallery / shuffle (non-destructive restyle) ----
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const currentThemeId: string | null = (template as any)?.data?.meta?.theme?.id ?? null;

  const applyCuratedTheme = (theme: CuratedTheme) => {
    const cur: any = (tplRef.current ?? template) || {};
    const stamped = toStampedTheme(theme);
    const mode = theme.darkMode;
    apply({
      ...cur,
      color_mode: mode,
      data: {
        ...(cur.data ?? {}),
        color_mode: mode,
        meta: { ...((cur.data ?? {}).meta ?? {}), theme: stamped },
      },
    } as Template);
    try { localStorage.setItem('qs:preview:color', mode); } catch {}
    window.dispatchEvent(new CustomEvent('qs:preview:set-color-mode', { detail: mode }));
  };

  const shuffleTheme = () => {
    const cur: any = (tplRef.current ?? template) || {};
    const industry = cur?.data?.meta?.industry ?? cur?.industry;
    const theme = pickCuratedTheme({
      industry,
      avoidId: cur?.data?.meta?.theme?.id ?? null,
      avoidAccent: cur?.data?.meta?.theme?.accentColor ?? null,
    });
    applyCuratedTheme(theme);
    try { toast.success(`Theme: ${theme.name}`, { icon: '🎲' }); } catch { /* no-op */ }
  };

  /* patch bus: apply + queue save */
  useEffect(() => {
    const onPatch = (e: Event) => {
      const patch = ((e as CustomEvent).detail ?? {}) as any;
      if (!patch || typeof patch !== 'object') return;
      const isTransient = !!patch.__transient;

      const cur: any = tplRef.current;
      const next: any = { ...cur };

      for (const k of Object.keys(patch)) {
        if (k === 'data' || k === '__transient') continue;
        next[k] = patch[k];
      }

      if (patch.data && typeof patch.data === 'object') {
        const merged = { ...(cur?.data ?? {}), ...(patch.data as any) };
        const pages  = Array.isArray(merged.pages) ? merged.pages : [];
        const normalizedPages = normalizePageBlocksShape(pages);
        next.data = { ...merged, pages: normalizedPages };
      }

      apply(next);
      if (isTransient) return;
      queueFullSave('save');
    };

    window.addEventListener('qs:template:apply-patch', onPatch as any);
    return () => window.removeEventListener('qs:template:apply-patch', onPatch as any);
  }, [apply, queueFullSave]);

  /* save */
  const handleSaveClick = async () => {
    try {
      try { window.dispatchEvent(new Event('qs:block-editor:save')); await new Promise((r) => setTimeout(r, 0)); } catch {}
      const cur: any = tplRef.current;

      const pages = getTemplatePagesLoose(cur);
      const normalizedPages = normalizePageBlocksShape(pages);

      const dataIn = (cur?.data ?? {}) as any;
      const metaIn = (dataIn.meta ?? {}) as any;

      const canonicalIndustryKey = resolveIndustryKey(
        metaIn.industry ?? (cur?.data?.meta?.industry) ?? cur?.industry ?? 'other'
      );

      const canonicalServices =
        Array.isArray(dataIn.services) ? dataIn.services :
        Array.isArray(metaIn.services) ? metaIn.services : [];

      const site_type      = metaIn.site_type      ?? cur?.data?.meta?.site_type ?? null;
      const industry_label = metaIn.industry_label ?? cur?.data?.meta?.industry_label ?? null;

      const canonicalData = {
        ...dataIn,
        pages: normalizedPages,
        services: canonicalServices,
        meta: {
          ...metaIn,
          site_type,
          industry_label,
          industry: canonicalIndustryKey,
          services: canonicalServices,
        },
      };

      const next = { ...cur, data: canonicalData } as Template;
      const sig  = templateSig(next);
      if (sig === savedSigRef.current) {
        toast('No changes to save');
        setDirty(false);
        return;
      }

      onSaveDraft?.(next);
      onSetRawJson?.(pretty(next));

      queueFullSave('save');
    } catch (err) {
      console.error('Save failed', err);
      toast.error('Save failed — see console.');
    }
  };

  /* versions */
  const openVersions = () => { try { window.dispatchEvent(new CustomEvent('qs:versions:open')); } catch {} };

  const onCreateSnapshot = async () => {
    try {
      const json = await createSnapshot((tplRef.current as any).id);
      if (json?.error) throw new Error(json.error);
      toast.success('Snapshot created');
      window.dispatchEvent(new CustomEvent('qs:truth:refresh'));
      return json?.snapshotId as string | undefined;
    } catch (e) {
      console.error('[Snapshot] failed', e);
      toast.error('Failed to create snapshot');
      return undefined;
    }
  };

  const onRestore = async (versionId: string) => {
    try {
      const row = await loadVersionRow(versionId);
      if (!confirm('Restore this version? This will overwrite the current draft.')) return;

      const payload = (() => {
        try { return typeof (row as any).data === 'string' ? JSON.parse((row as any).data) : (row as any).data ?? {}; }
        catch { return (row as any).data ?? {}; }
      })();

      const restored: Template = { ...tplRef.current, data: payload } as Template;
      onSaveDraft?.(restored);
      onSetRawJson?.(pretty(restored));

      queueFullSave('save');
      toast.success('Version restored!');
      window.dispatchEvent(new CustomEvent('qs:truth:refresh'));
    } catch (e: any) {
      console.error('Restore failed', e);
      toast.error(`Failed to restore: ${e?.message || 'Unknown error'}`);
    }
  };

  const onPublish = async (snapshotId?: string) => {
    try {
      let sid = snapshotId;
      if (!sid) {
        await handleSaveClick();
        sid = await onCreateSnapshot();
      }
      if (!sid) throw new Error('No snapshot to publish');

      const json = await publishSnapshot((tplRef.current as any).id, sid);
      if (json?.error) throw new Error(json.error);

      toast.success('Published!');
      window.dispatchEvent(new CustomEvent('qs:truth:refresh'));
      try {
        const key = (tplRef.current as any)?.id || (tplRef.current as any)?.slug;
        if (key) dispatchTemplateCacheInvalidate(String(key));
      } catch {}
    } catch (e) {
      console.error('[Publish] failed', e);
      toast.error('Failed to publish');
    }
  };

  /* dev cache */
  const invalidateCache = () => {
    const cur = tplRef.current as any;
    const key = cur?.id || cur?.slug;
    if (!key) return toast.error('No template key to invalidate');
    dispatchTemplateCacheInvalidate(String(key));
    toast('Template cache invalidated', { icon: '🗑️' });
  };
  const updateCacheFromEditor = () => {
    const cur = tplRef.current as any;
    if (!cur?.id) return toast.error('No template loaded');
    dispatchTemplateCacheUpdate(toCacheRow(cur));
    toast.success('Cache updated from editor state');
  };
  const showCacheInfo = () => {
    const cur = tplRef.current as any;
    const key = cur?.id || cur?.slug;
    if (!key) return toast.error('No template key');
    const cached = readTemplateCache(String(key));
    if (!cached) return toast('No cache entry', { icon: 'ℹ️' });
    console.log('[Template Cache]', cached);
    toast(`Cache: ${cached?.updated_at?.slice(0,19).replace('T',' ')}`, { icon: '🗄️' });
  };

  const currentPages  = useMemo(() => getTemplatePagesLoose(template), [template]);
  const currentSlug   = useMemo(() => {
    if (typeof window !== 'undefined') {
      const qs = new URLSearchParams(window.location.search);
      const page = qs.get('page');
      if (page) return page;
    }
    return currentPages[0]?.slug || 'home';
  }, [currentPages]);

  const centerPos    = 'left-1/2 -translate-x-1/2';
  const collapsedPos = 'left-[25%]';

  return mounted ? createPortal(
    <>
      {/* Always-visible Shuffle-theme FAB — restyle the whole site in one click,
          even when the toolbar is collapsed. Sits above the centered toolbar. */}
      <button
        type="button"
        onClick={shuffleTheme}
        title="Shuffle theme — restyle this site (keeps your content)"
        aria-label="Shuffle theme"
        className="fixed bottom-24 right-6 z-[2147483647] inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-2xl ring-1 ring-white/20 transition hover:scale-[1.03] hover:from-purple-500 hover:to-fuchsia-500 active:scale-95 pointer-events-auto"
      >
        <Shuffle className="h-5 w-5" />
        Shuffle theme
      </button>

      <div
        id="template-action-toolbar"
        className={`fixed bottom-4 z-[2147483647] rounded-2xl border border-zinc-700 bg-zinc-900/95 backdrop-blur shadow-lg text-zinc-100 hover:border-purple-500 transition pointer-events-auto ${
          toolbarCollapsed
            ? `${collapsedPos} translate-x-0 w-auto px-2 py-2 opacity-80 hover:opacity-100`
            : `${centerPos} w-[95%] max-w-5xl px-4 sm:px-6 py-3 opacity-90 hover:opacity-100`
        }`}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {toolbarCollapsed ? (
          <div className="w-full flex items-center gap-2">
            <Button size="icon" variant="secondary" title="Show toolbar (T)" aria-label="Show toolbar (T)" onClick={() => setToolbarCollapsed(false)}>
              <SettingsIcon className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="w-full flex justify-between items-center gap-3">
            {/* Hide/Show toolbar */}
            <Button size="icon" variant="ghost" title="Hide toolbar (T)" aria-label="Hide toolbar (T)" onClick={() => setToolbarCollapsed(true)}>
              <SettingsIcon className="w-4 h-4" />
            </Button>

            {/* Open Site Settings (same behavior as pressing "s") */}
            <Button
              size="icon"
              variant="ghost"
              title="Open Site Settings (S)"
              aria-label="Open Site Settings (S)"
              onClick={() => {
                // Toggle the same drawer the "s" key controls
                window.dispatchEvent(new CustomEvent('qs:settings:toggle'));
                // (optional) keep the old localStorage line if you rely on it elsewhere
                try { window.localStorage.setItem('qs:settingsOpen', '1'); } catch {}
              }}
            >
              <Wrench className="w-4 h-4" />
            </Button>

            {/* Page Manager */}
            <PageManagerToolbar
              pages={currentPages}
              currentSlug={currentSlug}
              open={pageMgrOpen}
              onOpenChange={setPageMgrOpen}
              onSelect={(slug) => {
                const sp = new URLSearchParams(window.location.search);
                sp.set('page', slug);
                history.replaceState(null, '', `${location.pathname}?${sp.toString()}`);
              }}
              onAdd={(newPage) => {
                fireCapture();
                const pages = [...getTemplatePagesLoose(tplRef.current), newPage];
                const next  = withPages(tplRef.current, pages);
                apply(next);
                queueFullSave('autosave');
              }}
              onRename={(oldSlug, nextVals) => {
                fireCapture();
                const pages = getTemplatePagesLoose(tplRef.current).map((p: any) =>
                  p.slug === oldSlug ? { ...p, title: nextVals.title, slug: nextVals.slug } : p
                );
                const next = withPages(tplRef.current, pages);
                apply(next);
                queueFullSave('autosave');
              }}
              onDelete={(slug) => {
                fireCapture();
                const pages = getTemplatePagesLoose(tplRef.current).filter((p: any) => p.slug !== slug);
                const next  = withPages(tplRef.current, pages);
                apply(next);
                queueFullSave('autosave');
              }}
              onReorder={(from, to) => {
                fireCapture();
                const pages = [...getTemplatePagesLoose(tplRef.current)];
                const [moved] = pages.splice(from, 1);
                pages.splice(to, 0, moved);
                const next = withPages(tplRef.current, pages);
                apply(next);
                queueFullSave('autosave');
              }}
              siteId={(tplRef.current as any).site_id}
            />

            <Button size="icon" variant="ghost" title="Page Settings" onClick={() => onOpenPageSettings?.()}>
              <SlidersHorizontal className="w-4 h-4" />
            </Button>

            {/* Viewport */}
            <div className="flex items-center gap-1">
              <Button size="icon" variant={viewport === 'mobile' ? 'secondary' : 'ghost'} title="Mobile width" aria-pressed={viewport === 'mobile'} onClick={() => setViewportAndEmit('mobile')}>
                <Smartphone className="w-4 h-4" />
              </Button>
              <Button size="icon" variant={viewport === 'tablet' ? 'secondary' : 'ghost'} title="Tablet width" aria-pressed={viewport === 'tablet'} onClick={() => setViewportAndEmit('tablet')}>
                <Tablet className="w-4 h-4" />
              </Button>
              <Button size="icon" variant={viewport === 'desktop' ? 'secondary' : 'ghost'} title="Desktop width" aria-pressed={viewport === 'desktop'} onClick={() => setViewportAndEmit('desktop')}>
                <Monitor className="w-4 h-4" />
              </Button>
            </div>

            {/* Light / Dark + Theme gallery (persists to the template) — a labeled
                control that reads clearly as the theme/look switcher. */}
            <div className="relative">
              <div
                role="group"
                aria-label="Theme"
                className="flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5"
              >
                <Button
                  size="sm"
                  variant={colorMode === 'light' ? 'secondary' : 'ghost'}
                  className="h-7 gap-1.5 px-2"
                  title="Light mode"
                  aria-pressed={colorMode === 'light'}
                  onClick={() => setColorModeAndEmit('light')}
                >
                  <Sun className="w-4 h-4" />
                  <span className="text-xs font-medium">Light</span>
                </Button>
                <Button
                  size="sm"
                  variant={colorMode === 'dark' ? 'secondary' : 'ghost'}
                  className="h-7 gap-1.5 px-2"
                  title="Dark mode"
                  aria-pressed={colorMode === 'dark'}
                  onClick={() => setColorModeAndEmit('dark')}
                >
                  <Moon className="w-4 h-4" />
                  <span className="text-xs font-medium">Dark</span>
                </Button>
                <Button
                  size="sm"
                  variant={themePanelOpen ? 'secondary' : 'ghost'}
                  className="h-7 gap-1.5 px-2"
                  title="Browse themes / shuffle"
                  aria-pressed={themePanelOpen}
                  onClick={() => setThemePanelOpen((o) => !o)}
                >
                  <Palette className="w-4 h-4" />
                  <span className="text-xs font-medium">Theme</span>
                </Button>
              </div>

              {themePanelOpen ? (
                <>
                  <div className="fixed inset-0 z-[9999]" onClick={() => setThemePanelOpen(false)} />
                  <div className="absolute bottom-full left-0 z-[10000] mb-2">
                    <ThemeShufflePanel
                      currentId={currentThemeId}
                      onApply={applyCuratedTheme}
                      onShuffle={shuffleTheme}
                    />
                  </div>
                </>
              ) : null}
            </div>

            {/* DEV cache buttons */}
            {process.env.NODE_ENV !== 'production' && (
              <div className="flex items-center gap-1 mr-1">
                <Button size="icon" variant="ghost" title="Dev: Show cache info" onClick={showCacheInfo}>
                  <Database className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Dev: Update cache from editor" onClick={updateCacheFromEditor}>
                  <Database className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Dev: Invalidate cache" onClick={invalidateCache}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Save + autosave status */}
            <div className="flex items-center gap-2">
              {saveError ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400 mr-1" title={saveError}>
                  <AlertTriangle className="w-3.5 h-3.5" /> Not saved
                </span>
              ) : typeof autosaveStatus === 'string' && autosaveStatus ? (
                <span className="text-[11px] text-zinc-400 mr-1">{autosaveStatus}</span>
              ) : null}
              <Button
                size="sm"
                variant={dirty || saveError ? 'outline' : 'ghost'}
                disabled={!dirty && !pending && !saveError}
                className={saveError ? 'bg-red-600 hover:bg-red-700 text-white' : dirty ? 'bg-purple-500 hover:bg-purple-600' : ''}
                onClick={handleSaveClick}
                title={saveError ? `Save failed: ${saveError}. Click to retry.` : dirty ? 'Save changes (⌘/Ctrl+S)' : pending ? 'Saving…' : 'All changes saved'}
              >
                {pending ? 'Saving…' : saveError ? 'Retry save' : dirty ? 'Save' : (<span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" />Saved</span>)}
              </Button>
            </div>

            {/* Status + undo/redo */}
            <div className="text-sm font-medium flex gap-3 items-center">
              <span className={`text-xs px-2 py-1 rounded ${status === 'Published' ? 'bg-green-600' : 'bg-yellow-600'}`}>
                {status}
              </span>

              <div className="relative">
                <Button size="icon" variant="ghost" onClick={undo} title={`Undo (${stats.past}) • ⌘Z`}>
                  <RotateCcw className="w-4 h-4" />
                </Button>
                {stats.past > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-[16px] px-1 rounded-full text-[10px] bg-zinc-200 text-zinc-900 text-center">
                    {stats.past}
                  </span>
                )}
              </div>

              <div className="relative">
                <Button size="icon" variant="ghost" onClick={redo} title={`Redo (${stats.future}) • ⇧⌘Z`}>
                  <RotateCw className="w-4 h-4" />
                </Button>
                {stats.future > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-[16px] px-1 rounded-full text-[10px] bg-zinc-200 text-zinc-900 text-center">
                    {stats.future}
                  </span>
                )}
              </div>
            </div>

            {/* Hide control */}
            <Button size="sm" variant="ghost" title="Hide toolbar (T)" aria-label="Hide toolbar (T)" onClick={() => setToolbarCollapsed(true)} className="px-2 py-1">
              <Minus className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Hide</span>
            </Button>
          </div>
        )}
      </div>

      {saveWarnings.length > 0 && (
        <div className="mt-3 rounded-md border border-yellow-500/30 bg-yellow-500/10 text-yellow-200 text-xs px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-[2px] flex-none" />
          <div className="flex-1 space-y-1">{saveWarnings.map((w, i) => (<div key={i}>{w.message}</div>))}</div>
          <button aria-label="Dismiss warnings" onClick={() => setSaveWarnings([])} className="p-1 rounded hover:bg-yellow-500/20">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <AsyncGifOverlay open={overlayOpen} message={overlayMsg} />
    </>,
    document.body
  ) : null;
}
