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

import AsyncGifOverlay from '@/components/ui/async-gif-overlay';
import { useTemplateVersions } from '@/hooks/useTemplateVersions';
import { templateSig } from '@/lib/editor/saveGuard';
import { loadVersionRow } from '@/admin/lib/templateSnapshots';
import PageManagerToolbar from '@/components/admin/templates/page-manager-toolbar';
import { useTemplateRef } from '@/hooks/usePersistTemplate';
import { resolveIndustryKey } from '@/lib/industries';

import {
  dispatchTemplateCacheInvalidate,
  dispatchTemplateCacheUpdate,
  readTemplateCache,
  type TemplateCacheRow,
} from '@/lib/templateCache';

/* -------------------------------- helpers --------------------------------- */
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

/* ----------------------------- shape normalizer --------------------------- */
function normalizePageBlocksShape(pages: any[]): any[] {
  const isStr = (v: any) => typeof v === 'string' && v.trim().length > 0;

  // hero helpers
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

  // text helpers
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
    p.html = p.html?.trim() ? p.html : chosen;
    p.text = p.text?.trim() ? p.text : chosen.replace(/<[^>]+>/g, '');
    p.value = p.value?.trim() ? p.value : chosen;

    c.html = c.html?.trim() ? c.html : chosen;
    c.text = c.text?.trim() ? c.text : chosen.replace(/<[^>]+>/g, '');
    c.value = c.value?.trim() ? c.value : chosen;

    if (!c.format) c.format = 'html';
    return out;
  };

  const chooseById = (a: any, b: any) => {
    if (!a) return b;
    if (!b) return a;
    if (isTextLike(a) || isTextLike(b)) {
      const aa = mirrorText(a);
      const bb = mirrorText(b);
      const sa = textScore(aa);
      const sb = textScore(bb);
      return sb > sa ? bb : aa;
    }
    if (a.type === 'hero' || b.type === 'hero') {
      const sa = heroScore(a), sb = heroScore(b);
      if (sa !== sb) return sa > sb ? a : b;
    }
    return b;
  };

  return (pages || []).map((p: any) => {
    const all: any[] = [
      ...(Array.isArray(p?.blocks) ? p.blocks : []),
      ...(Array.isArray(p?.content_blocks) ? p.content_blocks : []),
      ...(Array.isArray(p?.content?.blocks) ? p.content.blocks : []),
    ];
    if (all.length === 0) return p;

    const byId = new Map<string, any>();
    for (const b of all) {
      if (!b) continue;
      const id = String(b?._id ?? b?.id ?? '');
      if (!id) continue;
      const cur = byId.get(id);
      byId.set(id, chooseById(cur, b));
    }

    let keep: any[] = Array.from(byId.values());

    const heroCandidates = keep.filter((b) => b?.type === 'hero');
    if (heroCandidates.length > 1) {
      const best = heroCandidates.reduce((best, b) => (heroScore(b) > heroScore(best) ? b : best), heroCandidates[0]);
      keep = keep.filter((b) => b?.type !== 'hero');
      keep.splice(0, 0, unifyHero(best));
    } else {
      keep = keep.map((b) => (b?.type === 'hero' ? unifyHero(b) : b));
    }

    keep = keep.map((b) => (isTextLike(b) ? mirrorText(b) : b));

    const next: any = { ...p };
    next.blocks = keep;
    if (Array.isArray(p?.content_blocks)) next.content_blocks = keep;
    if (p?.content && typeof p.content === 'object') next.content = { ...p.content, blocks: keep };
    return next;
  });
}

/* --------------------------- debounced helper ------------------------------ */
function useDebounced<T extends (...args: any[]) => void>(fn: T, delay = 350) {
  const tRef = useRef<any>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((...args: Parameters<T>) => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

/* ----------------------- conflict-tolerant POST ---------------------------- */
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
  const mergeFromCommit = (json: any) => {
    try {
      if (json?.template) {
        window.dispatchEvent(new CustomEvent('qs:template:merge', { detail: json.template }));
      } else {
        window.dispatchEvent(new Event('qs:template:invalidate'));
      }
    } catch {}
  };

  const send = async (rev: number) => {
    const res = await fetch('/api/templates/commit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, baseRev: rev, patch, kind }),
    });

    const json = await res.json().catch(() => ({}));

    if (res.status === 409) {
      const latest = typeof json?.rev === 'number' ? json.rev : rev;
      return { conflict: true as const, latest };
    }
    if (!res.ok) {
      throw new Error(json?.error || `commit failed (${res.status})`);
    }

    // ✅ immediately hydrate editor from the authoritative row
    mergeFromCommit(json);
    return { conflict: false as const, json };
  };

  let first = await send(baseRev);
  if (first.conflict) {
    const second = await send(first.latest);
    if (!second.conflict) return second.json;
    throw new Error('commit rebase failed');
  }
  return (first as any).json;
}


