'use client';

// components/site/talking-demo-tour.tsx
//
// Talking Demo Tier 2 player — the stepped, narrated tour. Given HJ's rendered steps
// ([{caption, say, audio_url}]) it plays each step's narration, shows the caption, and advances on
// audio end (+ any dwell). This is the audio-tour surface (want_mp4:false); when an mp4_url is
// available it plays that instead. Consumes lib/talkingDemo/renderClient output.
//
// Dormant until HJ's render endpoint + the shared secret are live (crosstalk/contracts/
// talking-demo-render.md) — this just renders whatever rendered steps it's handed.

import * as React from 'react';
import type { RenderedStep } from '@/lib/talkingDemo/types';

export default function TalkingDemoTour({
  steps,
  mp4Url,
  posterUrl,
  headline = 'Talking Demo',
  className = '',
}: {
  steps: RenderedStep[];
  mp4Url?: string | null;
  /** First caption card / thumbnail for the MP4 reel (Phase B poster_url). */
  posterUrl?: string | null;
  headline?: string;
  className?: string;
}) {
  const [i, setI] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const valid = Array.isArray(steps) ? steps.filter((s) => s && s.audio_url) : [];
  const cur = valid[Math.min(i, Math.max(0, valid.length - 1))];

  React.useEffect(() => {
    const a = audioRef.current;
    if (!a || !cur) return;
    a.src = cur.audio_url;
    if (playing) a.play().catch(() => setPlaying(false));
  }, [i, cur, playing]);

  const onEnded = () => {
    if (i < valid.length - 1) setI((n) => n + 1);
    else setPlaying(false);
  };
  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      setPlaying(true);
      a.play().catch(() => setPlaying(false));
    }
  };

  // A rendered MP4 is the richest form — play it directly when present.
  if (mp4Url) {
    return (
      <div className={`overflow-hidden rounded-2xl border border-emerald-500/30 bg-black ${className}`}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video src={mp4Url} poster={posterUrl || undefined} controls playsInline className="w-full" />
      </div>
    );
  }

  if (!valid.length) return null;

  return (
    <div className={`rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-4 sm:p-5 ${className}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause tour' : 'Play tour'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg text-zinc-950 transition hover:bg-emerald-400"
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wide text-emerald-300">🔊 {headline}</div>
          <div className="truncate text-sm font-medium text-emerald-50">{cur?.caption}</div>
        </div>
        <div className="ml-auto text-xs tabular-nums text-emerald-200/70">
          {Math.min(i + 1, valid.length)} / {valid.length}
        </div>
      </div>

      {/* Step progress */}
      <div className="mt-3 flex gap-1">
        {valid.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setI(idx)}
            aria-label={`Go to step ${idx + 1}`}
            className={`h-1.5 flex-1 rounded-full transition ${idx <= i ? 'bg-emerald-400' : 'bg-emerald-500/20'}`}
          />
        ))}
      </div>

      <audio ref={audioRef} onEnded={onEnded} preload="none" />
    </div>
  );
}
