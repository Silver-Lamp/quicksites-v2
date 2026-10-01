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

import fs from 'node:fs';
import path from 'node:path';
import { planDemoClips } from '@/lib/demos/planDemoClips';

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
const CLIPS: Record<string, { feature: string; label: string; primary?: boolean }> = {
  'guest-build': {
    feature: 'block-based-template-editor',
    label: 'Building a site from scratch, signed out',
  },
  'editor-tour': {
    feature: 'block-based-template-editor',
    label: 'Editing blocks, theme and publish',
    primary: true,
  },
  'finished-site': {
    feature: 'seo-foundations-out-of-the-box',
    label: 'The published result',
  },
};

/** `editor-tour-2026-10-01.mp4` → { name, date }. Refuses an undated file. */
function parseName(file: string): { name: string; date: string } | null {
  const m = /^(.+)-(\d{4}-\d{2}-\d{2})\.(mp4|webm)$/.exec(file);
  return m ? { name: m[1], date: m[2] } : null;
}

async function main() {
  const { supabaseAdmin } = await import('@/lib/supabase/admin');

  const dir = path.resolve(process.cwd(), LOCAL_DIR);
  if (!fs.existsSync(dir)) throw new Error(`No ${LOCAL_DIR}/ directory — nothing to upload.`);
  const files = fs.readdirSync(dir).filter((f) => /\.(mp4|webm)$/i.test(f));
  if (files.length === 0) throw new Error(`${LOCAL_DIR}/ holds no .mp4/.webm files.`);

  // Validate everything before writing anything: a half-applied run leaves the page in a state
  // nobody chose, and the expensive part (upload) is the hard part to undo.
  const planned: Array<{ file: string; name: string; date: string; feature: string; label: string; primary: boolean; storagePath: string }> = [];
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
  for (const p of planned) {
    const body = fs.readFileSync(path.join(dir, p.file));
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(p.storagePath, body, { contentType: 'video/mp4', upsert: true });
    if (error) throw new Error(`upload ${p.storagePath} failed: ${error.message}`);
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(p.storagePath);
    urls.set(p.file, data.publicUrl);
    console.log(`  ✓ uploaded ${p.storagePath}`);
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
