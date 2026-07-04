// components/admin/templates/autogen-runner.tsx
'use client';

// Mounted by the editor page when a template carries data.meta.autogen_pending
// (set by the guest-build homepage flow). On first open it fires the server-side
// autogenerate (AI copy + hero image), then refreshes the editor to show the
// result — so the visitor gets a populated site without opening the hero editor.
import { useEffect, useRef, useState } from 'react';

export default function AutogenRunner({ templateId }: { templateId: string }) {
  const ran = useRef(false);
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle');

  useEffect(() => {
    if (ran.current) return;
    // Guard against a second generation from refresh / StrictMode re-mounts AND
    // from a second browser tab. localStorage is shared across tabs (sessionStorage
    // is per-tab), so opening the editor in two tabs no longer fires autogenerate
    // twice. Set before the fetch so a near-simultaneous second mount bails.
    const key = `qs:autogen:${templateId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {}
    ran.current = true;
    setStatus('running');
    // Signal the hero renderer to show a shimmer over the (still-empty) hero.
    document.documentElement.dataset.qsAutogen = 'running';

    (async () => {
      try {
        const res = await fetch(`/api/templates/${templateId}/autogenerate`, { method: 'POST' });
        if (!res.ok) throw new Error(`autogenerate failed (${res.status})`);
        // Drop any stale editor draft cached before autogen so the reload loads the
        // freshly-committed template (with the generated hero) from the DB.
        try {
          localStorage.removeItem(`draft-${templateId}`);
          sessionStorage.removeItem(`draft-${templateId}`);
        } catch {}
        // Hard reload (not router.refresh): the editor keeps its own React state
        // from the initial mount, so a soft refresh re-fetches the server data but
        // the client editor never re-syncs the generated copy + hero image. A full
        // reload re-mounts the editor with the committed data. Safe here — autogen
        // runs on first open before the guest has edited, and autogen_pending is now
        // false so this won't re-trigger.
        window.location.reload();
      } catch (e) {
        console.error('[autogen]', e);
        setStatus('error');
      } finally {
        delete document.documentElement.dataset.qsAutogen;
      }
    })();

    return () => {
      delete document.documentElement.dataset.qsAutogen;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  if (status !== 'running') return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-3 bg-sky-600/95 px-4 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur"
      role="status"
      aria-live="polite"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ✨ Generating your site — writing your copy and a hero image (~20s)…
    </div>
  );
}
