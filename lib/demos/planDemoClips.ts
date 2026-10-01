// lib/demos/planDemoClips.ts
//
// Pure: given a feature's current media and the clips just uploaded for it, decide the new
// `video_url` + `demo_clips`. Lives here rather than inside scripts/upload-demo-videos.mts so the
// two rules that are easy to get wrong are testable — both were got wrong on the first run.

export type UploadedClip = {
  /** Public URL of the uploaded file. */
  src: string;
  /** Base name without the date, e.g. `editor-tour`. */
  name: string;
  /** YYYY-MM-DD, parsed from the filename, never from today's clock. */
  date: string;
  label: string;
  /** This take belongs in the big player. */
  primary?: boolean;
};

export type DemoClip = { src: string; label?: string; recorded_on?: string };

export type PlanResult = { videoUrl: string | null; clips: DemoClip[] };

/** A URL we produced, as opposed to one somebody set by hand. */
function isOurUpload(url: string | null | undefined): boolean {
  return !!url && /\/demos\//.test(url);
}

function basename(url: string): string {
  return url.split('/').pop() ?? '';
}

export function planDemoClips(args: {
  currentVideoUrl: string | null;
  currentClips: unknown;
  uploaded: UploadedClip[];
}): PlanResult {
  const existing: DemoClip[] = Array.isArray(args.currentClips)
    ? (args.currentClips as DemoClip[]).filter((c) => c && typeof c.src === 'string' && c.src)
    : [];
  const byUrl = new Map<string, DemoClip>(existing.map((c) => [c.src, c]));

  let videoUrl = args.currentVideoUrl ?? null;

  for (const u of args.uploaded) {
    // ⚠️ RULE 1 — repoint the big player only when it already points at one of OUR uploads.
    // `!videoUrl` alone is too timid and silently defeats dated paths: the editor's player
    // already pointed at the old UNDATED `demos/editor-tour.mp4`, so a dated re-record would
    // have landed in demo_clips while the headline player kept serving the stale cut.
    // Overwriting unconditionally is the opposite error — a hand-set URL (a YouTube link, a
    // one-off) is somebody's decision and is not ours to replace.
    if (u.primary && (!videoUrl || isOurUpload(videoUrl))) videoUrl = u.src;
  }

  for (const u of args.uploaded) {
    if (u.src === videoUrl) continue;
    // Keyed by URL, so a same-day re-record updates in place instead of appending a duplicate.
    byUrl.set(u.src, { src: u.src, label: u.label, recorded_on: u.date });
  }

  // ⚠️ RULE 2 — an old take the player no longer shows is worth keeping, UNLESS it is the same
  // recording that just moved to a dated path. The first run filed the undated
  // `demos/editor-tour.mp4` as an "Earlier take" beside `demos/2026-10-01/editor-tour.mp4`, and
  // the two were BYTE-IDENTICAL (845,278 each) — so the page would have shown one clip twice,
  // the duplicate labelled as history that never happened. Same basename ⇒ migrating, not older.
  const moved = new Set(args.uploaded.map((u) => `${u.name}.mp4`));
  const old = args.currentVideoUrl;
  if (old && old !== videoUrl && isOurUpload(old) && !moved.has(basename(old))) {
    byUrl.set(old, byUrl.get(old) ?? { src: old, label: 'Earlier take' });
  }

  // Newest first. An undated entry sorts last rather than throwing off the comparison.
  const clips = [...byUrl.values()].sort((a, b) =>
    (b.recorded_on ?? '').localeCompare(a.recorded_on ?? ''),
  );
  return { videoUrl, clips };
}
