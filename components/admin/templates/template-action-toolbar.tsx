// components/admin/templates/template-action-toolbar.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  RotateCcw, RotateCw, AlertTriangle, X, Maximize2, Minimize2,
  Smartphone, Tablet, Monitor, Sun, Moon, SlidersHorizontal, Check,
  Settings as SettingsIcon,
  Trash2,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui';
import toast from 'react-hot-toast';

import type { Template } from '@/types/template';
import { validateTemplateAndFix } from '@/admin/lib/validateTemplate';
import { prepareTemplateForSave } from '@/admin/lib/prepareTemplateForSave';
import { saveAsTemplate } from '@/admin/lib/saveAsTemplate';
import { createSharedPreview } from '@/admin/lib/createSharedPreview';

import AsyncGifOverlay from '@/components/ui/async-gif-overlay';
import VersionsDropdown from '@/components/admin/templates/versions-dropdown';
import { useTemplateVersions } from '@/hooks/useTemplateVersions';
import { templateSig } from '@/lib/editor/saveGuard';
import { buildSharedSnapshotPayload, normalizeForSnapshot } from '@/lib/editor/templateUtils';
import { createSnapshotFromTemplate, loadVersionRow } from '@/admin/lib/templateSnapshots';
import PageManagerToolbar from '@/components/admin/templates/page-manager-toolbar';
import { usePersistTemplate, useTemplateRef } from '@/hooks/usePersistTemplate';
import { AiCostPreview } from '@/components/admin/templates/AiCostPreview';

// 🔽 Cache helpers
import {
  dispatchTemplateCacheInvalidate,
  dispatchTemplateCacheUpdate,
  readTemplateCache,
  type TemplateCacheRow,
} from '@/lib/templateCache';

/* ---------- local helpers ---------- */
function getTemplatePagesLoose(t: Template): any[] {
  const d: any = t ?? {};
  if (Array.isArray(d?.data?.pages)) return d.data.pages;
  if (Array.isArray(d?.pages)) return d.pages;
  return [];
}
function withPages(t: Template, pages: any[]): Template {
  const anyT: any = t ?? {};
  if (Array.isArray(anyT?.data?.pages)) return { ...anyT, data: { ...anyT.data, pages } } as Template;
  return { ...anyT, pages } as Template;
}
function pretty(next: Template) {
  try { return JSON.stringify(next?.data ?? next, null, 2); }
  catch { return JSON.stringify(next, null, 2); }
}
function baseSlug(slug?: string | null) {
  if (!slug) return '';
  return slug.replace(/(-[a-z0-9]{2,12})+$/i, '');
}
// Shape a Template into a cache row
function toCacheRow(t: any): TemplateCacheRow {
  return {
    id: t?.id,
    slug: t?.slug ?? null,
    template_name: t?.template_name ?? null,
    updated_at: t?.updated_at ?? new Date().toISOString(),
    color_mode: t?.color_mode ?? null,
    data: t?.data ?? {},
    header_block: t?.headerBlock ?? t?.data?.headerBlock ?? null,
    footer_block: t?.footerBlock ?? t?.data?.footerBlock ?? null,
  };
}

type SaveWarning = { field: string; message: string };

type Props = {
  template: Template;
  autosaveStatus?: string;
  onSaveDraft?: (maybeSanitized?: Template) => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenPageSettings?: () => void;
  onApplyTemplate: (next: Template) => void;
  onSetRawJson?: (json: string) => void;
};

