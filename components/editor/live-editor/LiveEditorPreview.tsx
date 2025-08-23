// components/admin/templates/LiveEditorPreview.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Moon, Sun, Settings2, Copy } from 'lucide-react';
import CollapsiblePanel from '@/components/ui/collapsible-panel';
import { TemplateThemeWrapper } from '@/components/theme/template-theme-wrapper';
import { useTheme } from '@/hooks/useThemeContext';
import PageTabsBar from '@/components/admin/templates/page-tabs-bar';
import { saveTemplate } from '@/admin/lib/saveTemplate';
import {
  getEffectiveFooter,
  getEffectiveHeader,
  getPages,
  slugify,
  withSyncedPages,
} from '@/components/editor/live-editor/helpers';
import { useImmersive, useSelectedPageId } from '@/components/editor/live-editor/hooks';
import BlocksList from '@/components/editor/live-editor/BlocksList';
import EmptyAddBlock from '@/components/editor/live-editor/EmptyAddBlock';
import RenderBlock from '@/components/admin/templates/render-block';
import type { Template, Page } from '@/types/template';
import type { BlockValidationError } from '@/hooks/validateTemplateBlocks';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { DynamicBlockEditor } from '@/components/editor/dynamic-block-editor';
import Portal from '@/components/ui/portal';
import { makeSaveGuard } from '@/lib/editor/saveGuard';
import type { Block } from '@/types/blocks';
import clsx from 'clsx';
import SidebarSettings from '@/components/admin/template-settings-panel/sidebar-settings';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

type Props = {
  template: Template;
  onChange: (template: Template) => void;
  industry: string;
  errors: Record<string, BlockValidationError[]>;
  templateId: string;
  onEditHeader: (b: Block) => void;          // kept for API compatibility (not required now)
  onEditFooter?: (b: Block | null) => void;  // kept for API compatibility (not required now)
  showEditorChrome: boolean;
  mode: 'template' | 'site';
  rawJson: string;
  setRawJson: (rawJson: string) => void;
  setTemplate: (template: Template) => void;
};

