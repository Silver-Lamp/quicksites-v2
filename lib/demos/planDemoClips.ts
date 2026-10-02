// lib/demos/planDemoClips.ts
//
// Pure: given a feature's current media and the clips just uploaded for it, decide the new
// `video_url` + `demo_clips`. Lives here rather than inside scripts/upload-demo-videos.mts so the
// two rules that are easy to get wrong are testable — both were got wrong on the first run.

export type UploadedClip = {
  /** Public URL of the uploaded file. */
  src: string;
  /** One line on what the clip shows, for the card under the thumbnail. */
  blurb?: string;
  /** Public URL of the generated poster frame. */
  poster?: string;
  /** Public URL of the narration cue manifest, when the recorder wrote one. */
  manifest?: string;
  /** Measured with ffprobe — never estimated. */
  durationSeconds?: number;
  /** Base name without the date, e.g. `editor-tour`. */
  name: string;
  /** YYYY-MM-DD, parsed from the filename, never from today's clock. */
  date: string;
  label: string;
  /** This take belongs in the big player. */
  primary?: boolean;
};

export type DemoClip = {
  src: string;
  label?: string;
  blurb?: string;
  recorded_on?: string;
  poster?: string;
  manifest?: string;
  duration_seconds?: number;
  /** Published narration mix + how much of the script it covers. */
  narration?: string;
  narration_lines_recorded?: number;
  narration_lines_total?: number;
};

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

  // ⚠️ EVERY uploaded clip joins the catalogue, including the one `video_url` points at.
  // It used to be excluded, because the primary rendered as a big inline player ABOVE the
  // others. They are now peer cards in one row, and a primary left out of the catalogue is the
  // one card with no poster and no duration — the only blank box in the row.
  for (const u of args.uploaded) {
    // ⚠️ CARRY NARRATION ACROSS A RE-PUBLISH, BUT DROP IT ON A RE-RECORD. The upload script
    // rebuilds each clip entry from scratch, so a plain overwrite silently strips a published
    // narration track — the only symptom being a speaker icon vanishing from /features.
    //
    // But a SAME-DAY re-record reuses the same dated path, so blindly preserving would keep a
    // track timed against footage that no longer exists: the voice would describe the wrong
    // thing, which is worse than no narration and far harder to notice. The duration is the
    // fingerprint — re-records shift it every time (31.64→31.32, 19.56→20.24, 28.8→32.2 on
    // 2026-10-01), so an unchanged duration means the same cut and a changed one means a new
    // recording whose narration has to be re-read.
    const existing = byUrl.get(u.src);
    const sameCut =
      existing?.duration_seconds != null &&
      u.durationSeconds != null &&
      existing.duration_seconds === u.durationSeconds;
    const prior = sameCut ? existing : undefined;
    // Keyed by URL, so a same-day re-record updates in place instead of appending a duplicate.
    byUrl.set(u.src, {
      ...(prior?.narration ? {
        narration: prior.narration,
        narration_lines_recorded: prior.narration_lines_recorded,
        narration_lines_total: prior.narration_lines_total,
      } : {}),
      src: u.src,
      label: u.label,
      ...(u.blurb ? { blurb: u.blurb } : {}),
      recorded_on: u.date,
      ...(u.poster ? { poster: u.poster } : {}),
      ...(u.manifest ? { manifest: u.manifest } : {}),
      ...(typeof u.durationSeconds === 'number' ? { duration_seconds: u.durationSeconds } : {}),
    });
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