/* -------------------------------- component -------------------------------- */
type SaveWarning = { field: string; message: string };

type Props = {
  template: Template;
  autosaveStatus?: string;
  onSaveDraft?: (maybeSanitized?: Template) => void;
  onUndo?: () => void;
  onRedo?: () => void;
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

  // ── Toolbar collapse state (persisted + events)
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

  // Page manager open/closed state
  const [pageMgrOpen, setPageMgrOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try { return (window.localStorage.getItem('qs:toolbar:pageMgrOpen') ?? '1') !== '0'; } catch { return true; }
  });
  useEffect(() => {
    try { window.localStorage.setItem('qs:toolbar:pageMgrOpen', pageMgrOpen ? '1' : '0'); } catch {}
    window.dispatchEvent(new CustomEvent('qs:toolbar:page-manager:open', { detail: pageMgrOpen }));
  }, [pageMgrOpen]);

  const tplRef = useTemplateRef(template);

  // Track last persisted signature (dirty marker)
  const savedSigRef = useRef<string>('');
  useEffect(() => { savedSigRef.current = templateSig(template); }, []); // initial mount
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setDirty(templateSig(template) !== savedSigRef.current); }, [template]);

  /* ---------------------------- COMMIT QUEUE (NEW) ------------------------- */
  const committingRef = useRef(false);
  const queueRequestedRef = useRef(false);
  const [pending, setPending] = useState(false);

  const buildFullCommitPayloadFromCurrent = useCallback(() => {
    const cur: any = tplRef.current;

    const dataIn = (cur?.data ?? {}) as any;
    const metaIn = (dataIn.meta ?? {}) as any;

    const canonicalIndustry = resolveIndustryKey(
      metaIn.industry ??
      cur?.industry ??
      'other'
    );
    const canonicalServices =
      Array.isArray(dataIn.services) ? dataIn.services :
      Array.isArray(metaIn.services) ? metaIn.services :
      Array.isArray(cur?.services) ? cur.services : [];

    const pages = getTemplatePagesLoose(cur);
    const normalizedPages = normalizePageBlocksShape(pages);

    const site_type =
    metaIn.site_type ?? cur?.site_type ?? cur?.data?.meta?.site_type ?? null;
  const industry_label =
    metaIn.industry_label ?? cur?.data?.meta?.industry_label ?? null;
  
  const canonicalData = {
    ...dataIn,
    pages: normalizedPages,
    services: canonicalServices,
    meta: {
      ...metaIn,
      // explicitly carry these so they can’t get dropped
      site_type,
      industry_label,
      // canonicalize the items we always manage
      industry: canonicalIndustry,
      services: canonicalServices,
    },
  };

    const template_name =
      (canonicalData?.meta?.siteTitle && String(canonicalData.meta.siteTitle).trim()) ||
      (typeof cur?.template_name === 'string' && cur.template_name.trim()) ||
      cur?.template_name ||
      undefined;

    return {
      data: canonicalData,
      color_mode: cur?.color_mode,
      ...(template_name ? { template_name } : {}),
    };
  }, [tplRef]);

  const runCommitLoop = useCallback(async (kind: 'save' | 'autosave' = 'save') => {
    if (committingRef.current) return;
    committingRef.current = true;
    setPending(true);

    try {
      do {
        queueRequestedRef.current = false;

        const payload = buildFullCommitPayloadFromCurrent();
        const cur: any = tplRef.current;
        const id = String(cur?.id || '');
        const baseRev = Number.isFinite(cur?.rev) ? cur.rev : NaN;

        await commitWithRebase({ id, baseRev, patch: payload, kind });

        // mark clean
        const nextSig = templateSig({ ...(cur as any), data: payload.data });
        savedSigRef.current = nextSig;
        setDirty(false);
        try { dispatchTemplateCacheUpdate(toCacheRow({ ...(cur as any), data: payload.data })); } catch {}
      } while (queueRequestedRef.current);

      // toast.success('Saved!');
      try { window.dispatchEvent(new Event('qs:preview:save')); } catch {}
    } catch (err) {
      console.error('[commit queue] commit failed:', err);
      toast.error('Save failed — please retry');
    } finally {
      committingRef.current = false;
      setPending(false);
    }
  }, [tplRef, buildFullCommitPayloadFromCurrent]);

  const queueFullSave = useCallback((kind: 'save' | 'autosave' = 'save') => {
    queueRequestedRef.current = true;
    if (!committingRef.current) void runCommitLoop(kind);
  }, [runCommitLoop]);
  /* ------------------------------------------------------------------------ */

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
          detail: { data: nextData, __transient: true } as any,
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

  // keyboard toggles for toolbar + page manager
  useEffect(() => {
    const isTyping = (n: EventTarget | null) => {
      const el = n as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable) return true;
      const tag = (el.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el.closest?.('.cm-editor,.ProseMirror');
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const k = (e.key || '').toLowerCase();
      if (k !== 't' && k !== 'p') return;
      if (isTyping(e.target)) return;
      e.preventDefault();
      if (k === 't') {
        toggleToolbarCollapse();
      } else if (k === 'p') {
        if (toolbarCollapsed) expandToolbar();
        setPageMgrOpen((v) => !v);
      }
    };

    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey as any, { capture: true } as any);
  }, [toolbarCollapsed]);

  useEffect(() => {
    const onStats = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      setHist({ past: Number(d.past ?? 0), future: Number(d.future ?? 0) });
    };
    window.addEventListener('qs:history:stats', onStats as any);
    window.dispatchEvent(new CustomEvent('qs:history:request-stats'));
    return () => window.removeEventListener('qs:history:stats', onStats as any);
  }, []);

  const apply = (next: Template) => {
    onApplyTemplate(next);
    onSetRawJson?.(pretty(next));
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  /* ------------------- Patch bus → apply + queue persist ------------------- */
  useEffect(() => {
    const onPatch = (e: Event) => {
      const patch = ((e as CustomEvent).detail ?? {}) as any;
      if (!patch || typeof patch !== 'object') return;

      const isTransient = !!patch.__transient;

      const cur: any = tplRef.current;
      const next: any = { ...cur };

      // merge top-level keys (skip data & internal)
      for (const k of Object.keys(patch)) {
        if (k === 'data' || k === '__transient') continue;
        next[k] = patch[k];
      }

      // shallow-merge data and normalize pages
      if (patch.data && typeof patch.data === 'object') {
        const merged = { ...(cur?.data ?? {}), ...(patch.data as any) };
        const pages = Array.isArray(merged.pages) ? merged.pages : [];
        const normalizedPages = normalizePageBlocksShape(pages);
        next.data = { ...merged, pages: normalizedPages };
      }

      // keep UI current
      apply(next);

      // transient → preview-only
      if (isTransient) return;

      // queue a full save built from latest state (single-path)
      queueFullSave('save');
    };

    window.addEventListener('qs:template:apply-patch', onPatch as any);
    return () => window.removeEventListener('qs:template:apply-patch', onPatch as any);
  }, [apply, tplRef, queueFullSave]);

  const emitSettingsOpen = (open: boolean) => {
    window.dispatchEvent(new CustomEvent('qs:settings:set-open', { detail: open }));
    try { window.localStorage.setItem('qs:settingsOpen', open ? '1' : '0'); } catch {}
  };

  const fireCapture = () => window.dispatchEvent(new CustomEvent('qs:history:capture'));

  // const toggleColor = () => {
  //   fireCapture();
  //   const nextMode: 'light'|'dark' = colorPref === 'dark' ? 'light' : 'dark';
  //   setColorPref(nextMode);
  //   try { localStorage.setItem('qs:preview:color', nextMode); } catch {}

  //   const next = { ...tplRef.current, color_mode: nextMode } as Template;
  //   apply(next);

  //   // queue autosave instead of immediate commit
  //   queueFullSave('autosave');

  //   window.dispatchEvent(new CustomEvent('qs:preview:set-color-mode', { detail: nextMode }));
  // };

  // fullscreen helpers
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

  // versions feed
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

  /* ---------------------- Save button → queue full save --------------------- */
  const handleSaveClick = async () => {
    try {
      // ask any open block editor to flush (patch → queue picks up)
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

      // Ensure pages are in data; normalize quickly for the local preview
      const nextTemplate = (check.data ?? src) as Template;
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
      const normalizedPages = normalizePageBlocksShape(getTemplatePagesLoose(nextTemplate));
      (nextTemplate as any).data = { ...(nextTemplate as any).data, pages: normalizedPages };
      (nextTemplate as any).pages = normalizedPages;

      // canonicalize meta/services for local view; queue handles persisted state
      const dataIn = ((nextTemplate as any).data ?? {}) as any;
      const metaIn = (dataIn.meta ?? {}) as any;

      const canonicalIndustryKey = resolveIndustryKey(
        metaIn.industry ??
        ((template as any)?.data?.meta?.industry) ??
        (nextTemplate as any)?.industry ??
        'other'
      );

      const canonicalServices =
        Array.isArray(dataIn.services) ? dataIn.services :
        Array.isArray(metaIn.services) ? metaIn.services :
        Array.isArray((nextTemplate as any).services) ? (nextTemplate as any).services :
        [];

      const site_type =
        metaIn.site_type ?? (nextTemplate as any)?.data?.meta?.site_type ?? null;
      const industry_label =
        metaIn.industry_label ?? (nextTemplate as any)?.data?.meta?.industry_label ?? null;

      const canonicalData = {
        ...dataIn,
        meta: {
          ...metaIn,
          site_type,
          industry_label,
          industry: canonicalIndustryKey,
          services: canonicalServices,
        },
        services: canonicalServices,
        pages: normalizedPages,
      };


      const canonicalTemplateName =
        (canonicalData?.meta?.siteTitle && String(canonicalData.meta.siteTitle).trim()) ||
        (typeof (nextTemplate as any).template_name === 'string' && (nextTemplate as any).template_name.trim()) ||
        '';

      if (canonicalTemplateName) (nextTemplate as any).template_name = canonicalTemplateName;

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

      // queue full save
      queueFullSave('save');
    } catch (err) {
      console.error('❌ Save/commit prepare crashed:', err);
      toast.error('Save failed — see console.');
    }
  };

  // External requests to save now
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

  /* ------------------------------- Snapshot -------------------------------- */
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

  /* -------------------------------- Restore -------------------------------- */
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

      // queue a persisted save of restored data
      queueFullSave('save');

      toast.success('Version restored!');
      window.dispatchEvent(new CustomEvent('qs:truth:refresh'));
      await reloadVersions();
    } catch (e: any) {
      console.error('QSITES[versions] restore failed', { trace, message: e?.message, stack: e?.stack });
      toast.error(`Failed to load version: ${e?.message || 'Unknown error'}`);
    } finally {
      console.timeEnd(`QSITES[versions] restore time ${trace}`);
    }
  };

  /* -------------------------------- Publish -------------------------------- */
  const onPublish = async (snapshotId?: string) => {
    try {
      let sid = snapshotId;
      if (!sid) {
        await handleSaveClick();
        sid = await onCreateSnapshot();
      }
      if (!sid) throw new Error('No snapshot to publish');

      const url = `/api/admin/sites/publish?templateId=${(template as any).id}&snapshotId=${sid}&versionId=${sid}&debug=1`;
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
    doUndo();
    onUndo?.();
    window.dispatchEvent(new CustomEvent('qs:history:request-stats'));
    toast('Undo', { icon: '↩️' });
  };
  const handleRedo = () => {
    doRedo();
    onRedo?.();
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
  const collapsedPos = 'left-[25%]';

  /* --------------------------------- UI ------------------------------------ */
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
          </div>
        ) : (
          <div className="w-full flex justify-between items-center gap-3">
            {/* Hide/Show toolbar */}
            <Button
              size="icon"
              variant="ghost"
              title="Hide toolbar"
              aria-pressed={!toolbarCollapsed}
              onClick={toggleToolbarCollapse}
            >
              <SettingsIcon className="w-4 h-4" />
            </Button>

            {/* Open Site Settings */}
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

            {/* Page Manager */}
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
                const next = withPages(tplRef.current, pages);
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

            {/* Color mode + viewport */}
            {/* <Button size="icon" variant="ghost" title={colorPref === 'dark' ? 'Light mode' : 'Dark mode'} onClick={toggleColor} aria-pressed={colorPref === 'dark'}>
              {colorPref === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button> */}

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

            {/* Save button bound to queue state */}
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

            {/* Hide control */}
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
