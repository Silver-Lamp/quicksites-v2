'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  RotateCcw, RotateCw, AlertTriangle, X, Maximize2, Minimize2,
  Smartphone, Tablet, Monitor, Sun, Moon, SlidersHorizontal, Check,
  Settings as SettingsIcon, Trash2, Database,
} from 'lucide-react';
import { Button } from '@/components/ui';
import toast from 'react-hot-toast';

import type { Template } from '@/types/template';
import { validateTemplateAndFix } from '@/admin/lib/validateTemplate';
import type { ValidateResult, Warning } from '@/admin/lib/validateTemplate';
import { saveAsTemplate } from '@/admin/lib/saveAsTemplate';
import { createSharedPreview } from '@/admin/lib/createSharedPreview';

import AsyncGifOverlay from '@/components/ui/async-gif-overlay';
import VersionsDropdown from '@/components/admin/templates/versions-dropdown';
import { useTemplateVersions } from '@/hooks/useTemplateVersions';
import { templateSig } from '@/lib/editor/saveGuard';
import { buildSharedSnapshotPayload } from '@/lib/editor/templateUtils';
import { loadVersionRow } from '@/admin/lib/templateSnapshots';
import PageManagerToolbar from '@/components/admin/templates/page-manager-toolbar';
import { useTemplateRef } from '@/hooks/usePersistTemplate';
import { useCommitApi } from './hooks/useCommitApi';
import { resolveIndustryKey } from '@/lib/industries';

import {
  dispatchTemplateCacheInvalidate,
  dispatchTemplateCacheUpdate,
  readTemplateCache,
  type TemplateCacheRow,
} from '@/lib/templateCache';
import { heroLog, heroDbgOn, pickHeroSnapshots } from '@/lib/debug/hero';


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

