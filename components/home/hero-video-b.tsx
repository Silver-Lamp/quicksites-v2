'use client';

// components/home/hero-video-b.tsx — variant B's hero background: a short looping video behind
// the same scrim the motif image uses, plus a sound toggle when the clip carries audio.
//
// ⚠️ Audio-honesty standard (crosstalk/contracts/audio-honesty-standard.md): autoplay is MUTED,
// sound is user-initiated, and the toggle says what it does. Browsers refuse unmuted autoplay
// anyway, so there is no honest version that starts loud.
import * as React from 'react';
import type { HomepageAbB } from '@/lib/ab/homepage';

export default function HeroVideoB({ b }: { b: HomepageAbB }) {
  const ref = React.useRef<HTMLVideoElement | null>(null);
  const [sound, setSound] = React.useState(false);
  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    const next = !sound;
    v.muted = !next;
    if (next) v.play().catch(() => undefined);
    setSound(next);
  };
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" data-hero-video-b>
        <video
          ref={ref}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: 0.5 }}
          src={b.video_url}
          poster={b.poster_url}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950/20 to-zinc-950" />
      </div>
      {b.has_audio ? (
        <button
          type="button"
          onClick={toggle}
          aria-pressed={sound}
          className="absolute right-4 top-4 z-20 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/20 bg-zinc-950/70 px-4 py-2 text-sm text-white backdrop-blur hover:bg-zinc-900"
        >
          {sound ? '🔊 Sound on' : '🔇 Sound off — tap for sound'}
        </button>
      ) : null}
    </>
  );
}
