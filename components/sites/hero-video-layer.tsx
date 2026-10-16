'use client';

// components/sites/hero-video-layer.tsx — a looping video as a hero background: muted autoplay,
// the hero image as poster, a "tap for sound" toggle only when the clip carries audio. Shared by
// the hero's background / full_bleed layouts (and by extension any site A/B variant B).
//
// ⚠️ Audio-honesty standard: never starts with sound, the toggle says what it does, and the
// narration (when there is any) is labelled by whoever produced it — the hero's `video_has_audio`
// flag is set by the owner, not inferred.
import * as React from 'react';

export function HeroVideoLayer({ src, poster, hasAudio, blur }: { src: string; poster?: string; hasAudio: boolean; blur?: string }) {
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
      <video
        ref={ref}
        data-hero-video
        className="absolute inset-0 h-full w-full object-cover"
        style={blur && blur !== 'none' ? { filter: blur } : undefined}
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      {hasAudio ? (
        <button
          type="button"
          onClick={toggle}
          aria-pressed={sound}
          className="absolute right-4 top-4 z-20 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 py-2 text-sm text-white backdrop-blur hover:bg-black/75"
        >
          {sound ? '🔊 Sound on' : '🔇 Sound off — tap for sound'}
        </button>
      ) : null}
    </>
  );
}
