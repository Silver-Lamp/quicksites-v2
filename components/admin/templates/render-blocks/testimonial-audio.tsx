'use client';

// components/admin/templates/render-blocks/testimonial-audio.tsx
//
// Audio Reviews — written customer reviews, each with a "hear this review" ▶ that plays
// an HJ-rendered permanent MP3 (contract: crosstalk/contracts/testimonial-audio-endpoint.md,
// HJ #1329). Same pure-player shape as voice_welcome — no iframe, no playback compute.
//
// BINDING GUARDRAIL (contract): testimonials are read in a NARRATOR voice, ALWAYS — never
// the owner's clone. They're the CUSTOMER's words; a cloned owner voice reading them would
// be fabrication. So the copy says "read aloud" / "hear this review", the reviewer's name
// is TEXT beside the player, and nothing implies the reviewer or owner is speaking.

import * as React from 'react';
import type { Block } from '@/types/blocks';

type Testimonial = { quote?: string; author?: string; audio_url?: string; testimonial_id?: string };
type Props = { block?: Block; content?: Block['content'] };
const s = (v: any) => (typeof v === 'string' ? v.trim() : '');

function ReviewRow({ t }: { t: Testimonial }) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const quote = s(t.quote);
  const author = s(t.author);
  const audio = s(t.audio_url);
  if (!quote) return null;

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  return (
    <figure className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
      <blockquote className="text-sm leading-relaxed">“{quote}”</blockquote>
      <figcaption className="mt-3 flex items-center gap-3">
        {audio && (
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? 'Pause review' : 'Hear this review read aloud'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90"
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
        )}
        <div className="min-w-0">
          {author && <div className="text-sm font-semibold">{author}</div>}
          {audio && <div className="text-xs text-muted-foreground">Review read aloud</div>}
        </div>
      </figcaption>
      {audio && (
        <audio ref={audioRef} src={audio} preload="none"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      )}
    </figure>
  );
}

export default function RenderTestimonialAudio({ block, content }: Props) {
  const c: any = content ?? block?.content ?? {};
  const title = s(c.title) || 'What customers say';
  const items: Testimonial[] = (Array.isArray(c.testimonials) ? c.testimonials : []).filter((t: Testimonial) => s(t.quote));
  if (!items.length) return null;

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10">
      <h2 className="mb-6 text-2xl font-bold tracking-tight">{title}</h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((t, i) => <ReviewRow key={`${s(t.author)}-${i}`} t={t} />)}
      </div>
    </section>
  );
}
