// app/admin/templates/sidebar-settings.tsx (Sidebar Settings)
'use client';

import BackdropPanel from '@/components/admin/templates/panels/backdrop-panel';
import { TOOLBAR_CLEARANCE_PADDING } from '@/lib/ui/toolbarClearance';
import TakeItWithYouPanel from '@/components/admin/templates/panels/take-it-with-you-panel';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import IdentityPanel from '../templates/panels/identity-panel';
import ServicesPanel from '../templates/panels/services-panel';
import DomainPanel from '../templates/panels/domain-panel';
import SeoPanel from '../templates/panels/seo-panel';
import ThemePanel from '../templates/panels/theme-panel';
import PaymentSettingsPanel from '../payments/payment-settings-panel';
import HoursPanel from '../templates/panels/hours-panel';
import { Button } from '@/components/ui/button';
import { Save, Loader2, AlertTriangle, Check } from 'lucide-react';
import EcommercePanel from '../templates/panels/ecommerce-panel';
import * as ReactNS from 'react';
import type { Template as Tpl, Page as Pg } from '@/types/template';

type Template = Tpl;
type Page = Pg;

/* ---------------- Error boundary so a single panel can’t crash the whole sidebar ---------------- */
class PanelBoundary extends ReactNS.Component<{ name: string; children: ReactNS.ReactNode }, { err?: any }> {
  state = { err: undefined as any };
  static getDerivedStateFromError(err: any) { return { err }; }
  componentDidCatch(err: any, info: any) {
    console.error(`[PanelBoundary:${this.props.name}]`, err, info);
  }
  render() {
    if (this.state.err) {
      const msg = typeof this.state.err?.message === 'string'
        ? this.state.err.message
        : JSON.stringify(this.state.err);
      return (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            {this.props.name} encountered an error
          </div>
          <pre className="mt-1 text-xs whitespace-pre-wrap break-words">{msg}</pre>
        </div>
      );
    }
    return this.props.children as any;
  }
}

/* ---------- small util ---------- */
function useLiveRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; }, [value]);
  return ref;
}

/* ===================== Resizable settings ===================== */
const STORAGE_KEY = 'qs:sidebar:width';
const DEFAULT_WIDTH = 360;
const MIN_WIDTH = 280;
const MAX_WIDTH = 1024;
const EXPAND_WIDTH = 720;

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

/* ======= Sidebar (delegates persistence to toolbar queue) ======= */
type Props = {
  template: Template;
  onChange: (patch: Partial<Template>) => void;
  /** 'inline' (default) = resizable sidebar; 'drawer' = fills modal/drawer, no resize */
  variant?: 'inline' | 'drawer';
};

