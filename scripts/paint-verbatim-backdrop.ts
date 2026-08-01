// scripts/paint-verbatim-backdrop.ts
//
// Paint the ONE image behind app/verbatim/page.tsx → public/brand/verbatim.webp, as a committed
// build-artifact. Page-level case of the painterly recipe: it versions with the copy sitting on
// top of it, needs no bucket, and has no runtime dependency.
//
// ⚠️ SPENDS ~$0.04 (gpt-image-1, one call). Owner-triggered, paint-one, no batch.
//
// ⚠️ THE TEXT TRAP IS WORSE HERE THAN ON THE 404. The mesh advisory's warning was that a
// signpost invites the model to render letters, and the no-text instruction is a REQUEST rather
// than a guarantee. This page is about a RÉSUMÉ — so the obvious subjects (paper, documents, a
// typed page, a desk of CVs) are the strongest text-magnets available, far worse than a signpost:
// a model asked for "a sheet of paper" will fill it with writing nearly every time, and the one
// thing this page must not show is invented words on a document.
//
// Two defences, both deliberate:
//   1. The subject avoids readable surfaces entirely — ink and light, not pages of text.
//      Any paper in frame is specified BLANK, in the same emphatic terms the 404 uses.
//   2. VIEW THE RENDER BEFORE COMMITTING. This script writes the file and stops. Looking at it
//      is a separate, deliberate step, and nothing is committed until a human has actually seen
//      it. This caught the figures-in-panels case and the ALWAYS-TOWING logo before it.
//
// Rule 9 (no generated people) comes from lib/images/noPeople — imported, never hand-written,
// because a hand-written "no people" string is exactly how the rule rots.
//
//   npx tsx scripts/paint-verbatim-backdrop.ts          # prints the prompt, spends nothing
//   npx tsx scripts/paint-verbatim-backdrop.ts --paint  # spends ~$0.04 and writes the file
import fs from 'node:fs';
import path from 'node:path';
import { NO_PEOPLE_CLAUSE } from '../lib/images/noPeople';

const PAINT = process.argv.includes('--paint');
const OUT = path.join(process.cwd(), 'public', 'brand', 'verbatim.webp');

// Subject: ink meeting paper in warm lamplight — the moment of someone's own words being set
// down, which is precisely what Verbatim claims to do and nothing more. Deliberately NOT a
// résumé, a CV, a document or a screen: those are the surfaces a model fills with invented text,
// and invented text about a person is the one thing this product exists not to produce.
const PROMPT =
  'A soft, painterly background image for a website — a quiet writing desk at dusk lit by a ' +
  'warm lamp, an uncapped fountain pen resting beside a single sheet of paper, faint ink ' +
  'blooming into the fibres. ' +
  'THE PAPER MUST BE COMPLETELY BLANK AND EMPTY: bare cream paper, no letters, no words, no ' +
  'numbers, no handwriting, no printed lines, no typography, no marks of any kind on the sheet ' +
  'or anywhere else in the image. No screens, no books, no documents, no signage. ' +
  'Loose impressionistic brushwork, muted and atmospheric, warm amber lamplight against cool ' +
  'blue-grey shadow, generous open negative space in the upper left where text will sit. ' +
  'It must read as a distant backdrop, not a photograph and not a focal illustration: low ' +
  'contrast, nothing sharp or busy. ' +
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

  // ⚠️ gpt-image-1 returns PNG, ALWAYS. Writing those bytes to a .webp path ships a ~2 MB PNG
  // wearing a webp extension: the server labels it image/webp, every browser sniffs and renders
  // it fine, and nothing warns you. The 404 went 2054 KB → 35 KB when a real encoder was run.
  // Convert, never rename. (Recipe rule 3, QS's own redline.)
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const sharp = (await import('sharp')).default;
  await sharp(png).webp({ quality: 78 }).toFile(OUT);

  const bytes = fs.statSync(OUT).size;
  const head = fs.readFileSync(OUT).subarray(0, 12).toString('binary');
  const realWebp = head.startsWith('RIFF') && head.includes('WEBP');

  console.log(`\nWrote ${OUT}`);
  console.log(`  ${(bytes / 1024).toFixed(0)} KB`);
  console.log(`  magic bytes: ${realWebp ? 'RIFF…WEBP ✓ (a real WebP)' : '✗ NOT a WebP — do not commit'}`);
  console.log('\nNow LOOK AT IT before committing. Two things to check, in this order:');
  console.log('  1. Any letters or writing anywhere — especially on the paper. If yes, repaint.');
  console.log('  2. Any people, hands, or figures. If yes, repaint (rule 9).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
