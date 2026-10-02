'use client';

// components/features/demo-clip-row.tsx
//
// Recorded walkthroughs as a horizontal row of small cards: poster, what the clip shows, how long
// it runs. Click one and it opens full size.
//
// ⚠️ A CLIP CARD MUST STOP THE CLICK. On /features the whole feature card is wrapped in a
// `<Link href="/features/<slug>">`, so anything inside it inherits that navigation — which is why
// the inline players it replaces could not really be played: pressing play on one navigated to the
// detail page instead. Every interactive element here calls `preventDefault()` AND
// `stopPropagation()`, and the test pins it.
//
// ⚠️ POSTERS ARE NOT POLISH HERE. These recordings open on a loading page, so a <video> with no
// poster renders a WHITE first frame — the first version of this row was three blank white
// rectangles, which reads as broken rather than as video. A clip with no poster gets a labelled
// placeholder, never a bare white frame.

import * as React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Play, Volume2, VolumeX } from 'lucide-react';

export type DemoClipView = {
  src: string;
  label?: string;
  /** One line on what the clip shows. */
  blurb?: string;
  recorded_on?: string;
  poster?: string;
  duration_seconds?: number;
  /** Published narration mix, if the owner recorded and published one. */
  narration?: string;
  narration_lines_recorded?: number;
  narration_lines_total?: number;
};

/** `92` → `1:32`. Returns null rather than guessing when we never measured it. */
export function formatDuration(seconds: number | undefined | null): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Keep only entries that can actually render something. */
export function usableClips(input: unknown): DemoClipView[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: DemoClipView[] = [];
  for (const c of input) {
    if (!c || typeof c !== 'object') continue;
    const src = (c as DemoClipView).src;
    if (typeof src !== 'string' || !src || seen.has(src)) continue;
    seen.add(src);
    out.push(c as DemoClipView);
  }
  return out;
}

function stop(e: React.SyntheticEvent) {
  e.preventDefault();
  e.stopPropagation();
}

/**
 * The clip plus an optional narration track the viewer can switch on.
 *
 * ⚠️ DEFAULT OFF, AND ONLY EVER ON A TAP. Audio that starts by itself is the thing
 * crosstalk/contracts/audio-honesty-standard.md exists to forbid — all audio here is
 * perceptible and user-initiated. Browsers would block the autoplay anyway; that is not the
 * reason, it just means doing the right thing costs nothing.
 *
 * ⚠️ THE TRACK IS KEPT IN SYNC BY FOLLOWING THE VIDEO, never by starting both and hoping. The
 * mix is rendered to the video's full length (planNarration pads it), so `audio.currentTime =
 * video.currentTime` is correct at every seek — but a seek, a pause or a stall would otherwise
 * drift the two apart within seconds and the narration would describe the wrong thing.
 */
