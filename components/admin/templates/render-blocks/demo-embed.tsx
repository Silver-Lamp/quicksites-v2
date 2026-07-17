'use client';

// components/admin/templates/render-blocks/demo-embed.tsx
//
// HJ demo embed (crosstalk/contracts/demo-embed.md, LIVE): render an approved +
// published HiveJournal studio demo by slug. Preference order per contract:
//   1. MP4 (poster + <video>) when the render is ready (catalog carries
//      video_url/poster_url — permanent, unsigned).
//   2. Live caption-player fallback: the /prepared endpoint's ordered steps
//      { caption, say, dwell_ms, audio_url } — show caption, play house-voice
//      narration, advance on audio end (dwell for silent steps).
// Labeling rule (contract-bound): these are narrated walkthroughs with caption
// frames — presented as exactly that, never implied screen recordings.

import * as React from 'react';
import type { Block } from '@/types/blocks';

const HJ_API = 'https://hivejournalbackend-production.up.railway.app/api/studio-demos/public';

type Props = { block?: Block; content?: Block['content']; previewOnly?: boolean };

type CatalogDemo = {
  slug: string;
  title: string;
  description?: string;
  video_url: string | null;
  poster_url: string | null;
};
type PreparedStep = { caption: string; say?: string; dwell_ms?: number; audio_url?: string | null };

export default function RenderDemoEmbed({ block, content, previewOnly }: Props) {
  const c: any = content ?? block?.content ?? {};
  const slug: string = typeof c.slug === 'string' ? c.slug.trim() : '';
  const widthRaw: string = typeof c.width === 'string' ? c.width.trim() : '';
  const maxWidth = /^\d+(\.\d+)?$/.test(widthRaw) ? `${widthRaw}px` : widthRaw || '720px';

  const [demo, setDemo] = React.useState<CatalogDemo | null>(null);
  const [steps, setSteps] = React.useState<PreparedStep[] | null>(null);
  const [stepIdx, setStepIdx] = React.useState(-1); // -1 = not started
  const [failed, setFailed] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!slug) return;
    let active = true;
    (async () => {
      try {
        const cat = await fetch(HJ_API, { cache: 'no-store' }).then((r) => r.json());
        const hit: CatalogDemo | undefined = (cat?.demos ?? []).find((d: CatalogDemo) => d.slug === slug);
        if (!active) return;
        if (!hit) { setFailed(true); return; }
        setDemo(hit);
        if (!hit.video_url) {
          const prep = await fetch(`${HJ_API}/${encodeURIComponent(slug)}/prepared`, { cache: 'no-store' }).then((r) =>
            r.ok ? r.json() : null,
          );
          if (active && prep?.prepared) setSteps(prep.prepared);
        }
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => { active = false; };
  }, [slug]);

  // Live caption-player: advance on narration end; dwell for silent steps.
  const playStep = React.useCallback((idx: number, list: PreparedStep[]) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (idx >= list.length) { setStepIdx(-1); return; }
    setStepIdx(idx);
    const step = list[idx];
    if (step.audio_url) {
      const a = new Audio(step.audio_url);
      audioRef.current = a;
      a.onended = () => playStep(idx + 1, list);
      a.onerror = () => { timerRef.current = setTimeout(() => playStep(idx + 1, list), step.dwell_ms ?? 2500); };
      void a.play().catch(() => { timerRef.current = setTimeout(() => playStep(idx + 1, list), step.dwell_ms ?? 2500); });
    } else {
      timerRef.current = setTimeout(() => playStep(idx + 1, list), step.dwell_ms ?? 2500);
    }
  }, []);

  React.useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (audioRef.current) audioRef.current.pause();
  }, []);

  if (!slug) {
    const inIframe = typeof window !== 'undefined' && window.parent !== window;
    if (!previewOnly && !inIframe) return null;
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-4">
        <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          🎬 <b>Demo</b> — pick a HiveJournal demo slug to embed a narrated walkthrough.
        </div>
      </section>
    );
  }
  if (failed) return null; // unapproved/unknown demo: render nothing on the public site

  return (
    <section className="mx-auto w-full px-4 py-6" style={{ maxWidth }}>
      {demo?.video_url ? (
        <figure>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- narration IS the audio track; captions render in-video */}
          <video
            src={demo.video_url}
            poster={demo.poster_url ?? undefined}
            controls
            playsInline
            className="w-full rounded-2xl border border-border shadow-sm"
          />
          <figcaption className="mt-1.5 text-xs text-muted-foreground">
            {demo.title} — narrated walkthrough
          </figcaption>
        </figure>
      ) : steps ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">{demo?.title ?? 'Demo'}</div>
            <button
              type="button"
              onClick={() => (stepIdx === -1 ? playStep(0, steps) : playStep(steps.length, steps))}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              {stepIdx === -1 ? '▶ Play walkthrough' : '■ Stop'}
            </button>
          </div>
          <div className="mt-4 min-h-[4.5rem] rounded-xl bg-muted/50 p-4 text-base leading-relaxed">
            {stepIdx >= 0 ? steps[stepIdx]?.caption : (demo?.description || 'A narrated, step-by-step walkthrough.')}
          </div>
          {stepIdx >= 0 && (
            <div className="mt-2 text-xs text-muted-foreground tabular-nums">
              Step {stepIdx + 1} of {steps.length}
            </div>
          )}
          <div className="mt-2 text-[11px] text-muted-foreground/70">Narrated walkthrough · powered by HiveJournal</div>
        </div>
      ) : (
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-muted/40" aria-hidden />
      )}
    </section>
  );
}
