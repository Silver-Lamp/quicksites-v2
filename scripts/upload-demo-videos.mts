// scripts/upload-demo-videos.mts
//
// Upload recorded walkthroughs from ./demo-videos to Supabase Storage and attach them to the
// feature they demonstrate, so /features shows real footage instead of a description of it.
//
//   npx tsx scripts/upload-demo-videos.mts            # dry run: says exactly what it would do
//   npx tsx scripts/upload-demo-videos.mts --apply
//
// ⚠️ PATHS ARE DATED: `demos/<YYYY-MM-DD>/<name>.mp4`. A re-record replaces that DAY's file and
// leaves every earlier take reachable, because the whole point of recording a walkthrough is that
// the product changes underneath it — a stable path means the clip a customer was sent last month
// silently becomes a different video, and nothing anywhere would say so. The date comes from the
// FILENAME (`editor-tour-2026-10-01.mp4`), not from today's clock, so re-running this script next
// week re-uploads the same clip to the same place instead of minting a second copy under a new
// date. Files with no date in the name are refused rather than dated for you.
//
// ⚠️ Writes `features.demo_clips`, NOT `features.gallery` — that one is the portfolio IMAGE
// gallery and the admin UI counts it as images (see migration 20260868).

// ⚠️ LOAD ENV FIRST, BEFORE ANY IMPORT THAT READS IT. This script needs Supabase credentials and
// did not load them — it only ever worked because the session running it had already sourced
// `.env.local` into its shell. The copy-the-command button on /admin/demo-narration handed the
// bare command to someone with a clean shell and it died on `supabaseUrl is required` AFTER the
// recording had completed, i.e. after the expensive, draft-creating half. Same idiom as
// scripts/backfill-customers.ts.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { planDemoClips } from '@/lib/demos/planDemoClips';
import { isTransientUploadError } from '@/lib/demos/uploadRetry';

import { installNodeWebSocket } from '@/lib/supabase/nodeWebSocketShim';

const run = promisify(execFile);

const BUCKET = 'videos';
const LOCAL_DIR = 'demo-videos';
const APPLY = process.argv.includes('--apply');

/**
 * Which feature each recording demonstrates, and what to call it on the page.
 *
 * ⚠️ Declared, never inferred from the filename. A clip attached to the wrong feature is a
 * wrong claim about what the product does, and a slug typo must fail loudly here rather than
 * quietly attach nothing — so every key is checked against the DB before anything uploads.
 */
type ClipSpec = {
  feature: string;
  label: string;
  /** One line under the thumbnail: what a viewer will actually see. */
  blurb: string;
  /**
   * Seconds into the clip to cut the poster from.
   *
   * ⚠️ DECLARED PER CLIP, NOT CHOSEN BY A FILTER. ffmpeg's `thumbnail` filter picks the most
   * visually DISTINCTIVE frame, which for editor-tour was the colourful loading animation —
   * a poster reading "Building your site …" on a card labelled "Editing blocks, theme and
   * publish". The filter worked; the result was wrong, and only looking at the frames showed
   * it. Each value below was picked off a contact sheet of the real recording.
   */
  posterAt: number;
  primary?: boolean;
};

const CLIPS: Record<string, ClipSpec> = {
  'guest-build': {
    feature: 'block-based-template-editor',
    label: 'Building a site from scratch, signed out',
    blurb: 'Describe a business, watch the site appear. No account.',
    // The first frame where the business name is FULLY typed ("Wildflower Candle Co."), just
    // inside the 14.0–17.64s "Type the business name" step. 16s caught it mid-word ("Wildfl"):
    // the right moment, but a thumbnail of a half-typed word reads as a glitch. Picked off
    // frames extracted at explicit timestamps, never from a tile index.
    posterAt: 17.3,
  },
  'editor-tour': {
    feature: 'block-based-template-editor',
    label: 'Editing blocks, theme and publish',
    blurb: 'Rearranging sections, switching the theme, going live.',
    // A block selected with its edit controls showing — the frame that means "editing".
    posterAt: 10,
    primary: true,
  },
  'finished-site': {
    feature: 'seo-foundations-out-of-the-box',
    label: 'The published result',
    blurb: 'What a visitor gets: storefront, services, contact.',
    // The product grid with real prices and Add to Cart — the storefront, not just a hero.
    posterAt: 4.3,
  },
};

/** Seconds, measured. Returns undefined rather than a guess if ffprobe cannot read the file. */
async function probeDuration(file: string): Promise<number | undefined> {
  try {
    const { stdout } = await run('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
    ]);
    const n = Number(stdout.trim());
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
  } catch {
    return undefined;
  }
}

/** Cut a poster JPEG at `at` seconds. Returns the temp path, or undefined if ffmpeg failed. */
async function cutPoster(file: string, at: number, outDir: string, name: string): Promise<string | undefined> {
  const out = path.join(outDir, `${name}.jpg`);
  try {
    await run('ffmpeg', [
      '-loglevel', 'error', '-y', '-ss', String(at), '-i', file,
      '-frames:v', '1', '-vf', 'scale=640:-1', '-q:v', '4', out,
    ]);
    // ⚠️ A zero-byte or missing file means ffmpeg "succeeded" past the end of the clip. A
    // poster that 404s is worse than none: the card renders a broken image instead of the
    // labelled placeholder it falls back to.
    const st = fs.existsSync(out) ? fs.statSync(out) : null;
    return st && st.size > 1024 ? out : undefined;
  } catch {
    return undefined;
  }
}

