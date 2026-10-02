// scripts/mux-narration.mts
//
// Burn a published narration track into a copy of its clip, for anywhere that cannot play the
// two separately — email, Keynote, YouTube, a phone's camera roll.
//
//   npx tsx scripts/mux-narration.mts guest-build
//
// ⚠️ THIS EXISTS BECAUSE I PRINTED A COMMAND WITH PLACEHOLDER FILENAMES. The studio's status
// line said `ffmpeg -i clip.mp4 -i narration.wav …`; the owner pasted it verbatim and got
// "No such file or directory". A command handed to someone must name real files or be a script
// that finds them — the same mistake as shipping an upload command that never loaded `.env.local`.
//
// ⚠️ IT REFUSES ON A DURATION MISMATCH. Narration is timed to one specific cut, and a re-record
// shifts every cue (31.64→31.32, 19.56→20.24, 28.8→32.2 all happened on 2026-10-01). Muxing a
// track against a different recording produces a file where the voice describes the wrong thing
// — plausible-looking and wrong, which is the worst artifact to hand a prospect.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { installNodeWebSocket } from '@/lib/supabase/nodeWebSocketShim';

const run = promisify(execFile);
// ⚠️ A SUBDIRECTORY, not `demo-videos/` itself. The muxed file is DERIVED output, and
// `upload-demo-videos.mts` treats everything in `demo-videos/` as an input it must be able to
// date — `guest-build-2026-10-01-narrated.mp4` has no parseable date, so one muxed file made
// every subsequent upload refuse to run. Correctly and loudly, which is how it was found.
const IN_DIR = path.resolve('demo-videos');
const OUT_DIR = path.join(IN_DIR, 'narrated');
/** Clips are the same cut when their lengths agree to within a frame or so. */
const TOLERANCE_SECONDS = 0.1;

async function durationOf(fileOrUrl: string): Promise<number> {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', fileOrUrl,
  ]);
  return Number(stdout.trim());
}

async function main() {
  const clip = process.argv[2];
  if (!clip) {
    console.error('Usage: npx tsx scripts/mux-narration.mts <clip>   e.g. guest-build');
    process.exit(1);
  }

  // Node 20 shells need this before the client is constructed; a no-op on 22+.
  await installNodeWebSocket();
  const { supabaseAdmin } = await import('@/lib/supabase/admin');
  const { data, error } = await supabaseAdmin
    .from('features')
    .select('demo_clips')
    .not('demo_clips', 'is', null);
  if (error) throw new Error(`features read failed: ${error.message}`);

  type Clip = { src: string; narration?: string; recorded_on?: string; label?: string };
  const all: Clip[] = (data ?? []).flatMap((r: any) => (Array.isArray(r.demo_clips) ? r.demo_clips : []));
  const match = all.find((c) => c?.src?.includes(`/${clip}.mp4`));

  if (!match) {
    console.error(`No published clip named "${clip}".`);
    console.error(`Known: ${[...new Set(all.map((c) => c.src.split('/').pop()?.replace('.mp4', '')))].join(', ')}`);
    process.exit(1);
  }
  if (!match.narration) {
    console.error(`"${clip}" has no published narration yet.`);
    console.error('Record it at /admin/demo-narration, then press "Publish to /features".');
    process.exit(1);
  }

  // Prefer the local recording; fall back to the published copy so this works on a fresh clone.
  const localVideo = path.join(IN_DIR, `${clip}-${match.recorded_on}.mp4`);
  const video = fs.existsSync(localVideo) ? localVideo : match.src;
  console.log(`video:     ${video === localVideo ? localVideo : `${match.src} (remote)`}`);
  console.log(`narration: ${match.narration}`);

  const [vDur, aDur] = await Promise.all([durationOf(video), durationOf(match.narration)]);
  console.log(`durations: video ${vDur.toFixed(2)}s · narration ${aDur.toFixed(2)}s`);
  if (Math.abs(vDur - aDur) > TOLERANCE_SECONDS) {
    console.error(
      `\nRefusing to mux: these are ${Math.abs(vDur - aDur).toFixed(2)}s apart, so the narration ` +
        `was timed against a different recording.\nRe-record the narration for this cut, or ` +
        `re-publish the clip the narration belongs to.`,
    );
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `${clip}-${match.recorded_on}-narrated.mp4`);
  // Copy the video stream untouched; only the audio is encoded. `-shortest` guards the last
  // fraction of a second where the two can disagree.
  await run('ffmpeg', [
    '-y', '-i', video, '-i', match.narration,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart', '-shortest',
    out,
  ]);

  const mb = (fs.statSync(out).size / 1_048_576).toFixed(1);
  console.log(`\n✅ ${out}\n   ${mb} MB · ${(await durationOf(out)).toFixed(2)}s with narration`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
