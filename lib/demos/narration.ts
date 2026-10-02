// lib/demos/narration.ts
//
// Owner-recorded narration for the demo clips: one take per scripted line, played at the point
// in the video where that line belongs, or mixed down into a single soundtrack.
//
// ⚠️ THE CUES COME FROM THE RECORDER'S MANIFEST AND NOWHERE ELSE. `scripts/record-demo.mts`
// measures each step's duration in the FINISHED mp4 — which is not the wall-clock it took,
// because flagged steps are sped up 8x. Those offsets exist only inside that process; nothing
// can recover them afterwards short of watching the video with a stopwatch. A clip with no
// manifest therefore has no cues, and this module says so rather than spacing lines evenly,
// which would look plausible and be wrong everywhere after the first timelapse.
//
// ⚠️ A LINE WITH NO TAKE IS SILENCE, NEVER SYNTHESIS. The point of this tool is the owner's own
// voice. Filling a gap with TTS would put a machine voice inside a track presented as his, which
// is the same mislabelling the audio-honesty standard exists to prevent
// (crosstalk/contracts/audio-honesty-standard.md). Gaps are reported, not patched.

export type NarrationLine = {
  index: number;
  say: string;
  startMs: number;
  endMs: number;
};

export type NarrationManifest = {
  clip: string;
  recordedOn: string;
  durationSeconds: number;
  lines: NarrationLine[];
};

export type NarrationTake = {
  lineIndex: number;
  url: string;
  durationMs: number;
};

/** `clip` + the date it was recorded: a take belongs to ONE recording, never to a clip name. */
export function clipKey(clip: string, recordedOn: string): string {
  return `${clip}@${recordedOn}`;
}

export function parseClipKey(key: string): { clip: string; recordedOn: string } | null {
  const at = key.lastIndexOf('@');
  if (at <= 0 || at === key.length - 1) return null;
  return { clip: key.slice(0, at), recordedOn: key.slice(at + 1) };
}

/** Shape-check a manifest read from disk or storage. Returns null rather than throwing. */
export function parseManifest(input: unknown): NarrationManifest | null {
  if (!input || typeof input !== 'object') return null;
  const m = input as Record<string, unknown>;
  if (typeof m.clip !== 'string' || !m.clip) return null;
  if (typeof m.recordedOn !== 'string' || !m.recordedOn) return null;
  if (!Array.isArray(m.lines)) return null;
  const lines: NarrationLine[] = [];
  for (const raw of m.lines) {
    if (!raw || typeof raw !== 'object') return null;
    const l = raw as Record<string, unknown>;
    if (typeof l.say !== 'string') return null;
    if (typeof l.startMs !== 'number' || !Number.isFinite(l.startMs) || l.startMs < 0) return null;
    if (typeof l.endMs !== 'number' || !Number.isFinite(l.endMs) || l.endMs < l.startMs) return null;
    lines.push({
      index: typeof l.index === 'number' ? l.index : lines.length,
      say: l.say,
      startMs: Math.round(l.startMs),
      endMs: Math.round(l.endMs),
    });
  }
  return {
    clip: m.clip,
    recordedOn: m.recordedOn,
    durationSeconds: typeof m.durationSeconds === 'number' ? m.durationSeconds : 0,
    lines: lines.sort((a, b) => a.startMs - b.startMs),
  };
}

export type PlacedTake = {
  lineIndex: number;
  say: string;
  url: string;
  /** Where the audio starts in the finished video. */
  startMs: number;
  durationMs: number;
  /**
   * Milliseconds this take runs past the moment the NEXT line is cued.
   *
   * ⚠️ Reported, never trimmed. Shortening someone's recorded sentence to fit a slot cuts words
   * off the end of what they said; the honest move is to tell them to re-read it shorter, or
   * accept the overlap deliberately.
   */
  overrunMs: number;
};

export type NarrationPlan = {
  placed: PlacedTake[];
  /** Lines the owner has not recorded yet. These stay SILENT in the mix. */
  missing: NarrationLine[];
  /** Total length the soundtrack must cover, in ms. */
  totalMs: number;
  /** True when every scripted line has a take. */
  complete: boolean;
};

/**
 * Lay the recorded takes onto the video's timeline.
 *
 * The soundtrack is the video's full length — a mix that stopped at the last line would desync
 * the moment anything concatenated it with another track.
 */
export function planNarration(
  manifest: NarrationManifest,
  takes: NarrationTake[],
): NarrationPlan {
  const byLine = new Map(takes.map((t) => [t.lineIndex, t]));
  const placed: PlacedTake[] = [];
  const missing: NarrationLine[] = [];

  for (const [i, line] of manifest.lines.entries()) {
    const take = byLine.get(line.index);
    if (!take || !take.url) {
      missing.push(line);
      continue;
    }
    const next = manifest.lines[i + 1];
    const slotEnd = next ? next.startMs : Math.round(manifest.durationSeconds * 1000);
    const overrun = Math.max(0, line.startMs + take.durationMs - slotEnd);
    placed.push({
      lineIndex: line.index,
      say: line.say,
      url: take.url,
      startMs: line.startMs,
      durationMs: take.durationMs,
      overrunMs: overrun,
    });
  }

  // The track runs at least to the end of the video, and further if a final take overruns it —
  // truncating would clip the last word off the last sentence.
  const videoMs = Math.round(manifest.durationSeconds * 1000);
  const lastEnd = placed.reduce((m, p) => Math.max(m, p.startMs + p.durationMs), 0);

  return {
    placed,
    missing,
    totalMs: Math.max(videoMs, lastEnd),
    complete: missing.length === 0 && manifest.lines.length > 0,
  };
}

/** Which line should be on screen for the reader at a given playback position. */
export function lineAt(manifest: NarrationManifest, positionMs: number): NarrationLine | null {
  let current: NarrationLine | null = null;
  for (const l of manifest.lines) {
    if (l.startMs <= positionMs) current = l;
    else break;
  }
  return current;
}
