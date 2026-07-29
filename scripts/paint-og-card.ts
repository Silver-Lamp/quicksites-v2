// scripts/paint-og-card.ts
//
// Paint the DEFAULT Open Graph card — the image every link preview falls back to when a page
// doesn't set its own. It has been a 404 in production for an unknown length of time
// (components/meta-tags.tsx has always defaulted to /assets/opengraph-image.dark.safe.png,
// and nothing was ever written there), which means every shared QuickSites link that relied
// on the default previewed as a broken card.
//
// ⚠️ SPENDS ~$0.04 (gpt-image-1, one call). Owner-approved, paint-one-first, no batch.
//
// THE TEXT IS NOT GENERATED. The model paints an abstract background only; the wordmark and
// tagline are composited afterwards with sharp. Image models render letterforms badly and
// inconsistently, and a misspelled brand name baked into every link preview is exactly the
// kind of error that survives for months because it looks intentional. Same reasoning as the
// 404 script's blank-signboard rule, taken one step further: don't ask, compose.
//
// Rule 9 (no generated people) applies — imported from lib/images/noPeople, never hand-written.
//
//   npx tsx scripts/paint-og-card.ts          # prints the prompt, spends nothing
//   npx tsx scripts/paint-og-card.ts --paint  # spends ~$0.04 and writes the file
import fs from 'node:fs';
import path from 'node:path';
import { NO_PEOPLE_CLAUSE } from '../lib/images/noPeople';

const PAINT = process.argv.includes('--paint');
const OUT = path.join(process.cwd(), 'public', 'assets', 'opengraph-image.dark.safe.png');
const MARK = path.join(process.cwd(), 'public', 'logo-v0.png');

// OG spec size. Anything else gets re-cropped unpredictably by each platform.
const W = 1200;
const H = 630;

// Deliberately abstract and OBJECT-FREE. Every concrete object is an invitation to render
// letters on it (a screen, a sign, a book spine, a poster), which is the failure mode the 404
// prompt had to guard against. An atmospheric field has nothing to write on.
const PROMPT =
  'An abstract painterly background for a dark website social-share card. Deep near-black ' +
  'navy field with soft luminous strokes of azure and cyan sweeping diagonally from the ' +
  'lower left toward the upper right, like light breaking across dark water. Loose ' +
  'impressionistic brushwork, gentle bloom, subtle grain. NO OBJECTS OF ANY KIND: no signs, ' +
  'no screens, no buildings, no devices, no paper, no books, nothing that could carry ' +
  'writing. No letters, no words, no numbers, no symbols, no logos anywhere in the image. ' +
  'Keep the LEFT HALF quiet and uncluttered with deep negative space where a logo and text ' +
  'will be placed. Low contrast, atmospheric, reads as a backdrop rather than a subject. ' +
  NO_PEOPLE_CLAUSE;

/**
 * The blue mark ships as opaque blue-on-black with no alpha channel, so compositing it
 * directly would paste a black rectangle onto the painting. Its luminance IS its coverage,
 * so we rebuild it as a solid brand-blue tile masked by its own greyscale.
 *
 * ⚠️ THE LINEAR() IS LOAD-BEARING — the first render shipped without it and produced exactly
 * the artifact this function exists to avoid, just fainter and therefore easier to miss.
 * `logo-v0.png`'s background is NOT pure black: its corner measures (10,9,8), i.e. grey ~9.
 * Used raw, that becomes alpha 9/255 ≈ 3.5% blue across the whole tile — a visible square
 * hovering over the painting. And the mark's own peak luminance is only 97, so the glyph
 * would have topped out at 38% opacity and looked washed out.
 *
 * So remap instead of trusting the source: alpha = (grey − 25) × 255/(97 − 25) ≈ 3.54·grey −
 * 88.5, clamped by sharp. Anything below 25 → fully transparent, the mark → fully opaque.
 * Re-measure both constants if the logo file is ever replaced; they're properties of THIS
 * image, not of logos in general.
 */
async function transparentMark(sharp: any, size: number): Promise<Buffer> {
  const grey = await sharp(MARK)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0 } })
    .greyscale()
    .linear(3.54, -88.5)
    .raw()
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 3, background: { r: 56, g: 189, b: 248 } },
  })
    .joinChannel(grey, { raw: { width: size, height: size, channels: 1 } })
    .png()
    .toBuffer();
}

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

  const sharp = (await import('sharp')).default;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  // Keep the raw painting. Every retry after this point is a COMPOSITING problem — text
  // position, mark alpha, brightness — and none of those need a new $0.04 render. The first
  // run of this script had to be repaired in place precisely because the background wasn't
  // kept and re-running meant paying twice for the same painting.
  const RAW = path.join(path.dirname(OUT), '.og-source.png');
  fs.writeFileSync(RAW, Buffer.from(b64, 'base64'));
  console.log(`(kept the raw painting at ${RAW} — recomposite for free)`);

  // gpt-image-1 returns PNG regardless of what you asked for. Here the target IS png, so
  // there's no rename trap — but it still gets re-encoded on the way out, because the raw
  // return is ~2 MB and an OG card is fetched by every crawler that sees a link.
  const bg = await sharp(Buffer.from(b64, 'base64'))
    .resize(W, H, { fit: 'cover', position: 'right' }) // keep the quiet left half quiet
    .modulate({ brightness: 0.82 }) // sink the painting so white text stays legible
    .toBuffer();

  const mark = await transparentMark(sharp, 132);

  const text = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
       <text x="96" y="352" font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
             font-size="76" font-weight="700" fill="#ffffff">QuickSites</text>
       <text x="98" y="410" font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
             font-size="30" font-weight="400" fill="#bae6fd">Websites and online ordering for local business</text>
     </svg>`,
  );

  await sharp(bg)
    .composite([
      { input: mark, top: 96, left: 92 },
      { input: text, top: 0, left: 0 },
    ])
    .png({ quality: 90, compressionLevel: 9 })
    .toFile(OUT);

  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log(`\n✅ wrote ${OUT} (${W}x${H}, ${kb} KB)`);
  console.log('\n⚠️ NOW LOOK AT IT before committing. Checking for:');
  console.log('   • any letters the model painted in (the failure this prompt guards)');
  console.log('   • any people or figures (rule 9)');
  console.log('   • the wordmark legible against the painting, mark not sitting on a black box');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
