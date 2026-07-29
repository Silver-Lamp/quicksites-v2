// scripts/paint-404-backdrop.ts
//
// Paint the ONE image behind app/not-found.tsx and write it to public/brand/404.webp as a
// committed build-artifact — the page-level case from the painterly recipe: it versions with
// the page, needs no bucket, and has no runtime dependency.
//
// ⚠️ SPENDS ~$0.04 (gpt-image-1, one call). Owner-triggered, paint-one-first, no batch.
//
// ⚠️ TWO WARNINGS FROM THE MESH ADVISORY (crosstalk 20260727-015522), both learned the hard
// way by HiveJournal on this exact page:
//
//   1. PROMPT SIGN-BOARDS BLANK. A signpost or a screen invites the model to render letters,
//      and the no-text instruction is a REQUEST, not a guarantee. The prompt below asks for
//      blank boards explicitly rather than trusting the suffix to suppress them.
//   2. VIEW THE RENDER BEFORE COMMITTING. Same discipline that caught the figures-in-panels
//      case. This script writes the file and then stops; looking at it is a separate,
//      deliberate step, and nothing is committed until a human (or I) have actually seen it.
//
// Rule 9 (no generated people) applies as everywhere else — imported from lib/images/noPeople,
// never hand-written.
//
//   npx tsx scripts/paint-404-backdrop.ts          # prints the prompt, spends nothing
//   npx tsx scripts/paint-404-backdrop.ts --paint  # spends ~$0.04 and writes the file
import fs from 'node:fs';
import path from 'node:path';
import { NO_PEOPLE_CLAUSE } from '../lib/images/noPeople';

const PAINT = process.argv.includes('--paint');
const OUT = path.join(process.cwd(), 'public', 'brand', '404.webp');

// Subject: a lantern at a foggy crossroads — lost, but with a light and a way onward. The
// signpost is REQUIRED TO BE BLANK, per warning 1 above; a signpost is the single most
// reliable way to make an image model draw words you didn't ask for.
const PROMPT =
  'A soft, painterly background image for a website 404 page — a lantern glowing on a ' +
  'weathered wooden signpost at a quiet forked path in low evening fog, distant hills. ' +
  'THE SIGNPOST BOARDS MUST BE COMPLETELY BLANK AND EMPTY: bare weathered wood, no letters, ' +
  'no words, no numbers, no carved or painted markings of any kind on any board or surface. ' +
  'Loose impressionistic brushwork, muted and atmospheric, gentle warm light from the ' +
  'lantern against cool blue-grey fog, plenty of open negative space in the upper middle ' +
  'where text will sit. It must read as a distant backdrop, not a photograph and not a ' +
  'focal illustration: low contrast, nothing sharp or busy. ' +
  NO_PEOPLE_CLAUSE;

async function main() {
  console.log('Prompt:\n');
  console.log(PROMPT);
  console.log('');

  if (!PAINT) {
    console.log('Dry run — nothing spent. Re-run with --paint to generate (~$0.04).');
    return;
  }

  const { getOpenAI } = await import('../lib/ai/openaiClient');
  const openai = getOpenAI('image');

  console.log('Painting (gpt-image-1, ~20s)…');
  const gen = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: PROMPT,
    size: '1536x1024',
    quality: 'medium',
  });

  const b64 = (gen as any)?.data?.[0]?.b64_json;
  if (!b64) {
    console.error('No image returned.');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  // ⚠️ gpt-image-1 returns PNG, ALWAYS. Writing those bytes straight to a .webp path ships a
  // 2 MB PNG wearing a webp extension — the server then labels it image/webp, and the size is
  // absurd for a decorative backdrop. Convert for real; 2054 KB became 35 KB.
  const png = Buffer.from(b64, 'base64');
  const sharp = (await import('sharp')).default;
  await sharp(png).webp({ quality: 78 }).toFile(OUT);
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log(`\n✅ wrote ${OUT} (${kb} KB, real WebP)`);
  console.log('\n⚠️ NOW LOOK AT IT before committing. Checking for:');
  console.log('   • any text/letters on the signpost boards (the failure this prompt guards)');
  console.log('   • any people or figures (rule 9)');
  console.log('   • enough open space up top for the headline to stay readable');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
