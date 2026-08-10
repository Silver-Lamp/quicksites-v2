// scripts/paint-restaurant-apex-hero.ts
//
// Paint the ONE image behind every <city>-restaurant apex hero → public/brand/apex-food.webp.
//
// ⚠️ ONE PAINTING FOR THE WHOLE SURFACE CLASS, like the portfolio hero. Every city apex we launch
// shares it, so the cost is bought once rather than per city — and unlike a restaurant's own site,
// an apex is OURS, so a shared image asserts nothing about anybody's kitchen.
//
// ⚠️ AND THAT IS EXACTLY WHY IT MUST NOT LOOK LIKE A RESTAURANT'S PHOTO. A generated dish behind a
// directory of REAL named restaurants reads as one of their dishes. Rule 9 forbids generated
// people for the same reason one layer up: the page presents as being about specific businesses,
// so anything photographic in it is taken as a claim about them. The subject is therefore an
// abstract still life — produce and cookware on a table, no plated dish, no restaurant interior,
// no storefront — which reads as "food" without impersonating anyone's cooking.
//
// ⚠️ SPENDS ~$0.04 (gpt-image-1, one call). Paint-one-and-look, no batch.
//
//   npx tsx scripts/paint-restaurant-apex-hero.ts          # prints the prompt, spends nothing
//   npx tsx scripts/paint-restaurant-apex-hero.ts --paint  # spends ~$0.04
import fs from 'node:fs';
import path from 'node:path';
import { NO_PEOPLE_CLAUSE } from '../lib/images/noPeople';

const PAINT = process.argv.includes('--paint');
const OUT = path.join(process.cwd(), 'public', 'brand', 'apex-food.webp');

const PROMPT =
  'A soft, painterly background image for a local restaurant directory website — a simple wooden ' +
  'kitchen table in warm morning light, holding loose raw ingredients: a few tomatoes, herbs, a ' +
  'lemon, a head of garlic, a copper pan, a folded linen cloth. ' +
  'NO PLATED DISH, no finished meal, no restaurant interior, no storefront, no dining room, no ' +
  'table setting. ' +
  'THERE IS NO WRITING ANYWHERE: no labels, no packaging, no jars with text, no menus, no signs, ' +
  'no letters, no words, no numbers, no typography of any kind. ' +
  'Loose impressionistic brushwork, muted and warm: amber light against soft green and terracotta, ' +
  'generous open negative space across the upper half where headline text will sit. ' +
  'It must read as a distant backdrop, not a photograph and not a focal illustration: low ' +
  'contrast, soft edges, nothing sharp or busy. ' +
  NO_PEOPLE_CLAUSE;

async function main() {
  console.log('Prompt:\n');
  console.log(PROMPT);
  if (!PAINT) return console.log('\nDry run — nothing spent. Re-run with --paint (~$0.04).');

  const { getOpenAI } = await import('../lib/ai/openaiClient');
  const openai = getOpenAI('image');
  console.log('\nPainting (gpt-image-1, ~20s)…');
  const gen = await openai.images.generate({
    model: 'gpt-image-1', prompt: PROMPT, size: '1536x1024', quality: 'medium', n: 1,
  });
  const b64 = gen.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image returned.');

  // gpt-image-1 returns PNG, always. Convert, never rename.
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const sharp = (await import('sharp')).default;
  await sharp(Buffer.from(b64, 'base64')).webp({ quality: 78 }).toFile(OUT);

  const bytes = fs.statSync(OUT).size;
  const head = fs.readFileSync(OUT).subarray(0, 12).toString('binary');
  console.log(`\nWrote ${OUT}  ${(bytes / 1024).toFixed(0)} KB`);
  console.log(`  magic bytes: ${head.startsWith('RIFF') && head.includes('WEBP') ? 'RIFF…WEBP ✓' : '✗ NOT a WebP'}`);
  console.log('\nLOOK AT IT: (1) any letters? (2) any people? (3) does it read as a plated dish from a real restaurant?');
}

main().catch((e) => { console.error(e); process.exit(1); });