function ClipPlayer({ clip, title }: { clip: DemoClipView; title: string }) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = React.useState(false);

  const hasNarration = typeof clip.narration === 'string' && clip.narration.length > 0;
  const partial =
    typeof clip.narration_lines_recorded === 'number' &&
    typeof clip.narration_lines_total === 'number' &&
    clip.narration_lines_recorded < clip.narration_lines_total;

  // Follow the video wherever it goes.
  React.useEffect(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!v || !a || !on) return;
    const sync = () => {
      if (Math.abs(a.currentTime - v.currentTime) > 0.25) a.currentTime = v.currentTime;
    };
    const play = () => {
      sync();
      void a.play().catch(() => {});
    };
    const pause = () => a.pause();
    v.addEventListener('play', play);
    v.addEventListener('pause', pause);
    v.addEventListener('seeked', sync);
    v.addEventListener('timeupdate', sync);
    v.addEventListener('ended', pause);
    if (!v.paused) play();
    return () => {
      v.removeEventListener('play', play);
      v.removeEventListener('pause', pause);
      v.removeEventListener('seeked', sync);
      v.removeEventListener('timeupdate', sync);
      v.removeEventListener('ended', pause);
      a.pause();
    };
  }, [on]);

  return (
    <div>
      <video
        ref={videoRef}
        src={clip.src}
        poster={clip.poster}
        controls
        autoPlay
        playsInline
        className="w-full rounded-md bg-black"
      />
      {hasNarration ? (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              setOn((v) => !v);
            }}
            aria-pressed={on}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
              on
                ? 'border-sky-500/60 bg-sky-500/15 text-sky-200'
                : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'
            }`}
          >
            {on ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            {on ? 'Narration on' : 'Narration'}
          </button>
          {/* ⚠️ Says how much was read. A half-recorded track playing under a "Narration" label
              implies the silences are the product being quiet, not lines nobody read yet. */}
          {partial ? (
            <span className="text-[11px] text-zinc-500">
              {clip.narration_lines_recorded} of {clip.narration_lines_total} lines
            </span>
          ) : null}
          {/* preload=none: ~1.5 MB that nobody who never taps the button should pay for. */}
          <audio ref={audioRef} src={clip.narration} preload="none" />
        </div>
      ) : null}
    </div>
  );
}

export default function DemoClipRow({
  clips,
  featureTitle,
}: {
  clips: DemoClipView[];
  featureTitle: string;
}) {
  const [openIdx, setOpenIdx] = React.useState<number | null>(null);
  const items = usableClips(clips);
  if (items.length === 0) return null;

  const active = openIdx === null ? null : items[openIdx] ?? null;

  return (
    <>
      {/* Snap-scrolling row. `overflow-x-auto` rather than a carousel library: it is keyboard and
          touch scrollable for free, and degrades to a plain row when there is only one clip. */}
      <div
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]"
        role="list"
        aria-label={`Recorded walkthroughs for ${featureTitle}`}
      >
        {items.map((c, i) => {
          const dur = formatDuration(c.duration_seconds);
          return (
            <button
              key={c.src}
              type="button"
              role="listitem"
              onClick={(e) => {
                stop(e);
                setOpenIdx(i);
              }}
              className="group/clip w-[208px] shrink-0 snap-start overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-900/40 text-left transition hover:border-sky-500/50 hover:bg-zinc-900/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <span className="relative block aspect-video w-full overflow-hidden bg-zinc-800">
                {c.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Supabase storage URL,
                  // already sized at generation; next/image would proxy it for no benefit.
                  <img
                    src={c.poster}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-200 group-hover/clip:scale-[1.03]"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-[10px] uppercase tracking-wide text-zinc-500">
                    Walkthrough
                  </span>
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/25 opacity-0 transition group-hover/clip:opacity-100">
                  {/* `text-zinc-900` on a white pill is deliberate and correct: this is a light
                      chip floating on a dark overlay, not a light-theme page colour. It trips
                      CLAUDE.md §7's grep, which has no alpha guard for TEXT colours — the
                      "check that fires on correct code" case that rule itself warns about. */}
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-zinc-900">
                    <Play className="h-4 w-4 translate-x-[1px]" fill="currentColor" />
                  </span>
                </span>
                {dur ? (
                  <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
                    {dur}
                  </span>
                ) : null}
                {c.narration ? (
                  <span
                    className="absolute bottom-1 left-1 grid h-5 w-5 place-items-center rounded bg-black/75 text-white"
                    title="Has narration"
                  >
                    <Volume2 className="h-3 w-3" />
                  </span>
                ) : null}
              </span>
              <span className="block space-y-0.5 p-2.5">
                <span className="block text-xs font-medium leading-snug text-zinc-100">
                  {c.label || 'Walkthrough'}
                </span>
                {c.blurb ? (
                  <span className="block text-[11px] leading-snug text-zinc-400">{c.blurb}</span>
                ) : null}
                {c.recorded_on ? (
                  <span className="block pt-0.5 text-[10px] tabular-nums text-zinc-500">
                    Recorded {c.recorded_on}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <Dialog open={active !== null} onOpenChange={(o) => !o && setOpenIdx(null)}>
        <DialogContent
          className="max-w-4xl border-zinc-800 bg-zinc-950 p-3 sm:p-4"
          onClick={stop}
        >
          <DialogTitle className="px-1 text-sm font-medium text-zinc-100">
            {active?.label || featureTitle}
            {active?.recorded_on ? (
              <span className="ml-2 font-normal text-zinc-500">· {active.recorded_on}</span>
            ) : null}
          </DialogTitle>
          {active ? <ClipPlayer key={active.src} clip={active} title={featureTitle} /> : null}
          {/* Always rendered: Radix warns when DialogContent has no description, and a clip
              with no blurb would otherwise ship an unlabelled dialog to a screen reader. */}
          <DialogDescription className="px-1 pb-1 text-xs text-zinc-400">
            {active?.blurb || `Recorded walkthrough: ${active?.label || featureTitle}`}
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  );
}