function normalizePageBlocksShape(pages: any[]): any[] {
  const isStr = (v: any) => typeof v === 'string' && v.trim().length > 0;

  const getCanon = (b: any) => ({
    heading: b?.props?.heading ?? b?.content?.headline ?? '',
    subheading: b?.props?.subheading ?? b?.content?.subheadline ?? '',
    cta: b?.props?.ctaLabel ?? b?.content?.cta_text ?? '',
  });

  const isDefaultHeading = (s: string) =>
    !isStr(s) || /^welcome to your new site$/i.test(s.trim());

  const heroScore = (b: any) => {
    if (!b || b.type !== 'hero') return 0;
    const c = getCanon(b);
    let s = 0;
    if (!isDefaultHeading(c.heading)) s += 3;
    if (isStr(c.subheading)) s += 1;
    if (isStr(c.cta)) s += 1;
    // prefer blocks that already carry both shapes
    if (b?.props && b?.content) s += 1;
    return s;
  };

  // Ensure both props/content carry same canonical values
  const unifyHero = (b: any) => {
    if (!b || b.type !== 'hero') return b;
    const out: any = { ...b, props: { ...(b.props ?? {}) }, content: { ...(b.content ?? {}) } };

    const heading     = out.props.heading     ?? out.content.headline;
    const subheading  = out.props.subheading  ?? out.content.subheadline;
    const ctaLabel    = out.props.ctaLabel    ?? out.content.cta_text;

    // derive ctaHref from content.* when needed
    let ctaHref = out.props.ctaHref;
    if (!ctaHref) {
      const act = out.content.cta_action ?? 'go_to_page';
      if (act === 'go_to_page') ctaHref = out.content.cta_link || '/contact';
      else if (act === 'jump_to_contact') ctaHref = `#${String(out.content.contact_anchor_id || 'contact').replace(/^#/, '')}`;
      else if (act === 'call_phone') ctaHref = `tel:${(out.content.cta_phone || '').replace(/\D/g, '')}`;
      else ctaHref = '/contact';
    }

    const heroImage   = out.props.heroImage   ?? out.content.image_url;
    const blur        = (typeof out.props.blur_amount === 'number' ? out.props.blur_amount : out.content.blur_amount) ?? 0;
    const pos         = out.props.image_position ?? out.content.image_position ?? 'center';
    const layout      = out.props.layout_mode ?? out.content.layout_mode ?? 'inline';

    out.props = {
      ...out.props,
      heading, subheading, ctaLabel, ctaHref,
      heroImage,
      blur_amount: blur,
      image_position: pos,
      layout_mode: layout,
    };

    out.content = {
      ...out.content,
      headline: heading,
      subheadline: subheading,
      cta_text: ctaLabel,
      // keep whatever action fields were present (we won't invent them here)
      image_url: heroImage,
      blur_amount: blur,
      image_position: pos,
      layout_mode: layout,
    };

    return out;
  };

  // choose "winner" between two variants of the same block
  const chooseById = (a: any, b: any) => {
    if (!a) return b;
    if (!b) return a;
    if (a.type === 'hero' || b.type === 'hero') {
      const sa = heroScore(a), sb = heroScore(b);
      if (sa !== sb) return sa > sb ? a : b;
    }
    return b; // later source wins by default
  };

  return (pages || []).map((p: any) => {
    // Gather all shapes
    const all: any[] = [
      ...(Array.isArray(p?.blocks) ? p.blocks : []),
      ...(Array.isArray(p?.content_blocks) ? p.content_blocks : []),
      ...(Array.isArray(p?.content?.blocks) ? p.content.blocks : []),
    ];
    if (all.length === 0) return p;

    // 1) Collapse non-hero by ID
    const byId = new Map<string, any>();
    for (const b of all) {
      if (!b) continue;
      const id = String(b?._id ?? b?.id ?? '');
      if (!id) continue;
      const cur = byId.get(id);
      byId.set(id, chooseById(cur, b));
    }
    let keep: any[] = Array.from(byId.values());

    // 2) Collapse hero across *different IDs*: keep only the best single hero
    const heroIdxs: number[] = [];
    let heroWinner: any = null;
    let bestScore = -1;
    let earliest = Infinity;
    all.forEach((b, idx) => {
      if (b?.type === 'hero') {
        heroIdxs.push(idx);
        const s = heroScore(b);
        if (s > bestScore) { bestScore = s; heroWinner = b; }
        if (idx < earliest) earliest = idx;
      }
    });

    if (heroWinner) {
      // Remove all existing heros from 'keep'
      keep = keep.filter((b) => b?.type !== 'hero');
      // Put unified winner back at the earliest hero position (best approximation)
      const unifiedHero = unifyHero(heroWinner);
      const insertAt = Math.min(earliest, keep.length);
      keep.splice(insertAt, 0, unifiedHero);
    }

    // 3) Unify canonical fields for any hero left (guards against missed paths)
    keep = keep.map((b) => (b?.type === 'hero' ? unifyHero(b) : b));

    // 4) Mirror to all shapes
    const next: any = { ...p };
    next.blocks = keep;
    if (Array.isArray(p?.content_blocks)) next.content_blocks = keep;
    if (p?.content && typeof p.content === 'object') next.content = { ...p.content, blocks: keep };
    return next;
  });
}


/* ---------- debounced helper ---------- */
function useDebounced<T extends (...args: any[]) => void>(fn: T, delay = 350) {
  const tRef = useRef<any>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((...args: Parameters<T>) => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

// --- helper: conflict-tolerant commit (one-shot rebase) ---
async function commitWithRebase({
  id,
  baseRev,
  patch,
  kind = 'save' as 'save' | 'autosave',
}: {
  id: string;
  baseRev: number;
  patch: Record<string, any>;
  kind?: 'save' | 'autosave';
}) {
  const send = async (rev: number) => {
    const res = await fetch('/api/templates/commit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, baseRev: rev, patch, kind }),
    });
    if (res.status === 409) {
      const j = await res.json().catch(() => ({}));
      const latest = typeof j?.rev === 'number' ? j.rev : rev;
      return { conflict: true as const, latest };
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j?.error || `commit failed (${res.status})`);
    }
    return { conflict: false as const, json: await res.json() };
  };

  let first = await send(baseRev);
  if (first.conflict) {
    const second = await send(first.latest);
    if ('json' in second) return second.json;
    throw new Error('commit rebase failed');
  }
  return (first as any).json;
}