export default function LiveEditorPreview({
  template,
  onChange,
  industry,
  errors,
  templateId,
  onEditHeader,
  onEditFooter,
  showEditorChrome,
  mode,
  rawJson,
  setRawJson,
  setTemplate,
}: Props) {
  const [debugMode] = useState(false);
  const router = useRouter();
  const [dupLoading, setDupLoading] = useState(false);
  
  const [editing, setEditing] = useState<Block | null>(null);
  const [lastInsertedId, setLastInsertedId] = useState<string | null>(null);
  const [showOutlines] = useState(false);

  // Global (site-level) header/footer editor (separate from per-block modal)
  const [globalEditing, setGlobalEditing] = useState<'header' | 'footer' | null>(null);
  const [globalDraft, setGlobalDraft] = useState<any | null>(null);

  // Device preview
  const [device, setDevice] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  // Optional right settings column (kept for layout compatibility)
  // const [showSettings, setShowSettings] = useState(false);

  // const COLLAPSED_SIDEBAR_W = 64;
  // const SETTINGS_W = 420;

  // Undo/redo
  const undoStack = useRef<Template[]>([]);
  const redoStack = useRef<Template[]>([]);

  const { theme: ctxTheme, setTheme } = useTheme();
  const resolvedColorMode =
    ((template as any).color_mode as 'light' | 'dark' | undefined) ??
    (ctxTheme?.darkMode as 'light' | 'dark' | undefined) ??
    'light';

  // Save guard
  const saveGuardRef = useRef(makeSaveGuard(template));
  useEffect(() => {
    saveGuardRef.current = makeSaveGuard(template);
    redoStack.current = [];
  }, [template?.id]);

  // Pages / selection
  const pages = getPages(template);
  const STORAGE_KEY = `qs:selectedPageId:${templateId}`;
  const { selectedPageId, setSelectedPageId, selectedPageIndex, selectedPage } =
    useSelectedPageId(pages, STORAGE_KEY);
  const hasBlocks = (selectedPage?.content_blocks?.length ?? 0) > 0;

  const { isImmersive, exitImmersive } = useImmersive();

  // Parse rawJson so we can read footer_block even if parent stripped it on template prop
  const rawParsed = useMemo(() => {
    try { return rawJson ? JSON.parse(rawJson) : null; } catch { return null; }
  }, [rawJson]);

  // --- helpers: must be declared before useMemo that uses them ---
  const isBlockLike = (b: any, expectedType?: string) =>
    !!b &&
    typeof b === 'object' &&
    (typeof (b as any)._id === 'string' || typeof (b as any).id === 'string') &&
    typeof (b as any).type === 'string' &&
    (!expectedType || (b as any).type === expectedType);

  const pickFirstBlock = (candidates: any[], expectedType: 'header' | 'footer') => {
    for (const c of candidates) {
      if (isBlockLike(c, expectedType)) return c;
    }
    // Fallback: accept the first structurally valid block
    for (const c of candidates) {
      if (isBlockLike(c)) return c;
    }
    return null;
  };

  // Canonical pointers regardless of DB shape (snake/camel/data.* + rawParsed)
  const headerBlockCanon = useMemo(() => {
    const candidates = [
      (template as any)?.headerBlock,
      (template as any)?.header_block,
      template?.data?.headerBlock,
      template?.data?.header,
      rawParsed?.headerBlock,
      rawParsed?.header_block,
      rawParsed?.data?.headerBlock,
      rawParsed?.data?.header,
    ];
    return pickFirstBlock(candidates, 'header');
  }, [template, rawParsed]);

  const footerBlockCanon = useMemo(() => {
    const candidates = [
      (template as any)?.footerBlock,
      (template as any)?.footer_block,
      template?.data?.footerBlock,
      template?.data?.footer,
      rawParsed?.footerBlock,
      rawParsed?.footer_block,
      rawParsed?.data?.footerBlock,
      rawParsed?.data?.footer,
    ];
    return pickFirstBlock(candidates, 'footer');
  }, [template, rawParsed]);

  // Synthetic template that always exposes camelCase for downstream helpers
  const templateForEffective = useMemo(
    () => ({ ...template, headerBlock: headerBlockCanon, footerBlock: footerBlockCanon }),
    [template, headerBlockCanon, footerBlockCanon]
  );

  // const toggleSettings = () => setShowSettings(v => !v);

  const hasHeader = !!headerBlockCanon;
  const hasFooter = !!footerBlockCanon;

  const handleHeaderEdit = () => openGlobalEditor('header');
  const handleFooterEdit = () => openGlobalEditor('footer');

  const openGlobalEditor = (which: 'header' | 'footer') => {
    setGlobalEditing(which);
    const existing = which === 'header' ? headerBlockCanon : footerBlockCanon;
    setGlobalDraft(existing ?? (createDefaultBlock(which) as any));
  };

  const closeGlobalEditor = () => {
    setGlobalEditing(null);
    setGlobalDraft(null);
  };

  // Lock scroll when modal editing page blocks
  useEffect(() => {
    const root = document.documentElement;
    if (editing) root.classList.add('qs-modal-open');
    return () => root.classList.remove('qs-modal-open');
  }, [editing]);

  // Apply UI theme (does not persist)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedColorMode === 'dark');
  }, [resolvedColorMode]);

  // Sync ThemeContext with persisted color_mode when present
  useEffect(() => {
    const tMode = (template as any).color_mode as 'light' | 'dark' | undefined;
    if (tMode && ctxTheme?.darkMode !== tMode) setTheme({ ...(ctxTheme || {}), darkMode: tMode } as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(template as any).color_mode]);

  /** Normalize/mirror global header/footer across all shapes used in the stack. */
  function hoistGlobalBlocks<T extends Record<string, any>>(t: T): T {
    const next: any = { ...t };
    const d: any = { ...(next.data ?? {}) };

    // 1) Collect candidates from everywhere
    const header =
      next.headerBlock ?? next.header_block ?? d.headerBlock ?? d.header ?? null;
    const footer =
      next.footerBlock ?? next.footer_block ?? d.footerBlock ?? d.footer ?? null;

    // 2) Mirror to ALL expected locations
    // UI camelCase (helpers/components)
    next.headerBlock = header ?? null;
    next.footerBlock = footer ?? null;

    // DB columns snake_case
    next.header_block = header ?? null;
    next.footer_block = footer ?? null;

    // Sanitized client payload (what survives into JSON editor / rehydration)
    d.headerBlock = header ?? null;
    d.footerBlock = footer ?? null;

    // Optional legacy keys for broad compat (safe no-ops if unused)
    d.header = header ?? null;
    d.footer = footer ?? null;

    next.data = d;
    return next;
  }
/** Toggle the global settings panel (same as pressing `S`) */
const toggleGlobalSettings = () => {
  // If your app exposes a dedicated toggle, call it here.
  // Otherwise, synthesize the exact key event that opens the global panel.
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 's',
      code: 'KeyS',
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      shiftKey: false,
      bubbles: true,
    })
  );
};

  // Persist helper
  const updateAndSave = async (updatedRaw: Template, force = false) => {
    const normalizedRaw = hoistGlobalBlocks(updatedRaw);
    const prevHeader =
    (template as any).headerBlock ??
    (template as any).header_block ??
    template?.data?.headerBlock ??
    template?.data?.header ?? null;
  
  const prevFooter =
    (template as any).footerBlock ??
    (template as any).footer_block ??
    template?.data?.footerBlock ??
    template?.data?.footer ?? null;
  
  const nextHeader =
    (normalizedRaw as any).headerBlock ??
    (normalizedRaw as any).header_block ??
    normalizedRaw?.data?.headerBlock ??
    normalizedRaw?.data?.header ?? null;
  
  const nextFooter =
    (normalizedRaw as any).footerBlock ??
    (normalizedRaw as any).footer_block ??
    normalizedRaw?.data?.footerBlock ??
    normalizedRaw?.data?.footer ?? null;
  
  const headerChanged = JSON.stringify(prevHeader) !== JSON.stringify(nextHeader);
  const footerChanged = JSON.stringify(prevFooter) !== JSON.stringify(nextFooter);
  const mustForce = force || headerChanged || footerChanged;


    // Keep undo history
    undoStack.current.push(template);

    // Canonicalize pages, etc.
    const updated = withSyncedPages(normalizedRaw);

    // Reflect UI immediately
    onChange({ ...updated });
    setTemplate?.(updated);

    // Skip if nothing changed (unless forced/globals changed)
    const guard = saveGuardRef.current;
    if (!mustForce && !guard.hasChanged(updated)) return;

    try {
      const validId = updated.id && updated.id.trim() !== '' ? updated.id : undefined;
      if (!validId) throw new Error('Missing template ID');

      await guard.runCoalesced(async () => {
        await saveTemplate(updated, validId);
        guard.markSaved(updated);
      });

      redoStack.current = [];
    } catch (err) {
      console.error('❌ Failed to save template update', err);
    }
  };

  const handleUndo = () => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(template);
    onChange(withSyncedPages(prev));
    setTemplate?.(prev);
  };

  const handleRedo = () => {
    const nxt = redoStack.current.pop();
    if (!nxt) return;
    undoStack.current.push(template);
    onChange(withSyncedPages(nxt));
    setTemplate?.(nxt);
  };

  const toggleColorMode = async () => {
    const next = resolvedColorMode === 'dark' ? 'light' : 'dark';
    setTheme({ ...(ctxTheme || {}), darkMode: next } as any);
    const keepId = selectedPageId;
    await updateAndSave({ ...template, color_mode: next as 'light' | 'dark' }, true);
    if (keepId) setSelectedPageId(keepId);
  };
  const handleDuplicate = async () => {
    try {
      // persist any pending edits first
      await updateAndSave(template, true);
  
      setDupLoading(true);
      // also ping any global listeners you wired up on the list page
      window.dispatchEvent(new Event('templates:overlay:show'));
  
      const res = await fetch(`/api/templates/duplicate?slug=${encodeURIComponent((template as any).slug)}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Duplicate failed');
      }
  
      const json = await res.json();
      toast.success('Template duplicated!');
  
      // keep overlay up; component will unmount on navigation
      if (json?.slug) {
        router.push(`/template/${json.slug}/edit`);
        return;
      }
  
      // no nav? hide overlay and refresh
      setDupLoading(false);
      window.dispatchEvent(new Event('templates:overlay:hide'));
      router.refresh();
    } catch (e: any) {
      setDupLoading(false);
      window.dispatchEvent(new Event('templates:overlay:hide'));
      toast.error(e?.message || 'Duplicate failed');
    }
  };
  
  
  // --------------------------------
  // Header and Footer link-click capture handler
  // --------------------------------
// --- shared helpers ---
const normPath = (s: string) => {
  if (!s) return '/';
  let x = s.trim();
  try { x = new URL(x, window.location.origin).pathname; } catch {}
  // allow bare "blog" → "/blog"
  x = '/' + x.replace(/^\/*/, '').replace(/\/+$/, '');
  return x === '//' ? '/' : x;
};

const matchesPagePath = (p: any, path: string) => {
  const cands = new Set<string>([
    p?.slug ? `/${p.slug}` : '',
    p?.path ? normPath(p.path) : '',
    p?.url  ? normPath(p.url)  : '',
    p?.href ? normPath(p.href) : '',
  ].filter(Boolean));
  return cands.has(path);
};

const clickChipOrSelect = (pages: any[], idx: number, setSelectedPageId: (v: string|null)=>void) => {
  const key = (pages[idx]?.slug ?? pages[idx]?.path ?? pages[idx]?.url ?? 'home')
    .toString().replace(/^\//, '') || 'home';

  const chip = document.querySelector(
    `[data-editor-page="${key}"], [data-editor-page="/${key}"]`
  ) as HTMLElement | null;

  if (chip) chip.click();
  else setSelectedPageId(pages[idx]?.id ?? null);

  window.dispatchEvent(new CustomEvent('qs:page:select', { detail: { index: idx } }));
};

// convenience
const softSelectByHref = (pages: any[], href: string, setSelectedPageId: (v: string|null)=>void) => {
  const path = normPath(href);
  const idx = pages.findIndex((p) => matchesPagePath(p, path) || (path === '/' && (p?.is_home || p?.slug === 'home')));
  if (idx < 0) return false;
  clickChipOrSelect(pages, idx, setSelectedPageId);
  return true;
};

  const pageMatchesPath = (p: any, path: string) => {
    const set = new Set<string>([
      p?.slug ? `/${p.slug}` : '',
      p?.path ? normPath(p.path) : '',
      p?.url  ? normPath(p.url)  : '',
      p?.href ? normPath(p.href) : '',
    ].filter(Boolean));
    // treat "/" as "home" fallback
    if (path === '/') {
      if ((p?.is_home ?? false) || String(p?.slug ?? '').toLowerCase() === 'home') return true;
      // optionally: first page can be home
      // (this still allows explicit matches above to win)
    }
    return set.has(path);
  };

  const getHomeIndex = (pages: any[]) => {
    let i = pages.findIndex(p => p?.is_home);
    if (i >= 0) return i;
    i = pages.findIndex(p => String(p?.slug ?? '').toLowerCase() === 'home');
    if (i >= 0) return i;
    return 0; // fallback to first page
  };

  // --- header click-capture ---
  const onHeaderLinkClickCapture: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if ((e.target as HTMLElement)?.closest('[data-editor-action],[data-no-edit]')) return;

    const target = e.target as HTMLElement;

    // 1) detect LOGO clicks (even if there is no <a>)
    const headerContent = (effectiveHeader as any)?.content ?? {};
    const logoUrl: string | undefined = headerContent.logo_url;
    const logoEl =
      target.closest('[data-editor-logo],[data-header-logo],[data-site-logo]') ||
      target.closest('img[alt*="logo" i]') ||
      target.closest('svg[aria-label*="logo" i]') ||
      target.closest('img');

    if (logoEl) {
      // if we have a known logo url, try to confirm src match (loose)
      let isLogo = true;
      if (logoUrl && logoEl instanceof HTMLImageElement) {
        const src = (logoEl.currentSrc || logoEl.src || '').replace(/[?#].*$/, '');
        const norm = (s: string) => s.replace(/^https?:\/\/[^/]+/,'').replace(/[?#].*$/,'');
        const a = norm(src), b = norm(logoUrl);
        isLogo = !!a && !!b && (a === b || a.endsWith(b) || b.endsWith(a));
      }
      if (isLogo) {
        e.preventDefault();
        e.stopPropagation();
        const idx = getHomeIndex(pages);
        clickChipOrSelect(pages, idx, setSelectedPageId);
        window.dispatchEvent(new CustomEvent('qs:page:select', { detail: { index: idx } }));
        return;
      }
    }

    // 2) handle normal <a> clicks (soft-route)
    const a = target.closest('a') as HTMLAnchorElement | null;
    if (!a) return;

    const href = a.getAttribute('href') || '';
    if (!href || /^(mailto:|tel:|javascript:)/i.test(href) || href.startsWith('#')) return;

    const path = normPath(href);
    let idx = pages.findIndex((p) => pageMatchesPath(p, path));
    if (idx < 0 && path === '/') idx = getHomeIndex(pages);
    if (idx < 0) return;

    e.preventDefault();
    e.stopPropagation();
    clickChipOrSelect(pages, idx, setSelectedPageId);
    window.dispatchEvent(new CustomEvent('qs:page:select', { detail: { index: idx } }));
  };

  // --- footer click-capture ---
  const onFooterLinkClickCapture: React.MouseEventHandler<HTMLDivElement> = (e) => {
    // only unmodified left-clicks; ignore edit buttons
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if ((e.target as HTMLElement)?.closest('[data-editor-action],[data-no-edit]')) return;

    const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
    if (!a) return;

    const href = a.getAttribute('href') || '';
    // ignore external / mailto / tel / hash
    if (!href || /^(https?:\/\/|mailto:|tel:|javascript:)/i.test(href) || href.startsWith('#')) return;

    if (softSelectByHref(pages, href, setSelectedPageId)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  // --------------------------------

  // Scroll to last added block
  useEffect(() => {
    if (!lastInsertedId) return;
    const el = document.querySelector<HTMLElement>(`[data-block-id="${lastInsertedId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [lastInsertedId]);

  if (!selectedPage) {
    return (
      <div className="p-8 text-white text-center">
        <div className="text-lg font-semibold mb-2">No page found</div>
        <p className="text-sm text-white/70">The template has no pages defined yet. Add one to begin editing.</p>
      </div>
    );
  }

  const effectiveHeader = getEffectiveHeader(selectedPage, templateForEffective);
  const effectiveFooter = getEffectiveFooter(selectedPage, templateForEffective);

  // Measure header height to reserve space if it's sticky/fixed
  const headerWrapRef = useRef<HTMLDivElement | null>(null);
  const [headerOffset, setHeaderOffset] = useState(0);

  useEffect(() => {
    const el = headerWrapRef.current;
    if (!el) return;

    const measure = () => setHeaderOffset(el.getBoundingClientRect().height || 0);
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const onWin = () => measure();
    window.addEventListener('resize', onWin);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWin);
    };
  }, [selectedPage?.id, resolvedColorMode]);

  const setPageChrome = async (key: 'show_header' | 'show_footer', value: boolean) => {
    if (!selectedPage) return;
    const updatedPage = { ...selectedPage, [key]: value };
    const next = withSyncedPages({
      ...template,
      color_mode: resolvedColorMode,
      data: {
        ...(template.data ?? {}),
        pages: pages.map((p: any, idx: number) => (idx === selectedPageIndex ? updatedPage : p)),
      },
    } as Template);
    await updateAndSave(next);
  };

  const GRID_COLS = 'grid-cols-1';

  // Device max width
  const deviceFrame =
    device === 'mobile'
      ? 'max-w-[390px]'
      : device === 'tablet'
      ? 'max-w-[834px]'
      : 'max-w-[1200px]';

  return (
    <div className="relative isolate min-h-screen flex flex-col">
      <TemplateThemeWrapper
        template={template}
        onEditHeader={onEditHeader}
        showEditorChrome={showEditorChrome}
        mode={mode}
        renderHeader={false}
        renderFooter={false}
      >
      <button
        type="button"
        onClick={toggleGlobalSettings}
        title="Template / Site Settings (S)"
        aria-label="Open settings"
        className={clsx(
          'absolute top-2 left-2 sm:left-3 z-[60]',
          'h-8 w-8 rounded-full flex items-center justify-center',
          'border border-white/10 bg-zinc-900/85 hover:border-purple-500/50 hover:bg-zinc-800 shadow glow-purple-500/20'
        )}
        style={{ marginLeft: -12, marginTop: -10, zIndex: 1000 }}
      >
        <Settings2 className={clsx('h-4 w-4 transition-transform')} 
          style={{ strokeWidth: 1.5, color: 'white' }} />
      </button>

        {isImmersive && (
          <button
            onClick={exitImmersive}
            aria-label="Exit full screen"
            title="Exit full screen (Esc)"
            className="fixed top-3 left-3 z-[1000] rounded-full p-2
                       bg-black/60 border border-purple-500/60
                       shadow-[0_0_0_2px_rgba(168,85,247,.35),0_0_18px_2px_rgba(168,85,247,.35)]
                       hover:bg-black/70 transition"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        )}

        {/* editor layout */}
        <div
          className={clsx(
            'relative isolate grid w-full',
            // allow content to exceed and the center column to scroll
            'min-h-[calc(100vh-56px)]',
            GRID_COLS
          )}
        >

          {/* main editor */}
          <main className="relative z-[50] min-h-0 overflow-y-auto overscroll-contain">
            <div className={`relative z-[1] px-0 sm:px-2 xl:px-0 pb-28 pt-4 space-y-6 w-full mx-auto ${deviceFrame}`}>
              {/* Global Header/Footer card */}
              <CollapsiblePanel
                id="global-header-footer"
                title="Header and Footer, Logo and Favicon"
                defaultOpen={false}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-purple-500 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">Global Header and Footer</div>

                      <div className="text-xs text-zinc-300">Shown on pages unless hidden or overridden.</div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-xs uppercase tracking-wide text-white/60">{selectedPage?.title} Page Settings:</span>
                        </div>
                        <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setPageChrome('show_header', !(selectedPage?.show_header !== false))}
                          className={`px-2 py-1 text-xs rounded border transition ${
                            selectedPage?.show_header !== false
                              ? 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40 hover:bg-emerald-600/30'
                              : 'bg-zinc-800 text-zinc-300 border-zinc-600 hover:bg-zinc-700'
                          }`}
                        >
                          Header: {selectedPage?.show_header !== false ? 'Visible' : 'Hidden'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPageChrome('show_footer', !(selectedPage?.show_footer !== false))}
                          className={`px-2 py-1 text-xs rounded border transition ${
                            selectedPage?.show_footer !== false
                              ? 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40 hover:bg-emerald-600/30'
                              : 'bg-zinc-800 text-zinc-300 border-zinc-600 hover:bg-zinc-700'
                          }`}
                        >
                          Footer: {selectedPage?.show_footer !== false ? 'Visible' : 'Hidden'}
                        </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        data-editor-action="edit-header"
                        className="inline-flex items-center rounded-md px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white border border-purple-500/40"
                        onClick={() => openGlobalEditor('header')}
                      >
                        {hasHeader ? 'Edit Header' : 'Create Header'}
                      </button>
                      <button
                        data-editor-action="edit-footer"
                        className="inline-flex items-center rounded-md px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white border border-purple-500/40"
                        onClick={() => openGlobalEditor('footer')}
                      >
                        {hasFooter ? 'Edit Footer' : 'Create Footer'}
                      </button>
                    </div>
                  </div>
                </div>
              </CollapsiblePanel>

              <PageTabsBar
                pages={pages}
                selectedIndex={selectedPageIndex}
                template={template}
                onSelect={(i) => setSelectedPageId(pages[i]?.id ?? null)}
                onAdd={(newPage) => {
                  const ensured: Page = { ...newPage, id: newPage.id || crypto.randomUUID() };
                  const next = withSyncedPages({
                    ...template,
                    data: { ...(template.data ?? {}), pages: [...pages, ensured] },
                  } as Template);
                  updateAndSave(next);
                  setSelectedPageId(ensured.id);
                }}
                onRename={(index, title, incomingSlug) => {
                  let nextSlug = (incomingSlug && incomingSlug.trim()) || slugify(title);
                  const others = new Set(pages.map((p, i) => (i === index ? '' : p.slug)));
                  const base = nextSlug.replace(/-\d+$/, '');
                  let n = 2;
                  while (others.has(nextSlug)) nextSlug = `${base}-${n++}`;

                  const updated = pages.map((p, i) => (i === index ? { ...p, title, slug: nextSlug } : p));
                  const next = withSyncedPages({
                    ...template,
                    data: { ...(template.data ?? {}), pages: updated },
                  } as Template);
                  updateAndSave(next);
                  setSelectedPageId(updated[index]?.id ?? null);
                }}
                onDelete={(index) => {
                  if (pages.length <= 1) {
                    alert('You must keep at least one page.');
                    return;
                  }
                  const updated = pages.filter((_, i) => i !== index);
                  const next = withSyncedPages({
                    ...template,
                    data: { ...(template.data ?? {}), pages: updated },
                  } as Template);
                  updateAndSave(next);
                  const newIdx = Math.min(updated.length - 1, Math.max(0, index - 1));
                  setSelectedPageId(updated[newIdx]?.id ?? null);
                }}
                onReorder={(oldIndex, newIndex) => {
                  if (oldIndex === newIndex) return;
                  const copy = [...pages];
                  const [moved] = copy.splice(oldIndex, 1);
                  copy.splice(newIndex, 0, moved);
                  const next = withSyncedPages({
                    ...template,
                    data: { ...(template.data ?? {}), pages: copy },
                  } as Template);
                  updateAndSave(next);
                  setSelectedPageId(moved.id);
                }}
              />

              {/* Header (only in-canvas; hover-edit) */}
              {effectiveHeader && (
                <div ref={headerWrapRef} className="group relative" onClickCapture={onHeaderLinkClickCapture}>
                  <RenderBlock block={effectiveHeader} showDebug={false} colorMode={resolvedColorMode} template={template} />
                  <button
                    type="button"
                    onClick={handleHeaderEdit}
                    className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100
                               transition-opacity rounded-md border border-white/10 bg-black/70
                               px-2 py-1 text-xs text-white shadow hover:bg-black/80"
                    title="Edit Header"
                    aria-label="Edit Header"
                    data-editor-action="edit-header"
                  >
                    Edit Header
                  </button>
                </div>
              )}
              {headerOffset > 0 && <div style={{ height: headerOffset }} />}

              {/* Blocks */}
              <div className={`w-full mx-auto ${deviceFrame}`}>
                {debugMode && Array.isArray(selectedPage?.content_blocks) && (
                  <div className="text-xs text-emerald-300/70">
                    [debug] blocks on this page: {selectedPage.content_blocks.length}
                  </div>
                )}
                <BlocksList
                  key={selectedPage.id}
                  template={template}
                  colorMode={resolvedColorMode}
                  pages={pages}
                  selectedPage={selectedPage}
                  selectedPageIndex={selectedPageIndex}
                  showOutlines={showOutlines}
                  onUpdateAndSave={updateAndSave}
                  onEditBlock={setEditing}
                  setLastInsertedId={(id) => setLastInsertedId(id)}
                />
              </div>

              {/* Empty page helper */}
              {!hasBlocks && (
                <EmptyAddBlock
                  existingBlocks={selectedPage.content_blocks}
                  onAdd={(type) => {
                    const newBlock = createDefaultBlock(type as any);
                    const updatedPage = {
                      ...selectedPage,
                      content_blocks: [...(selectedPage?.content_blocks ?? []), newBlock as any],
                    };
                    setLastInsertedId((newBlock as any)._id ?? '');
                    setEditing(newBlock as any);
                    const next = withSyncedPages({
                      ...template,
                      data: {
                        ...(template.data ?? {}),
                        pages: pages.map((p: any, idx: number) => (idx === selectedPageIndex ? updatedPage : p)),
                      },
                    } as Template);
                    updateAndSave(next);
                  }}
                  template={template as unknown as Template}
                />
              )}

              {/* Footer (in-canvas; hover-edit) */}
              {effectiveFooter && (
                <div className="group relative mt-6 mb-16" onClickCapture={onFooterLinkClickCapture}>
                  <RenderBlock block={effectiveFooter} showDebug={false} colorMode={resolvedColorMode} template={template}/>
                  <button
                    type="button"
                    onClick={handleFooterEdit}
                    className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100
                               transition-opacity rounded-md border border-white/10 bg-black/70
                               px-2 py-1 text-xs text-white shadow hover:bg-black/80"
                    title="Edit Footer"
                    aria-label="Edit Footer"
                    data-editor-action="edit-footer"
                  >
                    Edit Footer
                  </button>
                </div>
              )}

            </div>
          </main>
        </div>

        {/* Bottom toolbar */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1300]">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/90 px-3 py-2 shadow-xl backdrop-blur">
            {/* Theme toggle */}
            <button
              onClick={toggleColorMode}
              className="p-2 rounded-md border border-zinc-700 bg-zinc-800/70 hover:bg-zinc-800 text-zinc-100"
              title={resolvedColorMode === 'dark' ? 'Switch to light' : 'Switch to dark'}
              aria-label="Toggle color mode"
            >
              {resolvedColorMode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            {/* Device selectors */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDevice('mobile')}
                className={clsx(
                  'p-2 rounded-md border',
                  device === 'mobile'
                    ? 'border-purple-500/50 bg-purple-600/20 text-purple-100'
                    : 'border-zinc-700 bg-zinc-800/70 text-zinc-200 hover:bg-zinc-800'
                )}
                title="Mobile"
                aria-label="Mobile preview"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>
              </button>
              <button
                onClick={() => setDevice('tablet')}
                className={clsx(
                  'p-2 rounded-md border',
                  device === 'tablet'
                    ? 'border-purple-500/50 bg-purple-600/20 text-purple-100'
                    : 'border-zinc-700 bg-zinc-800/70 text-zinc-200 hover:bg-zinc-800'
                )}
                title="Tablet"
                aria-label="Tablet preview"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="2" width="18" height="20" rx="2"/><path d="M14 22H10"/></svg>
              </button>
              <button
                onClick={() => setDevice('desktop')}
                className={clsx(
                  'p-2 rounded-md border',
                  device === 'desktop'
                    ? 'border-purple-500/50 bg-purple-600/20 text-purple-100'
                    : 'border-zinc-700 bg-zinc-800/70 text-zinc-200 hover:bg-zinc-800'
                )}
                title="Desktop"
                aria-label="Desktop preview"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>
              </button>
            </div>

            <div className="w-px h-5 bg-white/10 mx-1" />

            {/* Undo/Redo/Save/Duplicate */}
            <button
              className="px-2 py-1 text-xs rounded border border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              onClick={handleUndo}
              title="Undo"
            >
              Undo
            </button>
            <button
              className="px-2 py-1 text-xs rounded border border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              onClick={handleRedo}
              title="Redo"
            >
              Redo
            </button>
            <button
              className="px-3 py-1 text-xs rounded border border-emerald-600 bg-emerald-600/20 text-emerald-200 hover:bg-emerald-600/30"
              onClick={() => updateAndSave(template, true)}
              title="Save"
            >
              Save
            </button>
            <button
              onClick={handleDuplicate}
              disabled={dupLoading}
              className={clsx(
                'px-3 py-1 text-xs rounded border flex items-center gap-1',
                'border-purple-500 bg-purple-600/20 text-purple-100 hover:bg-purple-600/30',
                'disabled:opacity-60 disabled:cursor-not-allowed'
              )}
              title="Duplicate this site/template"
            >
              <Copy size={14} />
              Duplicate
            </button>
          </div>
        </div>

        {/* Per-block editor modal */}
        {editing && (
          <Portal>
            <div
              className={[
                resolvedColorMode === 'dark' ? 'dark' : '',
                'fixed inset-0 z-[1200] bg-black/90 p-6 overflow-auto flex items-center justify-center',
              ].join(' ')}
            >
              <div className="w-full max-w-4xl bg-neutral-900 border border-white/10 rounded-xl shadow-xl overflow-hidden">
                <DynamicBlockEditor
                  block={editing}
                  onSave={(updatedBlock: any) => {
                    const updatedPage = {
                      ...selectedPage,
                      content_blocks: (selectedPage?.content_blocks ?? []).map((b: any) =>
                        b._id === updatedBlock._id ? updatedBlock : b
                      ),
                    };
                    const next = withSyncedPages({
                      ...template,
                      data: {
                        ...(template.data ?? {}),
                        pages: pages.map((p: any, idx: number) =>
                          idx === selectedPageIndex ? updatedPage : p
                        ),
                      },
                    } as Template);
                    updateAndSave(next);
                    setEditing(null);
                  }}
                  onClose={() => setEditing(null)}
                  errors={errors}
                  template={template}
                />
              </div>
            </div>
          </Portal>
        )}

        {/* Global header/footer editor modal */}
        {globalEditing && globalDraft && (
          <Portal>
            <div className="fixed inset-0 bg-black/90 z-[1200] p-6 overflow-auto flex items-center justify-center">
              <div className="w-full max-w-4xl bg-neutral-900 border border-white/10 rounded-xl shadow-xl overflow-hidden">
                <DynamicBlockEditor
                  block={globalDraft}
                  template={template}
                  errors={{}}
                  colorMode={resolvedColorMode}
                  onSave={async (updated: any) => {
                    const next: Template =
                      globalEditing === 'header'
                        ? { ...template, headerBlock: updated as any }
                        : { ...template, footerBlock: updated as any };
                    await updateAndSave(next, true);
                    closeGlobalEditor();
                  }}
                  onClose={closeGlobalEditor}
                />
              </div>
            </div>
          </Portal>
        )}
        {dupLoading && (
          <Portal>
            <div
              role="status"
              aria-busy="true"
              className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center"
            >
              <img src="/logo_v1.png" alt="" className="h-12 w-auto opacity-95 animate-pulse" />
              <div className="mt-3 h-8 w-8 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              <div className="mt-2 text-white/80 text-sm">Duplicating…</div>
            </div>
          </Portal>
        )}
      </TemplateThemeWrapper>
    </div>
  );
}
