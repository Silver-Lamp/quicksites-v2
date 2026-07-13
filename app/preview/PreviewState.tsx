// app/preview/PreviewState.tsx
'use client';

import * as React from 'react';
import { Sun, Moon, Shuffle } from 'lucide-react';
import EditorSiteRenderer from '@/components/sites/editor-site-renderer';
import { shuffleAllData } from '@/lib/theme/shuffleTemplate';

/** Floating "Shuffle" pill for the standalone preview — one tap restyles the whole
 *  site (new theme + layout + palette + fonts) while keeping all copy. Owners have
 *  it saved back to the template; non-owners get a view-only restyle. Sits just above
 *  the color toggle. */
function PreviewShuffleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Shuffle everything — new theme, layout, palette & fonts (keeps your content)"
      aria-label="Shuffle the design"
      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg ring-1 ring-white/20 transition hover:brightness-110 active:scale-95"
    >
      <Shuffle className="h-4 w-4" />
      Shuffle the look
    </button>
  );
}

/** Floating light/dark switch for the standalone preview. View-only — it changes how
 *  the preview looks without saving to the template (that's the editor's job). Fixed
 *  bottom-right, high z-index, legible on either background. */
function PreviewColorToggle({
  mode,
  onChange,
  note,
}: {
  mode: 'light' | 'dark';
  onChange: (m: 'light' | 'dark') => void;
  note?: string;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-1">
      {note && (
        <span className="rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white shadow-sm backdrop-blur">
          {note}
        </span>
      )}
      <div
        role="group"
        aria-label="Preview color mode"
        className="flex items-center gap-0.5 rounded-full border border-black/10 bg-white/90 p-1 shadow-lg backdrop-blur dark:border-white/15 dark:bg-neutral-900/90"
      >
        {(['light', 'dark'] as const).map((m) => {
          const active = mode === m;
          const Icon = m === 'light' ? Sun : Moon;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onChange(m)}
              aria-pressed={active}
              title={`${m === 'light' ? 'Light' : 'Dark'} mode`}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="capitalize">{m}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type PreviewStateProps = {
  initialSite: any;
  page: string;
  colorMode: 'light' | 'dark';
  className?: string;
  id?: string;
  editorChrome?: boolean;
  baseUrl?: string;   // ← keep this here
  /** When the viewer owns this template, its id — the standalone toggle then SAVES
   *  the chosen color mode back to the template (via /api/templates/commit). Null/
   *  absent for non-owners → the toggle is view-only. */
  persistTemplateId?: string | null;
};

export default function PreviewState({
  initialSite,
  page,
  colorMode,
  className,
  id = 'site-renderer-page',
  editorChrome,
  baseUrl,
  persistTemplateId,
}: PreviewStateProps) {
  const [site, setSite] = React.useState<any>(initialSite);
  // Local color mode so the preview flips instantly. Seeded from the template's saved
  // mode; stays in sync with editor-driven changes below.
  const [mode, setMode] = React.useState<'light' | 'dark'>(colorMode);
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved'>('idle');
  React.useEffect(() => { setMode(colorMode); }, [colorMode]);

  const setModeAndRemember = React.useCallback((m: 'light' | 'dark') => {
    setMode(m);
    try { localStorage.setItem('qs:preview:color', m); } catch {}
    // Owners persist the choice back to the template (sanctioned commit RPC path).
    if (!persistTemplateId) return;
    setSaveState('saving');
    fetch('/api/templates/commit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: persistTemplateId, patch: { color_mode: m }, kind: 'save' }),
    })
      .then((r) => setSaveState(r.ok ? 'saved' : 'idle'))
      .catch(() => setSaveState('idle'));
  }, [persistTemplateId]);

  // One-tap "Shuffle everything" — reuses the exact transform the editor toolbar
  // uses (lib/theme/shuffleTemplate), so the standalone preview restyles identically.
  // Reads the LATEST site so repeated shuffles build on the current look (and avoid
  // repeating the same theme). Owners persist via the same commit path as the toggle.
  const shuffle = React.useCallback(() => {
    const { data, colorMode } = shuffleAllData(site?.data ?? {}, {
      industry: site?.data?.meta?.industry ?? site?.industry ?? null,
    });
    setSite((prev: any) => ({ ...prev, color_mode: colorMode, data, pages: data.pages }));
    setMode(colorMode);
    try { localStorage.setItem('qs:preview:color', colorMode); } catch {}
    if (!persistTemplateId) return;
    setSaveState('saving');
    fetch('/api/templates/commit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: persistTemplateId, patch: { data, color_mode: colorMode }, kind: 'save' }),
    })
      .then((r) => setSaveState(r.ok ? 'saved' : 'idle'))
      .catch(() => setSaveState('idle'));
  }, [site, persistTemplateId]);

  const resolvedBaseUrl = React.useMemo(() => {
    if (baseUrl) return baseUrl;
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  }, [baseUrl]);

  // Follow color-mode changes coming from the editor (same-window CustomEvent when the
  // toolbar toggles, so the embedded preview updates live without a reload).
  React.useEffect(() => {
    function onColor(e: Event) {
      const m = (e as CustomEvent).detail;
      if (m === 'light' || m === 'dark') setMode(m);
    }
    window.addEventListener('qs:preview:set-color-mode', onColor as EventListener);
    return () => window.removeEventListener('qs:preview:set-color-mode', onColor as EventListener);
  }, []);

  React.useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data as any;
      if (!d || typeof d !== 'object') return;
      if ((d.type === 'preview:init' || d.type === 'preview:change') && d.template) {
        setSite((prev: any) => {
          const next = { ...prev, ...d.template };
          if (d.template?.data?.pages || d.template?.pages) {
            next.data = { ...(prev?.data ?? {}), ...(d.template?.data ?? {}) };
          }
          return next;
        });
        // Reflect a color-mode change the editor pushed (embedded preview).
        const cm = d.template?.color_mode ?? d.template?.data?.color_mode;
        if (cm === 'light' || cm === 'dark') setMode(cm);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // "Click to edit header/footer" affordance: the rendered header/footer post a
  // `qs:edit-header` / `qs:edit-footer` message to window.parent. Inside the editor
  // iframe the parent is the editor, which opens the panel. On the STANDALONE
  // preview page (top-level tab, e.g. the guest Preview link) window.parent is this
  // same window and no editor is listening — so the click did nothing. Here we catch
  // it and send the owner into the editor, auto-opening the matching panel.
  React.useEffect(() => {
    if (typeof window === 'undefined' || window.self !== window.top) return;
    function onEdit(e: MessageEvent) {
      const t = (e.data as any)?.type;
      if (t !== 'qs:edit-header' && t !== 'qs:edit-footer') return;
      const which = t === 'qs:edit-header' ? 'header' : 'footer';
      const sp = new URLSearchParams(window.location.search);
      const id = sp.get('template_id') || site?.id;
      if (!id) return;
      window.location.href = `/admin/templates/${id}?edit=${which}`;
    }
    window.addEventListener('message', onEdit);
    return () => window.removeEventListener('message', onEdit);
  }, [site?.id]);

  // Show the floating toggle only on the standalone preview (top-level tab). When
  // embedded in the editor (editorChrome), the editor toolbar owns the switch.
  const [isTopLevel, setIsTopLevel] = React.useState(false);
  React.useEffect(() => {
    setIsTopLevel(typeof window !== 'undefined' && window.self === window.top);
  }, []);
  const showToggle = isTopLevel && !editorChrome;

  // Add the `dark` class in dark mode so Tailwind `dark:` utilities on the wrapper
  // (e.g. dark:bg-black) resolve — block content already flips via the colorMode prop.
  const themedClassName = mode === 'dark' ? `${className ?? ''} dark`.trim() : className;

  return (
    <>
      <EditorSiteRenderer
        site={site}
        page={page}
        id={id}
        colorMode={mode}
        className={themedClassName}
        editorChrome={editorChrome}
        baseUrl={resolvedBaseUrl}
      />
      {showToggle && (
        <>
          <div className="fixed bottom-20 right-4 z-[9999]">
            <PreviewShuffleButton onClick={shuffle} />
          </div>
          <PreviewColorToggle
            mode={mode}
            onChange={setModeAndRemember}
            note={saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved to your site' : undefined}
          />
        </>
      )}
    </>
  );
}