/* ---------- component ---------- */
type SaveWarning = { field: string; message: string };

type Props = {
  template: Template;
  autosaveStatus?: string;
  onSaveDraft?: (maybeSanitized?: Template) => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenPageSettings?: () => void;
  onApplyTemplate: (next: Template) => void; // parent suppresses re-broadcasts
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

  const [hist, setHist] = useState<{ past: number; future: number }>({ past: 0, future: 0 });

  const [settingsOpenState, setSettingsOpenState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return (window.localStorage.getItem('qs:settingsOpen') ?? '0') !== '0'; } catch { return false; }
  });
  useEffect(() => {
    const sync = (e: Event) => setSettingsOpenState(!!(e as CustomEvent).detail);
    window.addEventListener('qs:settings:set-open', sync as any);
    return () => window.removeEventListener('qs:settings:set-open', sync as any);
  }, []);

  const [toolbarEnabled, setToolbarEnabled] = useState(true);
  useEffect(() => {
    const onToggle = (e: Event) => setToolbarEnabled(!!(e as CustomEvent).detail);
    window.addEventListener('qs:toolbar:set-enabled', onToggle as any);
    return () => window.removeEventListener('qs:toolbar:set-enabled', onToggle as any);
  }, []);

  const tplRef = useTemplateRef(template);

  // Track LAST PERSISTED signature (logical dirty)
  const savedSigRef = useRef<string>('');
  useEffect(() => { savedSigRef.current = templateSig(template); }, []); // initial mount
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setDirty(templateSig(template) !== savedSigRef.current); }, [template]);

  // New commit API (full patch support)
  const { pending, commitPatch, commitPatchSoon, loadRev } = useCommitApi((template as any)?.id);

  // keyboard save
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

  // undo/redo keyboard (unchanged)
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
  }, []); // eslint-disable-line

  useEffect(() => {
    const onStats = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      setHist({ past: Number(d.past ?? 0), future: Number(d.future ?? 0) });
    };
    window.addEventListener('qs:history:stats', onStats as any);
    window.dispatchEvent(new CustomEvent('qs:history:request-stats'));
    return () => window.removeEventListener('qs:history:stats', onStats as any);
  }, []);

  // apply helper (parent handles suppression)
  const apply = (next: Template) => {
    onApplyTemplate(next);
    onSetRawJson?.(pretty(next));
  };

  // portal
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
  }, []); // eslint-disable-line

  const setViewportAndEmit = (v: 'mobile'|'tablet'|'desktop') => {
    setViewport(v);
    try { localStorage.setItem('qs:preview:viewport', v); } catch {}
    window.dispatchEvent(new CustomEvent('qs:preview:set-viewport', { detail: v }));
  };

  /* ---------- Patch bus → apply + autosave ---------- */
  useEffect(() => {
    const onPatch = (e: Event) => {
      const patch = (e as CustomEvent).detail || {};
      if (!patch || typeof patch !== 'object') return;

      const cur: any = tplRef.current;
      const next: any = { ...cur };

      // 1) merge top-level keys (industry, headerBlock/footerBlock, color_mode, etc.)
      if (patch && typeof patch === 'object') {
        for (const k of Object.keys(patch)) {
          if (k === 'data') continue;
          next[k] = (patch as any)[k];
        }
      }

      // 2) shallow-merge data, then normalize block array shapes per page
      // new: merge then normalize per-page block arrays
      if (patch.data && typeof patch.data === 'object') {
        const merged = { ...(cur?.data ?? {}), ...(patch.data as any) };
        const pages = Array.isArray(merged.pages) ? merged.pages : [];
        const normalizedPages = normalizePageBlocksShape(pages);
        next.data = { ...merged, pages: normalizedPages };
        if (heroDbgOn()) {
          heroLog('onPatch → incoming hero snapshots', pickHeroSnapshots(patch?.data));
          heroLog('onPatch → outgoing (normalized) hero snapshots', pickHeroSnapshots(next?.data));
        }
      }

      apply(next);
      if (heroDbgOn()) {
        heroLog('commitPatchSoon payload hero snapshots', pickHeroSnapshots({ pages: next.data?.pages }));
      }      
      if (localStorage.getItem('qs:debug:hero') === '1') {
        const snap = (data: any) => {
          const pages = Array.isArray(data?.pages) ? data.pages : [];
          const heroes = pages.flatMap((pg: any, i: number) =>
            (pg?.blocks || []).filter((b: any) => b?.type === 'hero').map((b: any) => ({
              pageIndex: i,
              id: b?._id ?? b?.id,
              heading: b?.props?.heading,
              subheading: b?.props?.subheading,
              ctaLabel: b?.props?.ctaLabel,
            }))
          );
          console.log('%cQS/HERO%c commitPatchSoon (autosave) heroes', 'background:#7c3aed;color:#fff;padding:2px 6px;border-radius:4px;', 'color:#e5e7eb;', heroes);
        };
        snap({ pages: next.data?.pages });
      }
      if (heroDbgOn()) {
        heroLog('commitPatchSoon payload hero snapshots', pickHeroSnapshots({ pages: next.data?.pages }));
      }
            
      try { commitPatchSoon({ ...patch, data: next.data }); } catch {}
    };

    window.addEventListener('qs:template:apply-patch', onPatch as any);
    return () => window.removeEventListener('qs:template:apply-patch', onPatch as any);
  }, [apply, commitPatchSoon, tplRef]);

  // Settings sidebar control
  const emitSettingsOpen = (open: boolean) => {
    window.dispatchEvent(new CustomEvent('qs:settings:set-open', { detail: open }));
    try { window.localStorage.setItem('qs:settingsOpen', open ? '1' : '0'); } catch {}
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

    // persist top-level color_mode + data
    try { commitPatchSoon({ color_mode: nextMode, data: (next as any).data }); } catch {}

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
    setSettingsOpenFlag(false);
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

  // versions feed — pass an object so the hook can prefer canonical_id
  const tplAny: any = template;
  const versionsKey = useMemo(
    () => ({
      id: tplAny?.id ?? null,
      canonical_id: (tplAny as any)?.canonical_id ?? null,
      slug: baseSlug(tplAny?.slug) || template.template_name || null,
    }),
    [tplAny?.id, (tplAny as any)?.canonical_id, tplAny?.slug, template.template_name]
  );

  const { versions, reloadVersions, publishedVersionId } =
    useTemplateVersions(versionsKey, tplAny?.id ?? null);

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

  /* ---------- Save (commit) ---------- */
  const handleSaveClick = async () => {
    try {
      const src = tplRef.current as any;

      // Validate without stripping fields; keep as close to UI state as possible.
      const check: ValidateResult = validateTemplateAndFix
        ? validateTemplateAndFix(src)
        : { valid: true, data: src as any, warnings: [] as Warning[] };

      if (!check.valid) {
        console.error('[validateTemplateAndFix] failed:', check.errors);
        toast.error('Validation failed — see console for details.');
        return;
      }

      // Start from the validated template (or the raw src)
      const nextTemplate = (check.data ?? src) as Template;

      // Ensure pages are present in both places (defensive parity)
      const srcPages = getTemplatePagesLoose(src);
      const outPages = getTemplatePagesLoose(nextTemplate);
      if (!Array.isArray(outPages) || !outPages.length) {
        (nextTemplate as any).data = { ...(nextTemplate as any).data, pages: srcPages };
        (nextTemplate as any).pages = srcPages;
      } else {
        (nextTemplate as any).data = { ...(nextTemplate as any).data, pages: outPages };
        if (!Array.isArray((nextTemplate as any).pages) || !(nextTemplate as any).pages.length) {
          (nextTemplate as any).pages = outPages;
        }
      }

      // 👉 NEW: keep all block array shapes in sync per page (blocks/content_blocks/content.blocks)
      const normalizedPages = normalizePageBlocksShape(getTemplatePagesLoose(nextTemplate));
      (nextTemplate as any).data = { ...(nextTemplate as any).data, pages: normalizedPages };
      (nextTemplate as any).pages = normalizedPages;

      // Canonicalize industry/services in the DATA tree so they persist even if blocks-only changed
      const dataIn = ((nextTemplate as any).data ?? {}) as any;
      const metaIn = (dataIn.meta ?? {}) as any;

      const canonicalIndustryKey = resolveIndustryKey(
        metaIn.industry ?? (nextTemplate as any).industry ?? 'other'
      );

      // Prefer a top-level data.services array; mirror into meta to satisfy older readers
      const canonicalServices =
        Array.isArray(dataIn.services) ? dataIn.services :
        Array.isArray(metaIn.services) ? metaIn.services :
        Array.isArray((nextTemplate as any).services) ? (nextTemplate as any).services :
        [];

      const canonicalData = {
        ...dataIn,
        meta: {
          ...metaIn,
          industry: canonicalIndustryKey,
          services: canonicalServices,
        },
        services: canonicalServices,
        pages: normalizedPages, // ← use the normalized pages
      };

      const nextSig = templateSig({ ...(nextTemplate as any), data: canonicalData });
      if (nextSig === savedSigRef.current) {
        toast('No changes to save');
        setDirty(false);
        return;
      }

      if (check.warnings?.length) {
        setSaveWarnings(check.warnings);
        check.warnings.forEach((w) =>
          toast((t) => <span className="text-yellow-500">⚠️ {w.message}</span>)
        );
      } else {
        setSaveWarnings([]);
      }

      onSaveDraft?.({ ...(nextTemplate as any), data: canonicalData });
      onSetRawJson?.(pretty({ ...(nextTemplate as any), data: canonicalData }));

      // (Optional) refresh local rev tracking if you keep one
      await loadRev?.();

      // Build a FULL data overlay patch (idempotent) + legacy mirrors
      const patch = {
        data: canonicalData,
        color_mode: (nextTemplate as any).color_mode,
        // legacy mirrors for any old readers still looking at top-level
        industry: canonicalIndustryKey,
        services: canonicalServices,
      };
      if (heroDbgOn()) {
        heroLog('HANDLE SAVE → canonical hero snapshots', pickHeroSnapshots(canonicalData));
      }
      
    const maybeRev =
      Number.isFinite((src as any)?.rev) ? (src as any).rev :
      Number.isFinite((nextTemplate as any)?.rev) ? (nextTemplate as any).rev :
      undefined;
      
    // Commit with a one-shot rebase on 409
    const commitRes = await commitWithRebase({
      id: (nextTemplate as any).id,
      baseRev: (maybeRev as number) ?? (NaN as any), // API will infer if NaN/undefined
      patch,
      kind: 'save',
    });

      savedSigRef.current = nextSig;
      setDirty(false);

      try { dispatchTemplateCacheUpdate(toCacheRow({ ...(nextTemplate as any), data: canonicalData })); } catch {}
      toast.success('Saved!');

      // First-save canonical id bounce (unchanged)
      const canonicalId: string | undefined =
        commitRes?.canonicalId ?? commitRes?.canonical_id ?? undefined;

      if (canonicalId && !(tplRef.current as any)?.canonical_id) {
        const patched: Template = {
          ...(tplRef.current as any),
          canonical_id: canonicalId,
          data: canonicalData,
        };
        apply(patched);
        try { dispatchTemplateCacheUpdate(toCacheRow(patched)); } catch {}

        savedSigRef.current = templateSig(patched);
        setDirty(false);

        try {
          if (
            typeof window !== 'undefined' &&
            window.location.pathname.startsWith('/admin/templates/new')
          ) {
            router.replace(`/template/${canonicalId}/edit`);
          }
        } catch {}
      }
    } catch (err) {
      console.error('❌ Save/commit crashed:', err);
      toast.error('Save failed — see console.');
    }
  };

  // run a full save when a block editor asks for it
  useEffect(() => {
    const onSaveNow = () => { void handleSaveClick(); };
    window.addEventListener('qs:toolbar:save-now', onSaveNow as any);
    return () => window.removeEventListener('qs:toolbar:save-now', onSaveNow as any);
  }, [handleSaveClick]);
  
  function heroDbgOn() {
    try { return localStorage.getItem('qs:debug:hero') === '1'; } catch { return false; }
  }
  function heroLog(label: string, obj?: any) {
    if (!heroDbgOn()) return;
    console.log('%cQS/HERO%c ' + label,
      'background:#7c3aed;color:#fff;padding:2px 6px;border-radius:4px;',
      'color:#e5e7eb;', obj ?? '');
  }
  function pickHeroSnapshots(data: any) {
    const pages: any[] = Array.isArray(data?.pages) ? data.pages : [];
    const out: any[] = [];
    pages.forEach((p, i) => {
      const combos = [
        ...(Array.isArray(p?.blocks) ? p.blocks : []),
        ...(Array.isArray(p?.content_blocks) ? p.content_blocks : []),
        ...(Array.isArray(p?.content?.blocks) ? p.content.blocks : []),
      ];
      combos.filter((b: any) => b?.type === 'hero').forEach((b: any) => {
        const props = b?.props ?? {};
        const content = b?.content ?? {};
        out.push({
          pageIndex: i,
          id: b?._id ?? b?.id,
          industry: b?.industry,
          props: {
            heading: props?.heading, subheading: props?.subheading,
            ctaLabel: props?.ctaLabel, ctaHref: props?.ctaHref,
            heroImage: props?.heroImage
          },
          content: {
            headline: content?.headline, subheadline: content?.subheadline,
            cta_text: content?.cta_text, image_url: content?.image_url
          }
        });
      });
    });
    return out;
  }
  
  /* ---------- Snapshot (server-built) ---------- */
  async function onCreateSnapshot() {
    try {
      const url = `/api/admin/snapshots/create?templateId=${(template as any).id}`;
      const res = await fetch(url, { method: 'GET' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Snapshot failed');
      toast.success('Snapshot created');
      window.dispatchEvent(new CustomEvent('qs:truth:refresh'));
      await reloadVersions();
      return json?.snapshotId as string | undefined;
    } catch (e) {
      console.error('[Snapshot] failed', e);
      toast.error('Failed to create snapshot');
      return undefined;
    }
  }

  /* ---------- Restore (write to draft) ---------- */
  const onRestore = async (id: string) => {
    const trace = `restore:${id}:${Date.now()}`;
    console.time(`QSITES[versions] restore time ${trace}`);
    try {
      const data = await loadVersionRow(id);
      if (!confirm('Restore this version? This will overwrite the current draft.')) return;

      const payload = (() => {
        try {
          return typeof (data as any).data === 'string'
            ? JSON.parse((data as any).data)
            : (data as any).data ?? {};
        } catch {
          return (data as any).data ?? {};
        }
      })();

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
          <span>Restored with warnings — {blockErrs.length} invalid block{blockErrs.length === 1 ? '' : 's'} (see console).</span>
        ));
      }

      const restored: Template = {
        ...tplRef.current,
        ...(data.header_block ? { headerBlock: data.header_block } : {}),
        ...(data.footer_block ? { footerBlock: data.footer_block } : {}),
        data: payload,
        color_mode: (data as any).color_mode ?? (tplRef.current as any).color_mode,
      };

      onSaveDraft?.(restored);
      onSetRawJson?.(pretty(restored));
      await loadRev();
      await commitPatch({ data: (restored as any).data, color_mode: restored.color_mode }, 'save');

      savedSigRef.current = templateSig(restored);
      setDirty(false);

      try { dispatchTemplateCacheUpdate(toCacheRow(restored)); } catch {}
      toast.success('Version restored!');
      window.dispatchEvent(new CustomEvent('qs:truth:refresh'));
    } catch (e: any) {
      console.error('QSITES[versions] restore failed', { trace, message: e?.message, stack: e?.stack });
      toast.error(`Failed to load version: ${e?.message || 'Unknown error'}`);
    } finally {
      console.timeEnd(`QSITES[versions] restore time ${trace}`);
    }
  };

  /* ---------- Publish (via snapshot) ---------- */
  const onPublish = async (snapshotId?: string) => {
    try {
      let sid = snapshotId;
      if (!sid) {
        await handleSaveClick();
        sid = await onCreateSnapshot();
      }
      if (!sid) throw new Error('No snapshot to publish');

      const url = `/api/admin/sites/publish?templateId=${(template as any).id}&snapshotId=${sid}`;
      const res = await fetch(url, { method: 'GET' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Publish failed');

      await reloadVersions();
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

  // Undo/Redo handlers
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

  // Dev cache helpers
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

  if (!mounted) return null;

  const currentSlug =
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('page')) ||
    getTemplatePagesLoose(template)[0]?.slug ||
    'home';

  return createPortal(
    <>
      <div
        id="template-action-toolbar"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[2147483647] w-[95%] max-w-5xl rounded-2xl border border-zinc-700 bg-zinc-900/95 backdrop-blur px-4 sm:px-6 py-3 shadow-lg text-zinc-100 hover:border-purple-500 opacity-90 hover:opacity-100 transition pointer-events-auto"
        style={{ WebkitTapHighlightColor: 'transparent', pointerEvents: toolbarEnabled ? 'auto' : 'none' }}
      >
        <div className="w-full flex justify-between items-center gap-3">
          {/* Settings */}
          <Button size="icon" variant={settingsOpenState ? 'secondary' : 'ghost'} title="Template Settings Sidebar" aria-pressed={settingsOpenState} onClick={toggleTemplateSettings}>
            <SettingsIcon className="w-4 h-4" />
          </Button>

          {/* Page manager */}
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
              try { commitPatchSoon({ data: (next as any).data }); } catch {}
            }}
            onRename={(oldSlug, nextVals) => {
              fireCapture();
              const pages = getTemplatePagesLoose(tplRef.current).map((p: any) =>
                p.slug === oldSlug ? { ...p, title: nextVals.title, slug: nextVals.slug } : p
              );
              const next = withPages(tplRef.current, pages);
              apply(next);
              try { commitPatchSoon({ data: (next as any).data }); } catch {}
            }}
            onDelete={(slug) => {
              fireCapture();
              const pages = getTemplatePagesLoose(tplRef.current).filter((p: any) => p.slug !== slug);
              const next = withPages(tplRef.current, pages);
              apply(next);
              try { commitPatchSoon({ data: (next as any).data }); } catch {}
            }}
            onReorder={(from, to) => {
              fireCapture();
              const pages = [...getTemplatePagesLoose(tplRef.current)];
              const [moved] = pages.splice(from, 1);
              pages.splice(to, 0, moved);
              const next = withPages(tplRef.current, pages);
              apply(next);
              try { commitPatchSoon({ data: (next as any).data }); } catch {}
            }}
            siteId={(tplRef.current as any).site_id}
          />

          <Button size="icon" variant="ghost" title="Page Settings" onClick={() => onOpenPageSettings?.()}>
            <SlidersHorizontal className="w-4 h-4" />
          </Button>

          <Button size="icon" variant="ghost" title={colorPref === 'dark' ? 'Light mode' : 'Dark mode'} onClick={toggleColor} aria-pressed={colorPref === 'dark'}>
            {colorPref === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

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
              <Button size="icon" variant="ghost" title="Dev: Show cache info (⌥⌘C)" onClick={showCacheInfo}>
                <Database className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" title="Dev: Update cache from editor (⌥⌘U)" onClick={updateCacheFromEditor}>
                <Database className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" title="Dev: Invalidate cache (⌥⌘I)" onClick={invalidateCache}>
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
                <span className="absolute -right-1 -top-1 min-w-[16px] px-1 rounded-full text-[10px] bg-zinc-200 text-zinc-900 dark:bg白 dark:text-black text-center">
                  {hist.past}
                </span>
              )}
            </div>

            <div className="relative">
              <Button size="icon" variant="ghost" onClick={handleRedo} title={`Redo (${hist.future} step${hist.future === 1 ? '' : 's'} available) • ⇧⌘Z`}>
                <RotateCw className="w-4 h-4" />
              </Button>
              {hist.future > 0 && (
                <span className="absolute -right-1 -top-1 min-w-[16px] px-1 rounded-full text-[10px] bg-zinc-200 text-zinc-900 dark:bg白 dark:text-black text-center">
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
