// components/admin/templates/autogen-runner.tsx
'use client';

// Mounted by the editor page when a template carries data.meta.autogen_pending
// (set by the guest-build homepage flow). On first open it fires the server-side
// autogenerate (AI copy + hero image), then refreshes the editor to show the
// result — so the visitor gets a populated site without opening the hero editor.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AutogenRunner({ templateId }: { templateId: string }) {
  const router = useRouter();
  const ran = useRef(false);
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle');

  useEffect(() => {
    if (ran.current) return;
    // Guard against refresh / StrictMode re-mounts firing a second generation.
    const key = `qs:autogen:${templateId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {}
    ran.current = true;
    setStatus('running');

    (async () => {
      try {
        const res = await fetch(`/api/templates/${templateId}/autogenerate`, { method: 'POST' });
        if (!res.ok) throw new Error(`autogenerate failed (${res.status})`);
        router.refresh(); // reload the editor with the generated copy + hero
      } catch (e) {
        console.error('[autogen]', e);
        setStatus('error');
      }
    })();
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