export default function SidebarSettings({ template, onChange, variant }: Props) {
  // ====== Resizable state ======
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const draggingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const startWRef = useRef<number>(0);
  const [forceOpenHours, setForceOpenHours] = useState(false);
  const hoursPanelRef = useRef<HTMLDivElement | null>(null);
  const identityPanelRef = useRef<HTMLDivElement | null>(null);
  const servicesPanelRef = useRef<HTMLDivElement | null>(null);
  const [spotlightHours, setSpotlightHours] = useState(false);

  // width bootstrap
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const w = raw ? parseInt(raw, 10) : DEFAULT_WIDTH;
      setWidth(clamp(isFinite(w) ? w : DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH));
    } catch {
      setWidth(DEFAULT_WIDTH);
    }
  }, []);

  // spotlight + scroll into Hours panel
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    function onOpenPanel(ev: Event) {
      const e = ev as CustomEvent<{ panel: string; openEditor?: boolean; scroll?: boolean; spotlightMs?: number }>;
      const panel = e.detail?.panel;
      if (!panel) return;

      const refByPanel: Record<string, { current: HTMLDivElement | null }> = {
        hours: hoursPanelRef,
        identity: identityPanelRef,
        services: servicesPanelRef,
      };
      const targetRef = refByPanel[panel];
      if (!targetRef) return;

      if (e.detail.scroll !== false) {
        targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      // Hours has an expand-on-open + spotlight affordance; the others just scroll.
      if (panel === 'hours') {
        setForceOpenHours(!!e.detail.openEditor);
        setSpotlightHours(true);
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => setSpotlightHours(false), e.detail.spotlightMs ?? 900);
      }
    }
    window.addEventListener('qs:open-settings-panel' as any, onOpenPanel as any);
    return () => {
      window.removeEventListener('qs:open-settings-panel' as any, onOpenPanel as any);
      if (timeoutId) clearTimeout(timeoutId);
    };
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

  const onHandleDoubleClick = useCallback((e: React.MouseEvent) => {
    const target = e.shiftKey ? MAX_WIDTH : EXPAND_WIDTH;
    const next = Math.abs(width - target) < 8 ? DEFAULT_WIDTH : target;
    setWidth(clamp(next, MIN_WIDTH, MAX_WIDTH));
    persistWidth(next);
  }, [width, persistWidth]);

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

  // ====== Save orchestration (delegate to toolbar queue) ======
  const tplRef = useLiveRef(template);
  const [pending, setPending] = useState(false);
  // Are there edits not yet persisted? Set on every patch, cleared when the toolbar reports a
  // successful save. Drives the save-bar: clean → "Saved", in-flight → "Saving…".
  const [dirty, setDirty] = useState(false);
  // Only surface the manual "Save now" button when a save has been outstanding for a few
  // seconds (autosave apparently didn't catch it) — otherwise the bar just reads "Saving…".
  const [staleSave, setStaleSave] = useState(false);
  const STALE_SAVE_MS = 4000;

  // The store this site sells through — meta.ecom.merchant_id, falling back to the owner's
  // merchant. `null` means "no store yet", which the Payments panel renders as such rather
  // than reporting a connection status for a merchant that doesn't exist.
  const [siteMerchantId, setSiteMerchantId] = useState<string | null>(null);
  const templateId = (template as any)?.id ?? null;
  useEffect(() => {
    if (!templateId) { setSiteMerchantId(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/commerce/site-merchant?templateId=${encodeURIComponent(templateId)}`);
        const json = await res.json().catch(() => ({}));
        if (!cancelled) setSiteMerchantId(res.ok && json?.merchantId ? String(json.merchantId) : null);
      } catch {
        if (!cancelled) setSiteMerchantId(null);
      }
    })();
    return () => { cancelled = true; };
  }, [templateId]);

  // "Saving…" is cleared by the toolbar's save-settled signal — but never let it stick if
  // that signal is missed (a failed commit, or a race where it fires before we set pending).
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPending = useCallback(() => {
    if (pendingTimerRef.current) { clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null; }
    setPending(false);
  }, []);
  const markPending = useCallback(() => {
    setPending(true);
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(() => setPending(false), 10_000); // safety fallback
  }, []);
  // A successful save settles the bar back to clean; a bare "settled" (failure) only stops the
  // spinner, leaving `dirty` so the manual button can re-offer the save.
  const markSaved = useCallback(() => { clearPending(); setDirty(false); }, [clearPending]);

  // Debounced signal to the toolbar queue
  const saveSoonRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestToolbarSaveSoon = useCallback(() => {
    if (saveSoonRef.current) clearTimeout(saveSoonRef.current);
    saveSoonRef.current = setTimeout(() => {
      markPending();
      // Wait one frame so React state settles before the toolbar snapshots tplRef.current
      requestAnimationFrame(() => {
        try {
          window.dispatchEvent(new CustomEvent('qs:toolbar:save-now', { detail: { source: 'sidebar' } }));
        } catch {}
      });
    }, 350);
  }, [markPending]);

  // Settle the save bar when the toolbar reports back: a success (qs:preview:save) marks the
  // template clean; a bare settle/failure (qs:preview:save-settled) only stops the spinner so
  // the "Saving…" state can never get stuck (and `dirty` stays, re-offering a manual save).
  useEffect(() => {
    window.addEventListener('qs:preview:save', markSaved);
    window.addEventListener('qs:preview:save-settled', clearPending);
    return () => {
      window.removeEventListener('qs:preview:save', markSaved);
      window.removeEventListener('qs:preview:save-settled', clearPending);
    };
  }, [markSaved, clearPending]);

  // Reveal the manual "Save now" button only after edits have gone unsaved for a few seconds —
  // i.e. autosave hasn't settled them. A successful save flips `dirty` off and hides it again.
  useEffect(() => {
    if (!dirty) { setStaleSave(false); return; }
    const t = setTimeout(() => setStaleSave(true), STALE_SAVE_MS);
    return () => clearTimeout(t);
  }, [dirty]);

  // Unified patch applier: update local template state, then queue a save via toolbar
  const applyPatch = useCallback(
    (patch: Partial<Template>) => {
      const next = mergeTemplate(tplRef.current, patch);
      onChange(next as Partial<Template>);
      setDirty(true);
      requestToolbarSaveSoon();
    },
    [onChange, requestToolbarSaveSoon, tplRef]
  );

  const applyPages = useCallback(
    (pages: Page[]) => {
      applyPatch({ pages, data: { ...(template.data ?? {}), pages } as any });
    },
    [applyPatch, template.data]
  );

  const saveNow = useCallback(() => {
    markPending();
    setStaleSave(false);
    requestAnimationFrame(() => {
      try {
        window.dispatchEvent(new CustomEvent('qs:toolbar:save-now', { detail: { source: 'sidebar:button' } }));
      } catch {}
    });
  }, [markPending]);

  // ====== Derive active page for block-insertion helpers (home → first → 'home') ======
  const activePageId = useMemo(() => {
    const pages = getPages(template);
    const byHome = pages.find((p) => p?.slug === 'home')?.id;
    return byHome || pages[0]?.id || 'home';
  }, [template]);

  // ====== Content ======
  const content = useMemo(() => (
    <div
      className={
        variant === 'drawer'
          // ⚠️ Bottom padding, not just overflow: the floating editor toolbar sits over the
          // last ~6rem of the viewport at the z-index ceiling, so without this the final rows
          // of settings (and any button among them) are unreachable while it is on screen.
          // See lib/ui/toolbarClearance.ts — third panel to hit this.
          ? `flex-1 overflow-y-auto overflow-x-auto h-full ${TOOLBAR_CLEARANCE_PADDING}`
          : `space-y-4 px-4 pt-2 h-full overflow-y-auto ${TOOLBAR_CLEARANCE_PADDING}`
      }
      id="sidebar-settings-inner"
    >
      {/* Sticky save bar — resting state reads "Saved"; a save in flight shows "Saving…";
          the manual button only appears once edits have been unsaved for a few seconds. */}
      <div className="sticky top-0 z-10 -mx-4 mb-2 border-b bg-background/95 px-4 py-2 backdrop-blur flex items-center gap-2 min-h-[2.25rem]">
        {pending ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
          </span>
        ) : dirty && staleSave ? (
          <>
            <Button size="sm" className="gap-2" onClick={saveNow}>
              <Save className="h-3.5 w-3.5" /> Save now
            </Button>
            <span className="text-xs text-muted-foreground">Autosave hasn’t caught these yet</span>
          </>
        ) : dirty ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-emerald-500" /> Saved
          </span>
        )}
      </div>

      {/* Theme, Identity, Services */}
      <ThemePanel template={template} onChange={(patch) => applyPatch(patch)} />
      <div ref={identityPanelRef}>
        <IdentityPanel template={template} onChange={(patch) => applyPatch(patch)} />
      </div>
      <div ref={servicesPanelRef}>
        <ServicesPanel template={template} onChange={(patch) => applyPatch(patch)} />
      </div>

      {/* Domain (no onChange; read-only UI + programmatic connect/verify/remove) */}
      <PanelBoundary name="DomainPanel">
        <DomainPanel
          key={(template as any)?.id ?? 'domain'}
          template={template}
          isSite={Boolean((template as any)?.is_site)}
          variant={variant}
        />
      </PanelBoundary>

      {/* ⚠️ RESTORED 2026-08-11. Added to the dead settings file by #613 and therefore never
          rendered: the site-backdrop picker shipped as "an editor picker" and was invisible for
          two weeks. `slug`, `mascot` and `screensaver` panels are stranded the same way and are
          NOT restored here — that is a UI decision, and quietly adding four panels to somebody's
          sidebar is not mine to make. They are listed in the dead file's header. */}
      <PanelBoundary name="BackdropPanel">
        <BackdropPanel template={template} onChange={(patch: any) => applyPatch(patch)} />
      </PanelBoundary>

      {/* ⚠️ Leaving is a first-class action, not a support ticket — the button IS the trust signal
          (see the panel). Placed here rather than in
          `components/admin/templates/template-settings-panel.tsx`, which has a nearly identical
          name, renders the same panels, and is imported by NOTHING. I shipped this there first and
          told Sandon to press a button that could not be reached. */}
      <PanelBoundary name="TakeItWithYouPanel">
        <TakeItWithYouPanel
          templateId={(template as any)?.id}
          slug={(template as any)?.slug}
          published={!!(template as any)?.published}
        />
      </PanelBoundary>

      {/* SEO */}
      <PanelBoundary name="SeoPanel">
        <SeoPanel template={template} onChange={(patch) => applyPatch(patch)} />
      </PanelBoundary>

      {/* Hours (renders its own shared CollapsiblePanel — matches the other sections) */}
      <HoursPanel
        template={template}
        onChange={(patch) => applyPatch(patch)}
        panelRef={hoursPanelRef as any}
        forceOpenEditor={forceOpenHours}
        spotlight={spotlightHours}
      />

      {/* E-commerce panel */}
      <PanelBoundary name="EcommercePanel">
        <EcommercePanel templateId={(template as any)?.id ?? null} currentPageId={activePageId} />
      </PanelBoundary>

      {/*
        Payments (separate flow).

        ⚠️ This panel spent its whole life wired to merchantId={'00001'} — a placeholder that is
        not a uuid and not a merchant. Every site therefore showed "Not connected" and a 0.75%
        fee no matter what its real Stripe account said, and pressing "Enable payouts" surfaced
        `invalid input syntax for type uuid: "00001"`. A panel reporting a plausible-looking
        status for a merchant that does not exist is worse than no panel: it answers the question
        "am I connected?" with a confident lie, on the one screen an owner goes to to check.

        Render it only once we know which store this site sells through.
      */}
      {siteMerchantId ? (
        <PanelBoundary name="PaymentSettingsPanel">
          <PaymentSettingsPanel merchantId={siteMerchantId} initialPlatformFeeBps={75} />
        </PanelBoundary>
      ) : (
        <div className="rounded-md border border-border/60 bg-card/40 p-3 text-sm text-muted-foreground">
          <div className="font-medium text-foreground">Payments</div>
          No store on this site yet. Enable ordering on a menu or products block first — that
          creates the store these settings belong to.
        </div>
      )}
    </div>
  ), [activePageId, applyPatch, dirty, forceOpenHours, pending, saveNow, siteMerchantId, staleSave, spotlightHours, template, variant]);

  return (
    <aside
      className={variant === 'drawer'
        ? "relative flex-shrink-0 border-l flex flex-col h-full w-full max-w-full"
        : "relative flex-shrink-0 border-r"
      }
      style={
        variant === 'drawer'
          ? undefined
          : { width: `${width}px`, minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH }
      }
      aria-label="Template settings sidebar"
    >
      {content}

      {/* Resize handle */}
      {variant !== 'drawer' && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          tabIndex={0}
          onPointerDown={beginDrag}
          onDoubleClick={onHandleDoubleClick}
          onKeyDown={onHandleKeyDown}
          className={[
            'absolute top-0 right-0 h-full z-30',
            'w-3 cursor-col-resize touch-none select-none',
            'bg-foreground/10 hover:bg-foreground/20 active:bg-foreground/30',
            'transition-colors rounded-l',
          ].join(' ')}
          title="Drag to resize • Double-click to expand • Shift+Double-click for max • Shift+Arrow for bigger steps • R to reset"
        />
      )}
    </aside>
  );
}
