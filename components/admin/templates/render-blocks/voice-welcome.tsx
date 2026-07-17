'use client';

// components/admin/templates/render-blocks/voice-welcome.tsx
//
// Voice Welcome — a render-once TTS "hello" from HiveJournal (contract:
// crosstalk/contracts/voice-welcome-endpoint.md, Status: LIVE, HJ #1326). The audio is
// rendered + stored HJ-side (permanent public MP3); this block is a pure PLAYER with
// its own UI — NO iframe, NO playback compute, just an <audio> against a permanent URL
// that's safe to bake into a published site for years.
//
// HONESTY (contract bright line): `voice` says whose voice it is. The house NARRATOR
// default is labeled as such and is NEVER presented as the person's own voice; only a
// consented owner CLONE gets the "in their voice" framing.

import * as React from 'react';
import type { Block } from '@/types/blocks';

type Props = { block?: Block; content?: Block['content'] };
const s = (v: any) => (typeof v === 'string' ? v.trim() : '');

export default function RenderVoiceWelcome({ block, content }: Props) {
  const c: any = content ?? block?.content ?? {};
  const audioUrl = s(c.audio_url);
  const title = s(c.title);
  const voice = c.voice === 'owner' ? 'owner' : 'narrator';

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = React.useState(false);

  // Nothing to play yet (owner hasn't set up the welcome) → render nothing, like the
  // other HJ-embed blocks. The editor shows the setup fields; the live site stays clean.
  if (!audioUrl) return null;

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
    } else {
      el.pause();
    }
  };

  const voiceLabel = voice === 'owner' ? 'In their own voice' : 'Narrated welcome';

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause welcome' : 'Play welcome'}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90"
        >
          {playing ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title || 'Hear a quick hello'}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden>🎙️</span>
            <span>{voiceLabel}</span>
          </div>
        </div>
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      </div>
    </section>
  );
}
