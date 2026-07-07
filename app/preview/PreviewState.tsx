// app/preview/PreviewState.tsx
'use client';

import * as React from 'react';
import { Sun, Moon } from 'lucide-react';
import EditorSiteRenderer from '@/components/sites/editor-site-renderer';

/** Floating light/dark switch for the standalone preview. View-only — it changes how
 *  the preview looks without saving to the template (that's the editor's job). Fixed
 *  bottom-right, high z-index, legible on either background. */
function PreviewColorToggle({ mode, onChange }: { mode: 'light' | 'dark'; onChange: (m: 'light' | 'dark') => void }) {
  return (
    <div
      role="group"
      aria-label="Preview color mode"
      className="fixed bottom-4 right-4 z-[9999] flex items-center gap-0.5 rounded-full border border-black/10 bg-white/90 p-1 shadow-lg backdrop-blur dark:border-white/15 dark:bg-neutral-900/90"
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
};

export default function PreviewState({
  initialSite,
  page,
  colorMode,
  className,
  id = 'site-renderer-page',
  editorChrome,
  baseUrl,
}: PreviewStateProps) {
  const [site, setSite] = React.useState<any>(initialSite);
  // Local, view-only color mode so the preview can be flipped without saving. Seeded
  // from the template's saved mode; stays in sync with editor-driven changes below.
  const [mode, setMode] = React.useState<'light' | 'dark'>(colorMode);
  React.useEffect(() => { setMode(colorMode); }, [colorMode]);

  const setModeAndRemember = React.useCallback((m: 'light' | 'dark') => {
    setMode(m);
    try { localStorage.setItem('qs:preview:color', m); } catch {}
  }, []);

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
      {showToggle && <PreviewColorToggle mode={mode} onChange={setModeAndRemember} />}
    </>
  );
}