export function TemplateActionToolbar({
  template,
  autosaveStatus,
  onSaveDraft,
  onUndo,
  onRedo,
  onOpenPageSettings,
  onApplyTemplate,
  onSetRawJson,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState('Draft');
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayMsg, setOverlayMsg] = useState<string>('Working…');
  const [saveWarnings, setSaveWarnings] = useState<SaveWarning[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);

  // history counters for badges
  const [hist, setHist] = useState<{ past: number; future: number }>({ past: 0, future: 0 });

  // settings sidebar open state (mirrors localStorage and listens to external changes)
  const [settingsOpenState, setSettingsOpenState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return (window.localStorage.getItem('qs:settingsOpen') ?? '0') !== '0'; } catch { return false; }
  });
  useEffect(() => {
    const sync = (e: Event) => {
      const v = !!(e as CustomEvent).detail;
      setSettingsOpenState(v);
    };
    window.addEventListener('qs:settings:set-open', sync as any);
    return () => window.removeEventListener('qs:settings:set-open', sync as any);
  }, []);
  const [toolbarEnabled, setToolbarEnabled] = useState(true);
  useEffect(() => {
    const onToggle = (e: Event) => setToolbarEnabled(!!(e as CustomEvent).detail);
    window.addEventListener('qs:toolbar:set-enabled', onToggle as any);
    return () => window.removeEventListener('qs:toolbar:set-enabled', onToggle as any);
  }, []);
  // latest template ref
  const tplRef = useTemplateRef(template);

  // signature of the LAST PERSISTED template
  const savedSigRef = useRef<string>('');
  useEffect(() => { savedSigRef.current = templateSig(template); }, []); // initial mount
  useEffect(() => { /* when id changes, reset baseline if desired */ }, [(template as any)?.id]);

  // derived "dirty"
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setDirty(templateSig(template) !== savedSigRef.current); }, [template]);

  // keyboard: Cmd/Ctrl+S to save when dirty
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (dirty) void handleSaveClick();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty]);

  // also wire Cmd/Ctrl+Z (undo) & Shift+Cmd/Ctrl+Z (redo)
  useEffect(() => {
    const isTyping = (n: EventTarget | null) => {
      const el = n as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable) return true;
      const tag = (el.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el.closest?.('.cm-editor,.ProseMirror');
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = (e.key || '').toLowerCase();
      if (k !== 'z') return;
      if (isTyping(e.target)) return;
      e.preventDefault();
      if (e.shiftKey) handleRedo(); else handleUndo();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey as any, { capture: true } as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // listen for history stats from EditorContent & ask for them at mount
  useEffect(() => {
    const onStats = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      setHist({ past: Number(d.past ?? 0), future: Number(d.future ?? 0) });
    };
    window.addEventListener('qs:history:stats', onStats as any);
    window.dispatchEvent(new CustomEvent('qs:history:request-stats'));
    return () => window.removeEventListener('qs:history:stats', onStats as any);
  }, []);

  // apply helper (state + JSON view)
  const apply = (next: Template) => { onApplyTemplate(next); onSetRawJson?.(pretty(next)); };

  // persist hook (to /api/templates/:id/edit)
  const { persist, persistSoon, pending } = usePersistTemplate(
    (template as any)?.id,
    () => tplRef.current,
    {
      debounceMs: 350,
      onSuccess: () => {
        savedSigRef.current = templateSig(tplRef.current);
        setDirty(false);
      },
      onError: (e) => console.error('[persistTemplate] failed:', e),
    }
  );

  // portal mount guard
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // viewport + color
  const [viewport, setViewport] = useState<'mobile'|'tablet'|'desktop'>(() => {
    try { return (localStorage.getItem('qs:preview:viewport') as any) || 'desktop'; } catch { return 'desktop'; }
  });
  const [colorPref, setColorPref] = useState<'light'|'dark'>(() => {
    try { return (localStorage.getItem('qs:preview:color') as any) || 'dark'; } catch { return 'dark'; }
  });
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('qs:preview:set-viewport', { detail: viewport }));
    window.dispatchEvent(new CustomEvent('qs:preview:set-color-mode', { detail: colorPref }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setViewportAndEmit = (v: 'mobile'|'tablet'|'desktop') => {
    setViewport(v);
    try { localStorage.setItem('qs:preview:viewport', v); } catch {}
    window.dispatchEvent(new CustomEvent('qs:preview:set-viewport', { detail: v }));
  };

  useEffect(() => {
    const onPatch = (e: Event) => {
      const patch = (e as CustomEvent).detail || {};
      if (!patch) return;
      const next: any = {
        ...tplRef.current,
        ...('footerBlock' in patch ? { footerBlock: patch.footerBlock } : {}),
      };
      // merge nested data
      if (patch.data) {
        next.data = { ...(tplRef.current as any)?.data, ...patch.data };
      }
      apply(next);
      persistSoon(next);
    };
    window.addEventListener('qs:template:apply-patch', onPatch as any);
    return () => window.removeEventListener('qs:template:apply-patch', onPatch as any);
  }, [apply, persistSoon]);
  
  // === Template Settings sidebar control ===
  const emitSettingsOpen = (open: boolean) => {
    window.dispatchEvent(new CustomEvent('qs:settings:set-open', { detail: open }));
    try { window.localStorage.setItem('qs:settingsOpen', open ? '1' : '0'); } catch {}
    setSettingsOpenState(open);
  };
  const toggleTemplateSettings = () => emitSettingsOpen(!settingsOpenState);

  const fireCapture = () => window.dispatchEvent(new CustomEvent('qs:history:capture'));

  const toggleColor = () => {
    fireCapture();
    const nextMode: 'light'|'dark' = colorPref === 'dark' ? 'light' : 'dark';
    setColorPref(nextMode);
    try { localStorage.setItem('qs:preview:color', nextMode); } catch {}
    const next = { ...tplRef.current, color_mode: nextMode } as Template;
    apply(next);
    persistSoon(next);
    window.dispatchEvent(new CustomEvent('qs:preview:set-color-mode', { detail: nextMode }));
  };

  // fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);
  const prevSidebarCollapsedRef = useRef<boolean | null>(null);
  const prevSettingsOpenRef = useRef<boolean | null>(null);
  const readSidebarCollapsed = () =>
    typeof window !== 'undefined' && window.localStorage.getItem('admin-sidebar-collapsed') === 'true';
  const setSidebarCollapsed = (c: boolean) => {
    window.dispatchEvent(new CustomEvent('qs:sidebar:set-collapsed', { detail: c }));
    try { window.localStorage.setItem('admin-sidebar-collapsed', String(c)); } catch {}
  };
  const setSettingsOpenFlag = (open: boolean) => emitSettingsOpen(open);

  const scrollFirstBlockToTop = () => {
    const el =
      document.querySelector<HTMLElement>('[data-block-id]') ??
      document.querySelector<HTMLElement>('[data-block-type]');
    if (!el) return;
    const header = document.querySelector<HTMLElement>('header');
    const offset = (header?.offsetHeight ?? 64) + 8;
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  };
  const enterFullscreen = () => {
    prevSidebarCollapsedRef.current = readSidebarCollapsed();
    try { prevSettingsOpenRef.current = window.localStorage.getItem('qs:settingsOpen') !== '0'; }
    catch { prevSettingsOpenRef.current = settingsOpenState; }
    setSettingsOpenFlag(false); // hide settings sidebar in fullscreen
    setSidebarCollapsed(true);
    requestAnimationFrame(() => setTimeout(scrollFirstBlockToTop, 120));
    setIsFullscreen(true);
  };
  const exitFullscreen = () => {
    if (prevSettingsOpenRef.current !== null) setSettingsOpenFlag(prevSettingsOpenRef.current);
    if (prevSidebarCollapsedRef.current !== null) setSidebarCollapsed(prevSidebarCollapsedRef.current);
    setIsFullscreen(false);
  };
  const toggleFullscreen = () => (isFullscreen ? exitFullscreen() : enterFullscreen());

  // versions id: prefer UUID, else baseSlug
  const tplAny: any = template;
  const idOrSlug = tplAny?.id || baseSlug(tplAny?.slug) || template.template_name || '';
  const { versions, reloadVersions, publishedVersionId } =
    useTemplateVersions(idOrSlug, tplAny?.id ?? null);

  const lastSigRef = useRef<string>('');
  useEffect(() => {
    lastSigRef.current = templateSig(template);
    setStatus(template?.published ? 'Published' : 'Draft');
  }, [(template as any)?.id, template?.published]);

  const latestLabel = useMemo(() => {
    if (!versions.length) return 'No versions';
    const first = versions[0];
    const msg = (first.commit || '').trim() || 'Snapshot';
    const now = Date.now();
    const then = new Date(first.updated_at || first.created_at || Date.now()).getTime();
    const s = Math.max(1, Math.floor((now - then) / 1000));
    const rel = s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`;
    return `${msg} · ${rel} ago`;
  }, [versions]);

  const handleDuplicateSite = async () => {
    try {
      setOverlayMsg('Creating your site…');
      setOverlayOpen(true);
      const normalized = normalizeForSnapshot(tplRef.current);
      const created = await saveAsTemplate(normalized, 'site');
      if (!created) return toast.error('Failed to duplicate');
      const slug = created.slug ?? null;
      router.push(slug ? `/template/${slug}/edit` : '/admin/templates');
      toast.success('Duplicated as site');
    } catch (e) {
      console.error('[Duplicate] failed:', e);
      toast.error('Failed to duplicate');
    } finally {
      setOverlayOpen(false);
    }
  };

  const handleShare = async () => {
    try {
      const { normalized, templateData } = buildSharedSnapshotPayload(tplRef.current);
      const id = await createSharedPreview({
        templateId: normalized.id,
        templateName: normalized.template_name,
        templateData,
      });
      if (!id) return toast.error('Share failed');
      toast.success('Preview shared!');
      router.push(`/shared/${id}`);
    } catch (e) {
      console.error('[Share] failed', e);
      toast.error('Share failed');
    }
  };

  const handleSaveClick = async () => {
    try {
      const source = tplRef.current as any;

      // snapshot fields
      const srcPages = getTemplatePagesLoose(source);
      const srcHeader = source.headerBlock ?? source?.data?.headerBlock ?? null;
      const srcFooter = source.footerBlock ?? source?.data?.footerBlock ?? null;
      const srcColor  = source.color_mode;
      const srcSlug   = source.slug;              // 🔒 lock
      const srcName   = source.template_name;     // 🔒 lock

      const preppedDbShape = prepareTemplateForSave
        ? prepareTemplateForSave(
            normalizeForSnapshot(source, {
              stripChrome: true,
              preserveIds: true,
              preserveSlug: true,
              preserveTemplateName: true,
            })
          )
        : source;

      const check = validateTemplateAndFix(preppedDbShape);
      if (!check?.valid) {
        return toast.error('Validation failed — see console for details.');
      }

      const nextTemplate = (check.data ?? {}) as any;

      // re-hydrate pages + theme + header/footer
      const outPages = getTemplatePagesLoose(nextTemplate);
      if (!Array.isArray(outPages) || !outPages.length) {
        nextTemplate.data = { ...(nextTemplate.data ?? {}), pages: srcPages };
        nextTemplate.pages = srcPages;
      } else {
        nextTemplate.data = { ...(nextTemplate.data ?? {}), pages: outPages };
        if (!Array.isArray(nextTemplate.pages) || !nextTemplate.pages.length) {
          nextTemplate.pages = outPages;
        }
      }
      if (srcColor && nextTemplate.color_mode !== srcColor) nextTemplate.color_mode = srcColor;
      if (!nextTemplate.headerBlock && srcHeader) nextTemplate.headerBlock = srcHeader;
      if (!nextTemplate.footerBlock && srcFooter) nextTemplate.footerBlock = srcFooter;
      if (srcHeader && !nextTemplate?.data?.headerBlock) {
        nextTemplate.data = { ...(nextTemplate.data ?? {}), headerBlock: srcHeader };
      }
      if (srcFooter && !nextTemplate?.data?.footerBlock) {
        nextTemplate.data = { ...(nextTemplate.data ?? {}), footerBlock: srcFooter };
      }

      // 🔒 NEVER rename on Save
      nextTemplate.slug = srcSlug;
      nextTemplate.template_name = srcName;

      const nextSig = templateSig(nextTemplate as Template);
      if (nextSig === savedSigRef.current) {
        toast('No changes to save');
        setDirty(false);
        return;
      }

      if (check.warnings?.length) {
        setSaveWarnings(check.warnings as any);
        check.warnings.forEach((w: any) =>
          toast((t) => <span className="text-yellow-500">⚠️ {w.message}</span>)
        );
        setTimeout(() => setSaveWarnings([]), 5000);
      } else {
        setSaveWarnings([]);
      }

      onSaveDraft?.(nextTemplate as Template);
      onSetRawJson?.(pretty(nextTemplate as Template));
      const ok = await persist(nextTemplate as Template);
      if (ok) {
        savedSigRef.current = templateSig(nextTemplate as Template);
        setDirty(false);

        // 🔁 Update cache from saved state
        try {
          dispatchTemplateCacheUpdate(toCacheRow(nextTemplate));
        } catch {}
      }
      toast.success('Saved!');
    } catch (err) {
      console.error('❌ Exception during validation:', err);
      toast.error('Validation crashed — see console.');
    }
  };

  async function onCreateSnapshot() {
    try {
      const res = await fetch(`/api/templates/${template.id}/snapshots`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label: undefined }), // optional label
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Snapshot failed');
      toast.success('Snapshot created');
      // optionally refresh versions list here
    } catch (e) {
      console.error('[Snapshot] insert failed', e);
      toast.error('Failed to create snapshot');
    }
  }

  const onRestore = async (id: string) => {
    const trace = `restore:${id}:${Date.now()}`;
    console.time(`QSITES[versions] restore time ${trace}`);
    try {
      console.info(`QSITES[versions] begin restore trace=${trace}`, { id });
  
      const data = await loadVersionRow(id);
  
      if (!confirm('Restore this version? This will overwrite the current draft.')) {
        console.info(`QSITES[versions] cancelled by user trace=${trace}`);
        return;
      }
  
      // data.data may be stringified JSON or object, normalize it:
      const payload = (() => {
        try {
          return typeof (data as any).data === 'string'
            ? JSON.parse((data as any).data)
            : (data as any).data ?? {};
        } catch (e) {
          console.warn('JSON parse failed for version.data, using raw', e);
          return (data as any).data ?? {};
        }
      })();
  
      // Defensive block validator
      const blockErrs: string[] = [];
      for (const page of payload?.pages ?? []) {
        for (const b of page?.content_blocks ?? []) {
          if (!b?.type) blockErrs.push(`block missing type id=${b?.id || b?._id || '?'}`);
          if (b?.props != null && typeof b.props !== 'object')
            blockErrs.push(`block props not object id=${b?.id || b?._id || '?'}`);
        }
      }
      if (blockErrs.length) {
        console.warn(`QSITES[versions] ${blockErrs.length} invalid block(s)`, blockErrs);
        toast((t) => (
          <span>
            Restored with warnings — {blockErrs.length} invalid block
            {blockErrs.length === 1 ? '' : 's'} (see console).
          </span>
        ));
      }
  
      const restored: Template = {
        ...tplRef.current,
        ...(data.header_block ? { headerBlock: data.header_block } : {}),
        ...(data.footer_block ? { footerBlock: data.footer_block } : {}),
        data: payload,
        color_mode:
          (data as any).color_mode ??
          (tplRef.current as any).color_mode,
      };
  
      const normalized = normalizeForSnapshot(restored);
      onSaveDraft?.(normalized);
      onSetRawJson?.(pretty(normalized));
  
      const ok = await persist(normalized);
      if (ok) {
        savedSigRef.current = templateSig(normalized);
        setDirty(false);

        // 🔁 Update cache with restored version
        try {
          dispatchTemplateCacheUpdate(toCacheRow(normalized));
        } catch {}
      }
      toast.success('Version restored!');
    } catch (e: any) {
      console.error('QSITES[versions] restore failed', {
        trace,
        message: e?.message,
        stack: e?.stack,
      });
      const hint = e?.message?.toLowerCase?.().includes('permission') ? ' (RLS?)' : '';
      toast.error(`Failed to load version: ${e?.message || 'Unknown error'}${hint}`);
    } finally {
      console.timeEnd(`QSITES[versions] restore time ${trace}`);
    }
  };

  const onPublish = async (_id?: string) => {
    try {
      const slugOrName = (tplRef.current as any).slug || tplRef.current.template_name || '';
      await fetch(`/api/templates/${encodeURIComponent(slugOrName)}/publish`, { method: 'POST' });
      await reloadVersions();
      toast.success('Published!');

      // 🧹 Invalidate cache after publish (or replace with update if your publish mutates local state)
      try {
        const key = (tplRef.current as any)?.id || (tplRef.current as any)?.slug;
        if (key) dispatchTemplateCacheInvalidate(String(key));
      } catch {}
    } catch (e) {
      console.error('[Publish] failed', e);
      toast.error('Failed to publish');
    }
  };

  // Undo/Redo button handlers with toast + stats refresh
  const handleUndo = () => {
    onUndo();
    window.dispatchEvent(new CustomEvent('qs:history:request-stats'));
    toast('Undo', { icon: '↩️' });
  };
  const handleRedo = () => {
    onRedo();
    window.dispatchEvent(new CustomEvent('qs:history:request-stats'));
    toast('Redo', { icon: '↪️' });
  };

  // ===== DEV: cache controls & hotkeys =====
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || !e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'i') { e.preventDefault(); invalidateCache(); }
      if (k === 'u') { e.preventDefault(); updateCacheFromEditor(); }
      if (k === 'c') { e.preventDefault(); showCacheInfo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;

  const currentSlug =
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('page')) ||
    getTemplatePagesLoose(template)[0]?.slug ||
    'home';

  return createPortal(
    <>
      <div
        id="template-action-toolbar"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[2147483647] w-[95%] max-w-5xl rounded-2xl border border-zinc-700 bg-zinc-900/95 backdrop-blur px-4 sm:px-6 py-3 shadow-lg text-zinc-100 hover:border-purple-500 opacity-90 hover:opacity-100 transition pointer-events-auto"        style={{ WebkitTapHighlightColor: 'transparent', pointerEvents: toolbarEnabled ? 'auto' : 'none' }}
      >
        <div className="w-full flex justify-between items-center gap-3">
          {/* Buttons to the left of page manager */}
          <Button
            size="icon"
            variant={settingsOpenState ? 'secondary' : 'ghost'}
            title="Template Settings Sidebar"
            aria-pressed={settingsOpenState}
            onClick={toggleTemplateSettings}
          >
            <SettingsIcon className="w-4 h-4" />
          </Button>

          {/* Center: Page manager */}
          <PageManagerToolbar
            pages={getTemplatePagesLoose(template)}
            currentSlug={currentSlug}
            onSelect={(slug) => {
              const sp = new URLSearchParams(window.location.search);
              sp.set('page', slug);
              history.replaceState(null, '', `${location.pathname}?${sp.toString()}`);
            }}
            onAdd={(newPage) => {
              fireCapture();
              const pages = [...getTemplatePagesLoose(tplRef.current), newPage];
              const next = withPages(tplRef.current, pages);
              apply(next);
              persistSoon(next);
            }}
            onRename={(oldSlug, nextVals) => {
              fireCapture();
              const pages = getTemplatePagesLoose(tplRef.current).map((p: any) =>
                p.slug === oldSlug ? { ...p, title: nextVals.title, slug: nextVals.slug } : p
              );
              const next = withPages(tplRef.current, pages);
              apply(next);
              persistSoon(next);
            }}
            onDelete={(slug) => {
              fireCapture();
              const pages = getTemplatePagesLoose(tplRef.current).filter((p: any) => p.slug !== slug);
              const next = withPages(tplRef.current, pages);
              apply(next);
              persistSoon(next);
            }}
            onReorder={(from, to) => {
              fireCapture();
              const pages = [...getTemplatePagesLoose(tplRef.current)];
              const [moved] = pages.splice(from, 1);
              pages.splice(to, 0, moved);
              const next = withPages(tplRef.current, pages);
              apply(next);
              persistSoon(next);
            }}
            siteId={(tplRef.current as any).site_id}
          />

          <Button size="icon" variant="ghost" title="Page Settings" onClick={() => onOpenPageSettings?.()}>
            <SlidersHorizontal className="w-4 h-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            title={colorPref === 'dark' ? 'Light mode' : 'Dark mode'}
            onClick={toggleColor}
            aria-pressed={colorPref === 'dark'}
          >
            {colorPref === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          {/* <AiCostPreview template={template} /> */}
          <Button size="icon" variant="ghost" title="Full screen (F)" onClick={toggleFullscreen} aria-pressed={isFullscreen}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>

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

          <VersionsDropdown
            labelTitle={template.template_name || (tplAny?.slug as string) || 'Untitled'}
            versions={versions}
            open={versionsOpen}
            setOpen={setVersionsOpen}
            onCreateSnapshot={onCreateSnapshot}
            onRestore={onRestore}
            onPublish={onPublish}
            publishedVersionId={publishedVersionId ?? null}
            baseSlug={baseSlug(tplAny?.slug)}
            domain={tplAny?.domain}
            defaultSubdomain={tplAny?.default_subdomain}
            onOpenPageSettings={onOpenPageSettings}
          />

          {/* DEV cache buttons */}
          {process.env.NODE_ENV !== 'production' && (
            <div className="flex items-center gap-1 mr-1">
              <Button
                size="icon"
                variant="ghost"
                title="Dev: Show cache info (⌥⌘C)"
                onClick={showCacheInfo}
              >
                <Database className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title="Dev: Update cache from editor (⌥⌘U)"
                onClick={updateCacheFromEditor}
              >
                <Database className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title="Dev: Invalidate cache (⌥⌘I)"
                onClick={invalidateCache}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}

          <Button
            size="sm"
            variant={dirty ? 'outline' : 'ghost'}
            disabled={!dirty && !pending}
            className={dirty ? 'bg-purple-500 hover:bg-purple-600' : ''}
            onClick={handleSaveClick}
            title={dirty ? 'Save changes (⌘/Ctrl+S)' : pending ? 'Saving…' : 'All changes saved'}
          >
            {pending ? 'Saving…' : dirty ? 'Save' : (<span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" />Saved</span>)}
          </Button>

          {/* Status + undo/redo */}
          <div className="text-sm font-medium flex gap-3 items-center">
            <span className={`text-xs px-2 py-1 rounded ${status === 'Published' ? 'bg-green-600' : 'bg-yellow-600'}`}>
              {status}
            </span>

            <div className="relative">
              <Button size="icon" variant="ghost" onClick={handleUndo} title={`Undo (${hist.past} step${hist.past === 1 ? '' : 's'} available) • ⌘Z`}>
                <RotateCcw className="w-4 h-4" />
              </Button>
              {hist.past > 0 && (
                <span className="absolute -right-1 -top-1 min-w-[16px] px-1 rounded-full text-[10px] bg-zinc-200 text-zinc-900 dark:bg-white dark:text-black text-center">
                  {hist.past}
                </span>
              )}
            </div>

            <div className="relative">
              <Button size="icon" variant="ghost" onClick={handleRedo} title={`Redo (${hist.future} step${hist.future === 1 ? '' : 's'} available) • ⇧⌘Z`}>
                <RotateCw className="w-4 h-4" />
              </Button>
              {hist.future > 0 && (
                <span className="absolute -right-1 -top-1 min-w-[16px] px-1 rounded-full text-[10px] bg-zinc-200 text-zinc-900 dark:bg-white dark:text-black text-center">
                  {hist.future}
                </span>
              )}
            </div>
          </div>
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
      </div>

      <AsyncGifOverlay open={overlayOpen} message={overlayMsg} />
    </>,
    document.body
  );
}
