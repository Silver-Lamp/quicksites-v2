'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';

/** Admin-only: generate N AI demo sites, then refresh the list. */
export default function GenerateDemosButton() {
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (busy) return;
    const raw = window.prompt('How many AI demo sites to generate? (1–5)', '1');
    if (raw == null) return;
    const count = Math.min(5, Math.max(1, Math.floor(Number(raw) || 0)));
    if (!count) return;
    if (!window.confirm(`Generate ${count} AI demo site(s)? Each uses OpenAI (~$0.05–0.15) and is published + tagged is_demo.`)) {
      return;
    }

    setBusy(true);
    const t = toast.loading(`Generating ${count} demo site(s)… this can take ~30s each`);
    // Tell the list to show shimmer placeholders + poll while we generate.
    window.dispatchEvent(new CustomEvent('qs:demos:generating', { detail: { count } }));
    try {
      const res = await fetch('/api/admin/demos/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Generation failed');
      toast.success(`Created ${j.created ?? 0}/${count} demo site(s)`, { id: t });
    } catch (e: any) {
      toast.error(e?.message || 'Generation failed', { id: t });
    } finally {
      setBusy(false);
      window.dispatchEvent(new Event('qs:demos:done'));
    }
  }

  return (
    <button
      onClick={generate}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-60"
      title="Generate AI demo sites"
    >
      <Sparkles className="h-4 w-4" /> {busy ? 'Generating…' : 'Generate demos'}
    </button>
  );
}
