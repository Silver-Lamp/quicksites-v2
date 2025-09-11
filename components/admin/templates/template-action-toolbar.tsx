// components/admin/templates/template-action-toolbar.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  RotateCcw, RotateCw, AlertTriangle, X, Maximize2, Minimize2,
  Smartphone, Tablet, Monitor, Sun, Moon, SlidersHorizontal, Check,
  Settings as SettingsIcon, Trash2, Database, Minus, Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui';
import toast from 'react-hot-toast';

import type { Template } from '@/types/template';
import { validateTemplateAndFix } from '@/admin/lib/validateTemplate';
import type { ValidateResult, Warning } from '@/admin/lib/validateTemplate';
// import { saveAsTemplate } from '@/admin/lib/saveAsTemplate';
// import { createSharedPreview } from '@/admin/lib/createSharedPreview';

import AsyncGifOverlay from '@/components/ui/async-gif-overlay';
// import VersionsDropdown from '@/components/admin/templates/versions-dropdown';
import { useTemplateVersions } from '@/hooks/useTemplateVersions';
import { templateSig } from '@/lib/editor/saveGuard';
// import { buildSharedSnapshotPayload } from '@/lib/editor/templateUtils';
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
// import { heroLog, heroDbgOn, pickHeroSnapshots } from '@/lib/debug/hero';


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

  // ---------- hero helpers (existing behavior, kept) ----------
  const getCanonHero = (b: any) => ({
    heading: b?.props?.heading ?? b?.content?.headline ?? '',
    subheading: b?.props?.subheading ?? b?.content?.subheadline ?? '',
    cta: b?.props?.ctaLabel ?? b?.content?.cta_text ?? '',
  });
  const isDefaultHeading = (s: string) =>
    !isStr(s) || /^welcome to your new site$/i.test(s.trim());
  const heroScore = (b: any) => {
    if (!b || b.type !== 'hero') return 0;
    const c = getCanonHero(b);
    let s = 0;
    if (!isDefaultHeading(c.heading)) s += 3;
    if (isStr(c.subheading)) s += 1;
    if (isStr(c.cta)) s += 1;
    if (b?.props && b?.content) s += 1;
    return s;
  };
  const unifyHero = (b: any) => {
    if (!b || b.type !== 'hero') return b;
    const out: any = { ...b, props: { ...(b.props ?? {}) }, content: { ...(b.content ?? {}) } };

    const heading     = out.props.heading     ?? out.content.headline;
    const subheading  = out.props.subheading  ?? out.content.subheadline;
    const ctaLabel    = out.props.ctaLabel    ?? out.content.cta_text;

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
      image_url: heroImage,
      blur_amount: blur,
      image_position: pos,
      layout_mode: layout,
    };
    return out;
  };

  // ---------- text helpers (new) ----------
  const TEXT_LIKE = new Set(['text','rich_text','richtext','richText','paragraph','markdown','textarea','wysiwyg']);
  const isTextLike = (b: any) => TEXT_LIKE.has(String(b?.type || '').toLowerCase());

  const textScore = (b: any) => {
    if (!isTextLike(b)) return -1;
    const p = b?.props ?? {};
    const c = b?.content ?? {};
    const vals = [p.html, p.text, p.value, c.html, c.text, c.value];
    return vals.reduce((s, v) => s + (typeof v === 'string' ? v.trim().length : 0), 0);
  };

  const mirrorText = (b: any) => {
    if (!isTextLike(b)) return b;
    const out: any = { ...b, props: { ...(b.props ?? {}) }, content: { ...(b.content ?? {}) } };
    const p = out.props, c = out.content;
    const chosen =
      (typeof p.html === 'string' && p.html.trim()) ||
      (typeof p.text === 'string' && p.text.trim()) ||
      (typeof p.value === 'string' && p.value.trim()) ||
      (typeof c.html === 'string' && c.html.trim()) ||
      (typeof c.text === 'string' && c.text.trim()) ||
      (typeof c.value === 'string' && c.value.trim()) || '';
    // write chosen into all common fields so readers agree
    p.html = p.html?.trim() ? p.html : chosen;
    p.text = p.text?.trim() ? p.text : chosen.replace(/<[^>]+>/g, '');
    p.value = p.value?.trim() ? p.value : chosen;

    c.html = c.html?.trim() ? c.html : chosen;
    c.text = c.text?.trim() ? c.text : chosen.replace(/<[^>]+>/g, '');
    c.value = c.value?.trim() ? c.value : chosen;

    if (!c.format) c.format = 'html';
    return out;
  };

  // Choose the better duplicate by id across shapes
  const chooseById = (a: any, b: any) => {
    if (!a) return b;
    if (!b) return a;

    // Prefer the version with real text for text-like blocks
    if (isTextLike(a) || isTextLike(b)) {
      const aa = mirrorText(a);
      const bb = mirrorText(b);
      const sa = textScore(aa);
      const sb = textScore(bb);
      return sb > sa ? bb : aa; // pick the one with more content
    }

    // Keep existing hero logic
    if (a.type === 'hero' || b.type === 'hero') {
      const sa = heroScore(a), sb = heroScore(b);
      if (sa !== sb) return sa > sb ? a : b;
    }

    // Fallback: later wins
    return b;
  };

  return (pages || []).map((p: any) => {
    const all: any[] = [
      ...(Array.isArray(p?.blocks) ? p.blocks : []),
      ...(Array.isArray(p?.content_blocks) ? p.content_blocks : []),
      ...(Array.isArray(p?.content?.blocks) ? p.content.blocks : []),
    ];
    if (all.length === 0) return p;

    // Collapse by id, coalescing hero/text correctly
    const byId = new Map<string, any>();
    for (const b of all) {
      if (!b) continue;
      const id = String(b?._id ?? b?.id ?? '');
      if (!id) continue;
      const cur = byId.get(id);
      byId.set(id, chooseById(cur, b));
    }

    // Now we have a single winner per id
    let keep: any[] = Array.from(byId.values());

    // If multiple heroes, pick best unified winner
    const heroCandidates = keep.filter((b) => b?.type === 'hero');
    if (heroCandidates.length > 1) {
      const best = heroCandidates.reduce((best, b) => (heroScore(b) > heroScore(best) ? b : best), heroCandidates[0]);
      keep = keep.filter((b) => b?.type !== 'hero');
      keep.splice(0, 0, unifyHero(best));
    } else {
      // still normalize a single hero if present
      keep = keep.map((b) => (b?.type === 'hero' ? unifyHero(b) : b));
    }

    // Mirror text fields on winners so both shapes stay in sync
    keep = keep.map((b) => (isTextLike(b) ? mirrorText(b) : b));

    // Write back to all shapes
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
  onUndo?: () => void; // ⬅️ made optional
  onRedo?: () => void; // ⬅️ made optional
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

  // ── Toolbar collapse state (persisted + events) ──────────────────────────────
  const [toolbarCollapsed, setToolbarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return (window.localStorage.getItem('qs:toolbar:collapsed') ?? '0') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { window.localStorage.setItem('qs:toolbar:collapsed', toolbarCollapsed ? '1' : '0'); } catch {}
    window.dispatchEvent(new CustomEvent('qs:toolbar:collapsed', { detail: toolbarCollapsed }));
  }, [toolbarCollapsed]);
  useEffect(() => {
    const onSet = (e: Event) => setToolbarCollapsed(!!(e as CustomEvent).detail);
    window.addEventListener('qs:toolbar:set-collapsed', onSet as any);
    return () => window.removeEventListener('qs:toolbar:set-collapsed', onSet as any);
  }, []);
  const collapseToolbar = () => setToolbarCollapsed(true);
  const expandToolbar = () => setToolbarCollapsed(false);
  const toggleToolbarCollapse = () => setToolbarCollapsed(v => !v);

  // Page Manager open/closed state (persisted)
  const [pageMgrOpen, setPageMgrOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try { return (window.localStorage.getItem('qs:toolbar:pageMgrOpen') ?? '1') !== '0'; } catch { return true; }
  });
  useEffect(() => {
    try { window.localStorage.setItem('qs:toolbar:pageMgrOpen', pageMgrOpen ? '1' : '0'); } catch {}
    window.dispatchEvent(new CustomEvent('qs:toolbar:page-manager:open', { detail: pageMgrOpen }));
  }, [pageMgrOpen]);


  const tplRef = useTemplateRef(template);

  // Track LAST PERSISTED signature (logical dirty)
  const savedSigRef = useRef<string>('');
  useEffect(() => { savedSigRef.current = templateSig(template); }, []); // initial mount
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setDirty(templateSig(template) !== savedSigRef.current); }, [template]);

  // New commit API (full patch support)
  const { pending, commitPatch, commitPatchSoon, loadRev } = useCommitApi((template as any)?.id);

  /* -------------------- Undo/Redo History (self-contained) -------------------- */
  type TData = any;
  const MAX_HISTORY = 120;
  const undoStackRef = useRef<TData[]>([]);
  const redoStackRef = useRef<TData[]>([]);
  const prevDataRef = useRef<TData | null>(null);
  const lastKeyRef = useRef<string>('');
  const initRef = useRef(false);
  const isReplayingRef = useRef(false);

  const deepClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

  const publishHistoryStats = () => {
    window.dispatchEvent(
      new CustomEvent('qs:history:stats', {
        detail: { past: undoStackRef.current.length, future: redoStackRef.current.length },
      })
    );
  };

  // Capture on any real `template.data` change
  useEffect(() => {
    const data = (template as any)?.data;
    if (!data) return;
    const key = JSON.stringify(data);

    if (!initRef.current) {
      initRef.current = true;
      lastKeyRef.current = key;
      prevDataRef.current = deepClone(data);
      publishHistoryStats();
      return;
    }

    if (isReplayingRef.current) {
      lastKeyRef.current = key;
      prevDataRef.current = deepClone(data);
      publishHistoryStats();
      return;
    }

    if (key !== lastKeyRef.current) {
      if (prevDataRef.current) {
        undoStackRef.current.push(deepClone(prevDataRef.current));
        if (undoStackRef.current.length > MAX_HISTORY) undoStackRef.current.shift();
      }
      redoStackRef.current = [];
      lastKeyRef.current = key;
      prevDataRef.current = deepClone(data);
      publishHistoryStats();
    }
  }, [template?.data]);

  // Respond to capture and stats requests
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
      publishHistoryStats();
    };
    const onReq = () => publishHistoryStats();

    window.addEventListener('qs:history:capture', onCapture as any);
    window.addEventListener('qs:history:request-stats', onReq as any);
    return () => {
      window.removeEventListener('qs:history:capture', onCapture as any);
      window.removeEventListener('qs:history:request-stats', onReq as any);
    };
  }, [template]);

  const replaceDraftTransient = (nextData: any) => {
    try {
      isReplayingRef.current = true;
      window.dispatchEvent(
        new CustomEvent('qs:template:apply-patch', {
          detail: { data: nextData, __transient: true } as any, // do NOT persist
        })
      );
    } finally {
      setTimeout(() => { isReplayingRef.current = false; }, 0);
    }
  };

  const doUndo = () => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    const current = prevDataRef.current ?? (template as any)?.data;
    redoStackRef.current.push(deepClone(current));
    replaceDraftTransient(prev);
    publishHistoryStats();
  };

  const doRedo = () => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    const current = prevDataRef.current ?? (template as any)?.data;
    undoStackRef.current.push(deepClone(current));
    replaceDraftTransient(next);
    publishHistoryStats();
  };
  /* -------------------------------------------------------------------------- */

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

  // undo/redo keyboard
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

  // Keyboard: 't' → toggle toolbar, 'p' → toggle Page Manager (and expand if collapsed)
  useEffect(() => {
    const isTyping = (n: EventTarget | null) => {
      const el = n as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable) return true;
      const tag = (el.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el.closest?.('.cm-editor,.ProseMirror');
    };

    const onKey = (e: KeyboardEvent) => {
      // no modifiers
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      const k = (e.key || '').toLowerCase();
      if (k !== 't' && k !== 'p') return;
      if (isTyping(e.target)) return;

      e.preventDefault();

      if (k === 't') {
        toggleToolbarCollapse();
      } else if (k === 'p') {
        // ensure toolbar is visible, then toggle page manager
        if (toolbarCollapsed) expandToolbar();
        setPageMgrOpen((v) => !v);
      }
    };

    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey as any, { capture: true } as any);
  }, [toolbarCollapsed, expandToolbar, toggleToolbarCollapse]);


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

  /* ---------- Patch bus → apply + (persisted) commit-with-rebase ---------- */
  useEffect(() => {
    const onPatch = (e: Event) => {
      const patch = ((e as CustomEvent).detail ?? {}) as any;
      if (!patch || typeof patch !== 'object') return;

      const isTransient = !!patch.__transient;

      const cur: any = tplRef.current;
      const next: any = { ...cur };

      // 1) merge top-level keys (except 'data' and internal flags)
      for (const k of Object.keys(patch)) {
        if (k === 'data' || k === '__transient') continue;
        next[k] = patch[k];
      }

      // 2) shallow-merge data, then normalize per-page block array shapes
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

      // Always apply to keep UI current
      apply(next);

      if (localStorage.getItem('qs:debug:hero') === '1') {
        const pages = Array.isArray(next?.data?.pages) ? next.data.pages : [];
        const heroes = pages.flatMap((pg: any, i: number) =>
          (pg?.blocks || pg?.content_blocks || pg?.content?.blocks || [])
            .filter((b: any) => b?.type === 'hero')
            .map((b: any) => ({
              pageIndex: i,
              id: b?._id ?? b?.id,
              heading: b?.props?.heading,
              subheading: b?.props?.subheading,
              ctaLabel: b?.props?.ctaLabel,
            }))
        );
        // eslint-disable-next-line no-console
        console.log(
          '%cQS/HERO%c commit payload heroes',
          'background:#7c3aed;color:#fff;padding:2px 6px;border-radius:4px;',
          'color:#e5e7eb;',
          heroes
        );
      }

      // Transient = preview-only; do not hit the API
      if (isTransient) return;

      // Persisted patch (e.g., Toolbar Save) → single commit with rebase
      const id = String((tplRef.current as any)?.id || patch?.id || '');
      const baseRev =
        Number.isFinite((tplRef.current as any)?.rev)
          ? (tplRef.current as any).rev
          : Number.isFinite((next as any)?.rev)
          ? (next as any).rev
          : (NaN as any);

      void (async () => {
        try {
          // ⬅️ Always carry template_name in commit
          const commitPayload = {
            ...patch,
            data: next.data,
            template_name:
              next?.template_name ??
              next?.data?.meta?.siteTitle ??
              (typeof patch.template_name === 'string' ? patch.template_name : undefined),
          };

          await commitWithRebase({
            id,
            baseRev,
            patch: commitPayload,
            kind: 'save',
          });

          // mark clean & cache
          savedSigRef.current = templateSig(next);
          setDirty(false);
          try { dispatchTemplateCacheUpdate(toCacheRow(next)); } catch {}
          toast.success('Saved!');
          try { window.dispatchEvent(new Event('qs:preview:save')); } catch {}
        } catch (err) {
          console.error('[toolbar/onPatch] persisted commit failed:', err);
          toast.error('Save failed — please retry');
        }
      })();
    };

    window.addEventListener('qs:template:apply-patch', onPatch as any);
    return () => window.removeEventListener('qs:template:apply-patch', onPatch as any);
  }, [apply, tplRef]);

  // Settings sidebar control (handled elsewhere; gear no longer toggles this)
  const emitSettingsOpen = (open: boolean) => {
    window.dispatchEvent(new CustomEvent('qs:settings:set-open', { detail: open }));
    try { window.localStorage.setItem('qs:settingsOpen', open ? '1' : '0'); } catch {}
  };

  const fireCapture = () => window.dispatchEvent(new CustomEvent('qs:history:capture'));

  const toggleColor = () => {
    fireCapture();
    const nextMode: 'light'|'dark' = colorPref === 'dark' ? 'light' : 'dark';
    setColorPref(nextMode);
    try { localStorage.setItem('qs:preview:color', nextMode); } catch {}

    const next = { ...tplRef.current, color_mode: nextMode } as Template;
    apply(next);

    // autosave (color toggle can be persisted opportunistically)
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

  /* ---------- Save (emit persisted patch; commit happens in onPatch) ---------- */
  const handleSaveClick = async () => {
    try {
      // 0) ask any open block editor to flush
      try {
        window.dispatchEvent(new Event('qs:block-editor:save'));
        await new Promise((r) => setTimeout(r, 0));
      } catch {}

      const src = tplRef.current as any;

      const check: ValidateResult = validateTemplateAndFix
        ? validateTemplateAndFix(src)
        : { valid: true, data: src as any, warnings: [] as Warning[] };

      if (!check.valid) {
        console.error('[validateTemplateAndFix] failed:', check.errors);
        toast.error('Validation failed — see console.');
        return;
      }

      const nextTemplate = (check.data ?? src) as Template;

      // Ensure pages live in data and mirror to top-level
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

      // Normalize shapes
      const normalizedPages = normalizePageBlocksShape(getTemplatePagesLoose(nextTemplate));

      // (text rescue block unchanged for brevity)
      const TEXT_LIKE = new Set(['text','rich_text','richtext','richText','paragraph','markdown','textarea','wysiwyg']);
      const isTextLike = (b: any) => TEXT_LIKE.has(String(b?.type || '').toLowerCase());
      const getStr = (v: any) => (typeof v === 'string' && v.trim().length ? v.trim() : '');
      const pmText = (node: any): string => {
        if (!node) return '';
        if (typeof node.text === 'string') return node.text;
        const kids = Array.isArray(node.content) ? node.content : Array.isArray(node.children) ? node.children : [];
        return kids.map(pmText).join('');
      };
      const escapeHtml = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const mirrorTextFields = (blk: any) => {
        if (!isTextLike(blk)) return blk;
        const out: any = { ...blk, props: { ...(blk.props ?? {}) }, content: { ...(blk.content ?? {}) } };
        const p = out.props, c = out.content;
        let html = getStr(c.html) || getStr(p.html) || getStr(c.value) || getStr(p.value);
        let text = getStr(c.text) || getStr(p.text);
        if (!html && !text) {
          const json = (c.json ?? p.json) as any;
          const fromJson = getStr(pmText(json));
          if (fromJson) {
            text = fromJson;
            html = `<p>${escapeHtml(fromJson).replace(/\n/g,'<br/>')}</p>`;
          }
        }
        if (!html && text) html = `<p>${escapeHtml(text).replace(/\n/g,'<br/>')}</p>`;
        if (!text && html) text = html.replace(/<[^>]+>/g,'').trim();
        p.html = html || ''; p.value = html || ''; p.text = text || '';
        c.html = html || ''; c.value = html || ''; c.text = text || '';
        if (!c.format) c.format = 'html';
        return out;
      };
      const rescuedPages = (normalizedPages ?? []).map((page: any) => {
        const pageCopy: any = { ...page };
        const blocks =
          (pageCopy?.blocks ??
            pageCopy?.content_blocks ??
            pageCopy?.content?.blocks ??
            []) as any[];
        if (!Array.isArray(blocks) || !blocks.length) return pageCopy;
        const fixed = blocks.map(mirrorTextFields);
        pageCopy.blocks = fixed;
        if (Array.isArray(pageCopy?.content_blocks)) pageCopy.content_blocks = fixed;
        if (pageCopy?.content && typeof pageCopy.content === 'object') {
          pageCopy.content = { ...(pageCopy.content ?? {}), blocks: fixed };
        }
        return pageCopy;
      });

      (nextTemplate as any).data = { ...(nextTemplate as any).data, pages: rescuedPages };
      (nextTemplate as any).pages = rescuedPages;

      // Canonical meta/services
      const dataIn = ((nextTemplate as any).data ?? {}) as any;
      const metaIn = (dataIn.meta ?? {}) as any;

      const existingIndustry =
        metaIn.industry ??
        ((template as any)?.data?.meta?.industry) ??
        ((nextTemplate as any)?.data?.meta?.industry) ??
        (nextTemplate as any)?.industry;

      const canonicalIndustryKey = resolveIndustryKey(existingIndustry ?? 'other');

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
        pages: rescuedPages,
      };

      // ⬅️ NEW: resolve and set canonical template name top-level
      const canonicalTemplateName =
        (canonicalData?.meta?.siteTitle && String(canonicalData.meta.siteTitle).trim()) ||
        (typeof (nextTemplate as any).template_name === 'string' && (nextTemplate as any).template_name.trim()) ||
        '';

      if (canonicalTemplateName) {
        (nextTemplate as any).template_name = canonicalTemplateName;
      }

      // Dirty check
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

      // Emit persisted patch (onPatch will add template_name if missing)
      onSaveDraft?.({ ...(nextTemplate as any), data: canonicalData });
      onSetRawJson?.(pretty({ ...(nextTemplate as any), data: canonicalData }));

      await loadRev?.();
    } catch (err) {
      console.error('❌ Save/commit prepare crashed:', err);
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

  // Undo/Redo handlers (buttons + keyboard)
  const handleUndo = () => {
    doUndo();               // local engine
    onUndo?.();             // optional external hook
    window.dispatchEvent(new CustomEvent('qs:history:request-stats'));
    toast('Undo', { icon: '↩️' });
  };
  const handleRedo = () => {
    doRedo();               // local engine
    onRedo?.();             // optional external hook
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
    
  const centerPos = 'left-1/2 -translate-x-1/2';
  const collapsedPos = 'left-[25%]'; // ~ one-third from the left (no translate)

  return createPortal(
    <>
      <div
        id="template-action-toolbar"
        className={`fixed bottom-4 z-[2147483647] rounded-2xl border border-zinc-700 bg-zinc-900/95 backdrop-blur shadow-lg text-zinc-100 hover:border-purple-500 transition pointer-events-auto ${
          toolbarCollapsed
            ? `${collapsedPos} translate-x-0 w-auto px-2 py-2 opacity-80 hover:opacity-100`
            : `${centerPos} w-[95%] max-w-5xl px-4 sm:px-6 py-3 opacity-90 hover:opacity-100`
        }`}
        style={{ WebkitTapHighlightColor: 'transparent', pointerEvents: toolbarEnabled ? 'auto' : 'none' }}
      >
        {toolbarCollapsed ? (
          <div className="w-full flex items-center gap-2">
            <Button size="icon" variant="secondary" title="Show toolbar" aria-label="Show toolbar" onClick={expandToolbar}>
              <SettingsIcon className="w-4 h-4" />
            </Button>
            {/* <span className="text-xs opacity-70 hidden sm:inline">Show toolbar</span> */}
          </div>
        ) : (
        <div className="w-full flex justify-between items-center gap-3">
          {/* Gear now toggles toolbar collapse/expand */}
          <Button
            size="icon"
            variant="ghost"
            title="Hide toolbar"
            aria-pressed={!toolbarCollapsed}
            onClick={toggleToolbarCollapse}
          >
            <SettingsIcon className="w-4 h-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            title="Open Site Settings (S)"
            aria-label="Open Site Settings"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('qs:settings:set-open', { detail: true }));
              try { window.localStorage.setItem('qs:settingsOpen', '1'); } catch {}
            }}
          >
            <Wrench className="w-4 h-4" />
          </Button>

          {/* Page manager (toggle with 'P') */}
          {/* Page manager selector is always visible when expanded; tray is controlled by pageMgrOpen */}
          <PageManagerToolbar
            pages={getTemplatePagesLoose(template)}
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

          {/* <VersionsDropdown …removed per consolidation/> */}

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
          {/* Right-edge Hide control */}
          <Button
            size="sm"
            variant="ghost"
            title="Hide toolbar"
            aria-label="Hide toolbar"
            onClick={collapseToolbar}
            className="px-2 py-1"
          >
            <Minus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Hide</span>
          </Button>
        </div>
        )}
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
