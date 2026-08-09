// scripts/paint-portfolio-hero.ts
//
// Paint the ONE image behind every QuickSites portfolio/résumé hero → public/brand/portfolio-hero.webp.
//
// ⚠️ ONE PAINTING FOR THE WHOLE TEMPLATE CLASS — THAT IS THE SYSTEMIC PART. A per-site painterly
// hero would be ~$0.04 × every portfolio site we ever generate, and Verbatim generates this class
// from a résumé, so the count is unbounded. A committed build artifact is bought once and shared
// by all of them at zero marginal cost. This is the same reasoning as lib/theme/backdropPool.ts
// (sites share paintings) applied to a page-level asset, where the recipe's rule 3 already says
// commit it to the repo rather than a bucket: it versions with the copy sitting on top of it.
// A site that wants its own picture can still set data.meta.hero_backdrop.
//
// ⚠️ SPENDS ~$0.04 (gpt-image-1, one call). Owner-approved 2026-08-08 for the portfolio theme,
// paint-one-and-look, no batch.
//
// ⚠️ THE TEXT TRAP, AND WHY THE SUBJECT IS ARCHITECTURE RATHER THAN A DESK. HJ's steer offered a
// desk-object still life, and rule 9's suffix is a REQUEST not a guarantee — the model letters any
// writable object it is given. A "software craftsman's desk" hands it screens, book spines, sticky
// notes and a whiteboard: four text magnets in one frame, on a page whose entire job is to be
// credible to a hiring manager. Garbled lettering behind a résumé does not read as artistic, it
// reads as fake.
//
// So the defence is compositional rather than instructional: **a scene with nothing writable in
// it.** Bare architecture and daylight have no surface a model wants to write on. The no-text
// clause stays as a second line of defence, not the first.
//
// Rule 9 (no generated people) is imported from lib/images/noPeople — never hand-written, because
// a hand-written "no people" string is exactly how the rule rots. It matters doubly here: a figure
// in a portfolio backdrop reads as the person whose résumé this is, or as a colleague who never
// consented to appear on it.
//
//   npx tsx scripts/paint-portfolio-hero.ts          # prints the prompt, spends nothing
//   npx tsx scripts/paint-portfolio-hero.ts --paint  # spends ~$0.04 and writes the file
import fs from 'node:fs';
import path from 'node:path';
import { NO_PEOPLE_CLAUSE } from '../lib/images/noPeople';

const PAINT = process.argv.includes('--paint');
const OUT = path.join(process.cwd(), 'public', 'brand', 'portfolio-hero.webp');

const PROMPT =
  'A soft, painterly background image for a personal portfolio website — the interior of a quiet ' +
  'modern room at first light: tall bare windows, low warm dawn sun laying long geometric ' +
  'rectangles of light across an empty plaster wall and a plain wooden floor. ' +
  'THE ROOM IS COMPLETELY EMPTY OF OBJECTS AND OF WRITING: no desk, no screens, no monitors, no ' +
  'books, no bookshelves, no papers, no whiteboards, no posters, no signage, no letters, no words, ' +
  'no numbers, no typography, no marks of any kind anywhere in the image. Only wall, window, ' +
  'floor, light and shadow. ' +
  'Loose impressionistic brushwork, muted and confident: warm amber light against cool grey-blue ' +
  'shadow, calm and architectural, no neon, no circuitry, no technology motifs. ' +
  'Generous open negative space across the left two thirds where headline text will sit. ' +
  'It must read as a distant backdrop, not a photograph and not a focal illustration: low ' +
  'contrast, soft edges, nothing sharp or busy. ' +
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
    n: 1,
  });

  const b64 = gen.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image returned.');
  const png = Buffer.from(b64, 'base64');

  // ⚠️ gpt-image-1 returns PNG, ALWAYS. Writing those bytes to a .webp path ships a multi-MB PNG
  // wearing a webp extension — the server labels it image/webp, browsers sniff and render it, and
  // nothing warns you. Convert, never rename. (The 404 went 2054 KB → 35 KB when a real encoder
  // was finally run over it.)
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const sharp = (await import('sharp')).default;
  await sharp(png).webp({ quality: 78 }).toFile(OUT);

  const bytes = fs.statSync(OUT).size;
  const head = fs.readFileSync(OUT).subarray(0, 12).toString('binary');
  const realWebp = head.startsWith('RIFF') && head.includes('WEBP');

  console.log(`\nWrote ${OUT}`);
  console.log(`  ${(bytes / 1024).toFixed(0)} KB`);
  console.log(`  magic bytes: ${realWebp ? 'RIFF…WEBP ✓ (a real WebP)' : '✗ NOT a WebP — do not commit'}`);
  console.log('\nNow LOOK AT IT before committing, in this order:');
  console.log('  1. Any letters or writing anywhere. If yes, repaint.');
  console.log('  2. Any people, hands or figures. If yes, repaint (rule 9).');
  console.log('  3. Is the left two thirds calm enough to carry a headline?');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
