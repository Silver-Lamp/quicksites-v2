// components/admin/templates/template-action-toolbar.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  RotateCcw, RotateCw, AlertTriangle, X, Maximize2, Minimize2,
  Smartphone, Tablet, Monitor, Sun, Moon, SlidersHorizontal
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

/* ---------------------------------- */
/* Local helpers (avoid circular deps) */
/* ---------------------------------- */

function getTemplatePagesLoose(t: Template): any[] {
  const d: any = t ?? {};
  if (Array.isArray(d?.data?.pages)) return d.data.pages;
  if (Array.isArray(d?.pages)) return d.pages;
  return [];
}

function withPages(t: Template, pages: any[]): Template {
  const anyT: any = t ?? {};
  if (Array.isArray(anyT?.data?.pages)) {
    return { ...anyT, data: { ...anyT.data, pages } } as Template;
  }
  return { ...anyT, pages } as Template;
}

type SaveWarning = { field: string; message: string };

type Props = {
  template: Template;
  autosaveStatus?: string;

  /** Called on "Save" and also when color mode toggles */
  onSaveDraft?: (maybeSanitized?: Template) => void;

  /** Undo/Redo emitters */
  onUndo: () => void;
  onRedo: () => void;

  /** Open the Page Settings modal in the parent */
  onOpenPageSettings?: () => void;

  /** Apply a fully-formed template to parent (setTemplate + onChange) */
  onApplyTemplate: (next: Template) => void;
};