/** `editor-tour-2026-10-01.mp4` → { name, date }. Refuses an undated file. */
function parseName(file: string): { name: string; date: string } | null {
  const m = /^(.+)-(\d{4}-\d{2}-\d{2})\.(mp4|webm)$/.exec(file);
  return m ? { name: m[1], date: m[2] } : null;
}

/**
 * Retry a storage upload through a transient network failure.
 *
 * ⚠️ ONE `fetch failed` ABORTED A WHOLE RUN and left storage ahead of the database: the first
 * clip's video, poster and manifest were uploaded, the second died mid-upload, and the attach
 * step — which runs after ALL uploads — never happened. So a manifest existed in storage that
 * no row pointed at, and the narration studio still said "no cues" for a clip that had them.
 * Re-running fixed it, but nothing told the operator that re-running was the remedy.
 *
 * Only the transport is retried. A 413, a bad key or a rejected content type will fail the same
 * way three times, so those surface immediately rather than after three waits.
 */
type Uploader = {
  upload: (
    path: string,
    body: Buffer,
    opts: { contentType: string; upsert: boolean },
  ) => Promise<{ error: { message: string } | null }>;
};

async function uploadWithRetry(
  bucket: Uploader,
  storagePath: string,
  body: Buffer,
  contentType: string,
): Promise<{ error: { message: string } | null }> {
  const ATTEMPTS = 3;
  let last: { message: string } | null = null;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const { error } = await bucket.upload(storagePath, body, { contentType, upsert: true });
      if (!error) return { error: null };
      last = error;
      // A rejection the server MEANT will not change on a retry.
      if (!isTransientUploadError(error.message)) return { error };
    } catch (e: any) {
      last = { message: e?.message ?? String(e) };
    }
    if (attempt < ATTEMPTS) {
      const waitMs = 1000 * attempt;
      console.warn(`  … ${storagePath} failed (${last?.message}) — retrying in ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  return { error: last };
}

async function main() {
  // Node 20 shells need this before the client is constructed; a no-op on 22+.
  await installNodeWebSocket();
  const { supabaseAdmin } = await import('@/lib/supabase/admin');

  const dir = path.resolve(process.cwd(), LOCAL_DIR);
  if (!fs.existsSync(dir)) throw new Error(`No ${LOCAL_DIR}/ directory — nothing to upload.`);
  const files = fs.readdirSync(dir).filter((f) => /\.(mp4|webm)$/i.test(f));
  if (files.length === 0) throw new Error(`${LOCAL_DIR}/ holds no .mp4/.webm files.`);

  // Validate everything before writing anything: a half-applied run leaves the page in a state
  // nobody chose, and the expensive part (upload) is the hard part to undo.
  const planned: Array<{
    file: string; name: string; date: string; feature: string;
    label: string; blurb: string; posterAt: number; primary: boolean; storagePath: string;
  }> = [];
  const problems: string[] = [];

  for (const file of files) {
    const parsed = parseName(file);
    if (!parsed) {
      problems.push(`${file}: no YYYY-MM-DD in the filename — refusing to date it for you.`);
      continue;
    }
    const spec = CLIPS[parsed.name];
    if (!spec) {
      problems.push(`${file}: no CLIPS entry for "${parsed.name}" — add one (feature + label).`);
      continue;
    }
    planned.push({
      file,
      name: parsed.name,
      date: parsed.date,
      feature: spec.feature,
      label: spec.label,
      blurb: spec.blurb,
      posterAt: spec.posterAt,
      primary: !!spec.primary,
      storagePath: `demos/${parsed.date}/${parsed.name}.mp4`,
    });
  }

  // Every target feature must exist. A typo'd slug otherwise uploads bytes and attaches nothing.
  const slugs = [...new Set(planned.map((p) => p.feature))];
  const { data: rows, error: rowErr } = await supabaseAdmin
    .from('features')
    .select('slug, video_url, demo_clips')
    .in('slug', slugs);
  if (rowErr) throw new Error(`features lookup failed: ${rowErr.message}`);
  const bySlug = new Map((rows ?? []).map((r: any) => [r.slug, r]));
  for (const s of slugs) if (!bySlug.has(s)) problems.push(`feature slug "${s}" does not exist.`);

  if (problems.length) {
    console.error('Refusing to run:\n' + problems.map((p) => `  ✗ ${p}`).join('\n'));
    process.exit(1);
  }

  console.log(`${APPLY ? 'Applying' : 'Dry run'} — ${planned.length} clip(s):\n`);
  for (const p of planned) {
    const kb = Math.round(fs.statSync(path.join(dir, p.file)).size / 1024);
    console.log(`  ${p.file}  (${kb} KB)`);
    console.log(`    → ${BUCKET}/${p.storagePath}`);
    console.log(`    → ${p.feature}${p.primary ? '  [primary video_url]' : '  [demo_clips]'}`);
  }
  if (!APPLY) {
    console.log('\nNothing written. Re-run with --apply.');
    return;
  }

  // Upload first, then attach: a row pointing at a URL that 404s is worse than a file nobody
  // references yet, because the page renders a dead player rather than no player.
  const urls = new Map<string, string>();
  const posters = new Map<string, string>();
  const durations = new Map<string, number>();
  const manifests = new Map<string, string>();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qs-posters-'));

  for (const p of planned) {
    const local = path.join(dir, p.file);
    const body = fs.readFileSync(local);
    const { error } = await uploadWithRetry(
      supabaseAdmin.storage.from(BUCKET), p.storagePath, body, 'video/mp4',
    );
    if (error) {
      throw new Error(
        `upload ${p.storagePath} failed after retries: ${error.message}\n` +
        `  Nothing was attached. Re-run this command — it is idempotent and will resume.`,
      );
    }
    urls.set(p.file, supabaseAdmin.storage.from(BUCKET).getPublicUrl(p.storagePath).data.publicUrl);
    console.log(`  ✓ uploaded ${p.storagePath}`);

    const secs = await probeDuration(local);
    if (secs) durations.set(p.file, secs);

    // ⚠️ THE POSTER IS LOAD-BEARING, NOT DECORATION. These recordings open on a loading page,
    // so a <video> with no poster shows a WHITE first frame: the clip row was three blank
    // rectangles, which reads as broken rather than as video. Beside the clip and dated the
    // same, so a re-record replaces its own poster and never another day's.
    const posterLocal = await cutPoster(local, p.posterAt, tmp, p.name);
    if (!posterLocal) {
      console.warn(`  ⚠ no poster for ${p.name} (ffmpeg found no frame at ${p.posterAt}s) — the card will show a placeholder`);
      continue;
    }
    const posterPath = p.storagePath.replace(/\.mp4$/, '.jpg');
    const { error: pErr } = await uploadWithRetry(
      supabaseAdmin.storage.from(BUCKET), posterPath, fs.readFileSync(posterLocal), 'image/jpeg',
    );
    if (pErr) {
      console.warn(`  ⚠ poster upload failed for ${p.name}: ${pErr.message}`);
      continue;
    }
    posters.set(p.file, supabaseAdmin.storage.from(BUCKET).getPublicUrl(posterPath).data.publicUrl);
    console.log(`  ✓ poster   ${posterPath}  (at ${p.posterAt}s)`);

    // The narration manifest, if the recorder wrote one. ⚠️ It carries the per-line cues on the
    // FINISHED timeline, which exist nowhere else — the recorder is the only thing that ever
    // knows them. Without it /admin/demo-narration cannot place a line, and it says so rather
    // than spacing them evenly (which looks plausible and is wrong after the first timelapse).
    const manifestLocal = local.replace(/\.mp4$/, '.json');
    if (fs.existsSync(manifestLocal)) {
      const manifestPath = p.storagePath.replace(/\.mp4$/, '.json');
      const { error: mErr } = await uploadWithRetry(
        supabaseAdmin.storage.from(BUCKET), manifestPath, fs.readFileSync(manifestLocal),
        'application/json',
      );
      if (mErr) console.warn(`  ⚠ manifest upload failed for ${p.name}: ${mErr.message}`);
      else {
        manifests.set(
          p.file,
          supabaseAdmin.storage.from(BUCKET).getPublicUrl(manifestPath).data.publicUrl,
        );
        console.log(`  ✓ manifest ${manifestPath}`);
      }
    } else {
      console.warn(`  ⚠ no manifest for ${p.name} — re-record to enable narration cues`);
    }
  }

  // One update per feature, so two clips on the same feature cannot clobber each other.
  for (const slug of slugs) {
    const row: any = bySlug.get(slug);
    const mine = planned.filter((p) => p.feature === slug);

    // The two rules that are easy to get wrong (repoint-the-player, and same-recording-moved)
    // live in lib/demos/planDemoClips.ts with tests — both were wrong on the first run here.
    const { videoUrl, clips } = planDemoClips({
      currentVideoUrl: row.video_url ?? null,
      currentClips: row.demo_clips,
      uploaded: mine.map((p) => ({
        src: urls.get(p.file)!,
        name: p.name,
        date: p.date,
        label: p.label,
        blurb: p.blurb,
        poster: posters.get(p.file),
        manifest: manifests.get(p.file),
        durationSeconds: durations.get(p.file),
        primary: p.primary,
      })),
    });

    const patch: Record<string, unknown> = { demo_clips: clips };
    if (videoUrl !== (row.video_url ?? null)) patch.video_url = videoUrl;

    const { error } = await supabaseAdmin.from('features').update(patch).eq('slug', slug);
    if (error) throw new Error(`attach to ${slug} failed: ${error.message}`);
    console.log(`  ✓ ${slug}: ${clips.length} extra clip(s)${patch.video_url ? ' + primary video' : ''}`);
  }

  console.log('\nDone. Check https://www.quicksites.ai/features');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
