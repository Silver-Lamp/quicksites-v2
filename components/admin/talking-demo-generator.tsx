'use client';

// components/admin/talking-demo-generator.tsx
//
// Admin "Generate Talking Demo" panel: given a template (slug or id), auto-build the tour script
// from its blocks and render it via HJ — the narrated audio tour + the shareable MP4 reel (the site
// narrating + scrolling through itself). Calls POST /api/admin/talking-demo/render, then polls
// GET /api/admin/talking-demo/:instance_id until the MP4 is ready.
//
// The render is cached by instance_ref (deterministic script → free re-renders), and every URL is
// permanent — so a generated tour can be baked into the site / an outreach QR later.

import * as React from 'react';
import TalkingDemoTour from '@/components/site/talking-demo-tour';
import type { TourStep, RenderedStep } from '@/lib/talkingDemo/types';

type RenderResult = {
  instance_id: string;
  steps: RenderedStep[];
  mp4_status: 'rendering' | 'ready' | 'skipped' | 'failed';
  mp4_url: string | null;
  poster_url?: string | null;
  voice_basis?: string;
  usage?: { render_chars?: number; billed?: boolean };
};

export default function TalkingDemoGenerator({ initialRef = '' }: { initialRef?: string }) {
  const [ref, setRef] = React.useState(initialRef);
  const [voice, setVoice] = React.useState<'house' | 'owner_clone'>('house');
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [script, setScript] = React.useState<TourStep[] | null>(null);
  const [result, setResult] = React.useState<RenderResult | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState<{ watch_url: string; qr_data_url: string } | null>(null);

  const poll = async (instanceId: string): Promise<RenderResult> => {
    const r = await fetch(`/api/admin/talking-demo/${encodeURIComponent(instanceId)}`, { credentials: 'include' });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || 'poll failed');
    return j.render as RenderResult;
  };

  const generate = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setScript(null);
    setSaved(null);
    setStatus('Building the tour script…');
    try {
      const r = await fetch('/api/admin/talking-demo/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ templateId: ref.trim(), wantMp4: true, voice }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'render failed');
      setScript((j.script?.steps ?? []) as TourStep[]);
      if (!j.render) {
        setStatus(j.configured === false ? 'Script ready (render not configured — set PARTNER_QUICKSITES_SECRET).' : 'Script ready.');
        return;
      }
      let res = j.render as RenderResult;
      setResult(res);
      setStatus('Narration ready. Rendering the MP4 reel…');
      for (let i = 0; i < 30 && res.mp4_status === 'rendering'; i++) {
        await new Promise((x) => setTimeout(x, 3000));
        res = await poll(res.instance_id);
        setResult(res);
        setStatus(`MP4: ${res.mp4_status}…`);
      }
      setStatus(res.mp4_status === 'ready' ? '✅ Done — audio tour + MP4 reel ready.' : `Audio ready · MP4 ${res.mp4_status}.`);
    } catch (e: any) {
      setError(e?.message || 'Failed');
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!result?.mp4_url) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/talking-demo/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          templateId: ref.trim(),
          mp4_url: result.mp4_url,
          poster_url: result.poster_url,
          steps: result.steps,
          instance_id: result.instance_id,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'save failed');
      setSaved({ watch_url: j.watch_url, qr_data_url: j.qr_data_url });
    } catch (e: any) {
      setError(e?.message || 'save failed');
    } finally {
      setSaving(false);
    }
  };

  const input = 'rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Template (slug or id)
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="starter-junk-removal"
            className={`${input} w-72`}
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Voice
          <select value={voice} onChange={(e) => setVoice(e.target.value as any)} className={`${input} h-9`}>
            <option value="house">House / narrator</option>
            <option value="owner_clone">Owner's own voice (needs a grant)</option>
          </select>
        </label>
        <button
          type="button"
          onClick={generate}
          disabled={busy || !ref.trim()}
          className="h-9 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Generating…' : '🎬 Generate Talking Demo'}
        </button>
      </div>

      {status && <p className="text-sm text-muted-foreground">{status}</p>}
      {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</div>}

      {script && (
        <div className="rounded-xl border border-border p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tour script ({script.length} steps)</div>
          <ol className="space-y-1.5 text-sm">
            {script.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 font-semibold text-primary">{i + 1}.</span>
                <span>
                  <span className="font-medium">[{s.caption}]</span>{' '}
                  {s.action && <span className="text-xs text-muted-foreground">({s.action})</span>} {s.say}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            instance {result.instance_id} · voice {result.voice_basis ?? '—'}
            {result.usage ? ` · ${result.usage.render_chars ?? 0} chars · ${result.usage.billed ? 'billed' : 'cached (free)'}` : ''}
          </div>

          {result.mp4_url ? (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">The reel</div>
              <TalkingDemoTour steps={result.steps} mp4Url={result.mp4_url} posterUrl={result.poster_url} headline="Talking Demo reel" />
              <a href={result.mp4_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary hover:underline">
                Open the MP4 ↗
              </a>

              {/* Outreach packaging: save the reel to the site's watch page + get a scannable QR. */}
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                {!saved ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={save}
                      disabled={saving}
                      className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : '💾 Save to watch page + get QR'}
                    </button>
                    <span className="text-xs text-muted-foreground">Publishes a phone-friendly “here’s the site we built you” page + a scannable QR for outreach.</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={saved.qr_data_url} alt="Scan to watch" width={128} height={128} className="h-32 w-32 shrink-0 rounded-lg bg-white p-1.5" />
                    <div className="min-w-0 text-sm">
                      <div className="font-semibold text-emerald-600 dark:text-emerald-300">✅ Saved — scan to watch</div>
                      <a href={saved.watch_url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-primary hover:underline">
                        {saved.watch_url}
                      </a>
                      <p className="mt-1 text-xs text-muted-foreground">Print this QR on a postcard/yard sign — scanning opens the reel + the claimable site.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Audio tour</div>
              <TalkingDemoTour steps={result.steps} headline="Talking Demo" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