export function TemplateActionToolbar({
  template,
  autosaveStatus,
  onSaveDraft,
  onUndo,
  onRedo,
  onOpenPageSettings,
  onApplyTemplate, // ← parent passes: (t) => { setTemplate(t); onChange(t); }
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState('Draft');
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayMsg, setOverlayMsg] = useState<string>('Working…');
  const [saveWarnings, setSaveWarnings] = useState<SaveWarning[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);

  // render in a portal so it’s above the iframe
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [viewport, setViewport] = useState<'mobile' | 'tablet' | 'desktop'>(() => {
    try { return (localStorage.getItem('qs:preview:viewport') as any) || 'desktop'; } catch { return 'desktop'; }
  });
  const [colorPref, setColorPref] = useState<'light' | 'dark'>(() => {
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

  const toggleColor = () => {
    const next = colorPref === 'dark' ? 'light' : 'dark';
    setColorPref(next);
    try { localStorage.setItem('qs:preview:color', next); } catch {}

    // 1) update template (persist later in parent save if desired)
    onSaveDraft?.({ ...template, color_mode: next });

    // 2) flip iframe immediately
    window.dispatchEvent(new CustomEvent('qs:preview:set-color-mode', { detail: next }));
  };

  // ⤵ Fullscreen controls
  const [isFullscreen, setIsFullscreen] = useState(false);
  const prevSidebarCollapsedRef = useRef<boolean | null>(null);
  const prevSettingsOpenRef = useRef<boolean | null>(null);
  const readSidebarCollapsed = () =>
    typeof window !== 'undefined' && window.localStorage.getItem('admin-sidebar-collapsed') === 'true';
  const setSidebarCollapsed = (collapsed: boolean) => {
    window.dispatchEvent(new CustomEvent('qs:sidebar:set-collapsed', { detail: collapsed }));
    try { window.localStorage.setItem('admin-sidebar-collapsed', String(collapsed)); } catch {}
  };
  const setSettingsOpen = (open: boolean) => {
    window.dispatchEvent(new CustomEvent('qs:settings:set-open', { detail: open }));
    try { window.localStorage.setItem('qs:settingsOpen', open ? '1' : '0'); } catch {}
  };
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
    try { prevSettingsOpenRef.current = window.localStorage.getItem('qs:settingsOpen') !== '0'; } catch { prevSettingsOpenRef.current = true; }
    setSettingsOpen(false);
    setSidebarCollapsed(true);
    requestAnimationFrame(() => setTimeout(scrollFirstBlockToTop, 120));
    setIsFullscreen(true);
  };
  const exitFullscreen = () => {
    if (prevSettingsOpenRef.current !== null) setSettingsOpen(prevSettingsOpenRef.current);
    if (prevSidebarCollapsedRef.current !== null) setSidebarCollapsed(prevSidebarCollapsedRef.current);
    setIsFullscreen(false);
  };
  const toggleFullscreen = () => (isFullscreen ? exitFullscreen() : enterFullscreen());

  // versions
  const idOrSlug = (template as any).slug || template.template_name || '';
  const { versions, reloadVersions } = useTemplateVersions(idOrSlug, (template as any)?.id ?? null);

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
      const normalized = normalizeForSnapshot(template);
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
      const { normalized, templateData } = buildSharedSnapshotPayload(template);
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

  const handleSaveClick = () => {
    try {
      const preppedDbShape = prepareTemplateForSave
        ? prepareTemplateForSave(normalizeForSnapshot(template, { stripChrome: true }))
        : (template as any);

      const check = validateTemplateAndFix(preppedDbShape);
      if (!check?.valid) {
        const e = (check as any).errors;
        if (e?.issues || e?.errors) {
          const issues = e.issues ?? e.errors ?? [];
          console.table(
            issues.map((iss: any) => ({
              path: Array.isArray(iss.path) ? iss.path.join('.') : String(iss.path ?? ''),
              message: iss.message ?? JSON.stringify(iss),
            }))
          );
        } else if (e?.fieldErrors) {
          console.table(
            Object.entries(e.fieldErrors).flatMap(([field, msgs]: any) =>
              (msgs ?? []).map((m: string) => ({ field, message: m }))
            )
          );
        } else {
          console.error('[Validation error]', e);
        }
        return toast.error('Validation failed — see console for details.');
      }

      const nextTemplate = check.data as Template;
      const nextSig = templateSig(nextTemplate);
      if (nextSig === lastSigRef.current) {
        toast('No changes to save');
        return;
      }

      if (check.warnings?.length) {
        setSaveWarnings(check.warnings as SaveWarning[]);
        check.warnings.forEach((w) => toast((t) => <span className="text-yellow-500">⚠️ {w.message}</span>));
        setTimeout(() => setSaveWarnings([]), 5000);
      } else {
        setSaveWarnings([]);
      }

      lastSigRef.current = nextSig; // optimistic update
      onSaveDraft?.(nextTemplate);
      toast.success('Saved!');
    } catch (err) {
      console.error('❌ Exception during validation:', err);
      toast.error('Validation crashed — see console.');
    }
  };

  const onCreateSnapshot = async () => {
    try {
      const v = await createSnapshotFromTemplate(template, 'Snapshot');
      toast.success('Snapshot created');
      await reloadVersions();
    } catch (e) {
      console.error('[Snapshot] insert failed', e);
      toast.error('Failed to create snapshot');
    }
  };

  const onRestore = async (id: string) => {
    try {
      const data = await loadVersionRow(id);
      if (!confirm('Restore this version? This will overwrite the current draft.')) return;

      const restored: Template = {
        ...template,
        ...(data.header_block ? { headerBlock: data.header_block } : {}),
        ...(data.footer_block ? { footerBlock: data.footer_block } : {}),
        data: (data as any).data ?? data,
        color_mode: (data as any).color_mode ?? (template as any).color_mode,
      };
      const normalized = normalizeForSnapshot(restored);
      lastSigRef.current = templateSig(normalized);
      onSaveDraft?.(normalized);
      toast.success('Version restored!');
    } catch (e) {
      console.error('[Toolbar] Failed to load version', e);
      toast.error('Failed to load version');
    }
  };

  const onPublish = async (_id?: string) => {
    try {
      const slugOrName = (template as any).slug || template.template_name || '';
      await fetch(`/api/templates/${slugOrName}/publish`, { method: 'POST' });
      await reloadVersions();
      toast.success('Published!');
    } catch (e) {
      console.error('[Publish] failed:', e);
      toast.error('Failed to publish');
    }
  };

  if (!mounted) return null;

  // current page label for the PageManager button
  const currentSlug =
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('page')) ||
    getTemplatePagesLoose(template)[0]?.slug ||
    'home';

  return createPortal(
    <>
      <div
        id="template-action-toolbar"
        className="
          fixed bottom-4 left-1/2 -translate-x-1/2
          z-[2147483647]
          w-[95%] max-w-5xl
          rounded-2xl border border-zinc-700
          bg-zinc-900/95 backdrop-blur
          px-4 sm:px-6 py-3 shadow-lg text-zinc-100
          hover:border-purple-500
          opacity-90 hover:opacity-100 transition
          pointer-events-auto
        "
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <div className="w-full flex justify-between items-center gap-3">
          {/* Left: status + undo/redo */}
          <div className="text-sm font-medium flex gap-3 items-center">
            <span className={`text-xs px-2 py-1 rounded ${status === 'Published' ? 'bg-green-600' : 'bg-yellow-600'}`}>
              {status}
            </span>
            {autosaveStatus && <span className="text-xs text-gray-400 italic">💾 {autosaveStatus}</span>}
            <Button size="icon" variant="ghost" onClick={onUndo} title="Undo (⌘Z)">
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onRedo} title="Redo (⇧⌘Z)">
              <RotateCw className="w-4 h-4" />
            </Button>
          </div>

          {/* Middle: Page manager button + tray */}
          <PageManagerToolbar
            pages={getTemplatePagesLoose(template)}
            currentSlug={currentSlug}
            onSelect={(slug) => {
              const sp = new URLSearchParams(window.location.search);
              sp.set('page', slug);
              history.replaceState(null, '', `${location.pathname}?${sp.toString()}`);
            }}
            onAdd={(newPage) => {
              const pages = [...getTemplatePagesLoose(template), newPage];
              const next = withPages(template, pages);
              onApplyTemplate(next);
            }}
            onRename={(oldSlug, nextVals) => {
              const pages = getTemplatePagesLoose(template).map((p: any) =>
                p.slug === oldSlug ? { ...p, title: nextVals.title, slug: nextVals.slug } : p
              );
              const next = withPages(template, pages);
              onApplyTemplate(next);
            }}
            onDelete={(slug) => {
              const pages = getTemplatePagesLoose(template).filter((p: any) => p.slug !== slug);
              const next = withPages(template, pages);
              onApplyTemplate(next);
            }}
            onReorder={(from, to) => {
              const pages = [...getTemplatePagesLoose(template)];
              const [moved] = pages.splice(from, 1);
              pages.splice(to, 0, moved);
              const next = withPages(template, pages);
              onApplyTemplate(next);
            }}
            siteId={(template as any).site_id}
          />

          {/* Right: viewport + color + versions + save */}
          <div className="flex items-center gap-3">
            <Button size="icon" variant="ghost" title="Full screen (F)" onClick={toggleFullscreen} aria-pressed={isFullscreen}>
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>

            <div className="flex items-center gap-1">
              <Button
                size="icon" variant={viewport === 'mobile' ? 'secondary' : 'ghost'}
                title="Mobile width" aria-pressed={viewport === 'mobile'}
                onClick={() => setViewportAndEmit('mobile')}
              >
                <Smartphone className="w-4 h-4" />
              </Button>
              <Button
                size="icon" variant={viewport === 'tablet' ? 'secondary' : 'ghost'}
                title="Tablet width" aria-pressed={viewport === 'tablet'}
                onClick={() => setViewportAndEmit('tablet')}
              >
                <Tablet className="w-4 h-4" />
              </Button>
              <Button
                size="icon" variant={viewport === 'desktop' ? 'secondary' : 'ghost'}
                title="Desktop width" aria-pressed={viewport === 'desktop'}
                onClick={() => setViewportAndEmit('desktop')}
              >
                <Monitor className="w-4 h-4" />
              </Button>
            </div>

            <Button
              size="icon"
              variant="ghost"
              title={colorPref === 'dark' ? 'Light mode' : 'Dark mode'}
              onClick={toggleColor}
              aria-pressed={colorPref === 'dark'}
            >
              {colorPref === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <Button size="icon" variant="ghost" title="Page Settings" onClick={() => onOpenPageSettings?.()}>
              <SlidersHorizontal className="w-4 h-4" />
            </Button>

            <VersionsDropdown
              labelTitle={template.template_name || (template as any).slug || 'Untitled'}
              versions={versions}
              open={versionsOpen}
              setOpen={setVersionsOpen}
              onCreateSnapshot={onCreateSnapshot}
              onRestore={onRestore}
              onPublish={onPublish}
            />

            <Button size="sm" variant="secondary" onClick={handleSaveClick}>
              Save
            </Button>

            <Button size="sm" variant="secondary" onClick={handleDuplicateSite} disabled={overlayOpen}>
              Duplicate Site
            </Button>
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
