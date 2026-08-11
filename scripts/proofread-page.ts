// scripts/proofread-page.ts
//
// Read a published page the way a visitor does, then have a model look for defects in the text.
//
//   npx tsx --env-file=.env.local scripts/proofread-page.ts https://example.quicksites.ai/
//
// ⚠️ IT READS THE RENDERED PAGE, NOT THE SOURCE. Same principle as the render gate: the artifact
// that reaches the person is the only one worth checking. A proofreader pointed at block JSON
// would have missed the corrupted words on a real published résumé, because the JSON contained
// exactly the same corrupted words and looked entirely well-formed.
//
// ⚠️ ADVISORY. Exits 0 whatever it finds — this is a read for a human, not a gate. Use
// scripts/verify-rendered.ts for the checks that should be able to fail a build.
import { chromium } from 'playwright';
import { proofreadPage } from '../lib/verify/proofread';

/**
 * ⚠️ A CHECKER THAT FINDS NOTHING LOOKS EXACTLY LIKE A CLEAN PAGE. `--selftest` points the
 * proofreader at text whose defects are known and asserts it finds them, and at text known to be
 * clean and asserts it does not. Without both halves, a broken prompt, a bad API key or a silently
 * empty response would read as "your page is fine" — the failure this whole tool exists to stop,
 * turned on the tool itself.
 */
const KNOWN_BAD = `Delivered an award-winning ginancial recovery system for the university.
Developed and maintained girmware upload pipelines to device fleets with rollback.
Built automated tests in Playwright to validate UI workglows and API endpoints.
Share who you are, what you care about, and what you're working on.
Record your voice — make this page talk.`;

const KNOWN_GOOD = `Principal full-stack engineer based in Seattle, available for contract work.
Built a schema-driven block system with 64 block types validated by Zod, and led a security
remediation across the API surface. Delivered an award-winning financial recovery system.`;

async function selftest() {
  const bad = await proofreadPage(KNOWN_BAD, { route: 'scripts/proofread-page:selftest' });
  const good = await proofreadPage(KNOWN_GOOD, { route: 'scripts/proofread-page:selftest' });

  const garbled = bad.filter((f) => f.category === 'garbled_text').length;
  console.log(`\n   known-bad  → ${bad.length} findings (${garbled} garbled_text)`);
  console.log(`   known-good → ${good.length} findings`);

  const failures: string[] = [];
  if (garbled < 2) failures.push(`expected the ligature corruptions to be caught, got ${garbled}`);
  if (!bad.some((f) => f.category === 'editor_speak')) failures.push('missed the editor-speak line');
  if (good.length) failures.push(`${good.length} false positive(s) on clean text`);

  if (failures.length) {
    console.error('\n   SELFTEST FAILED:');
    for (const f of failures) console.error(`     - ${f}`);
    process.exit(1);
  }
  console.log('\n   selftest passed.\n');
}

async function main() {
  if (process.argv.includes('--selftest')) return selftest();

  const url = process.argv[2];
  if (!url) throw new Error('usage: proofread-page.ts <url> | --selftest');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  // innerText, not textContent: it reflects what is actually visible, skipping display:none.
  const text: string = await page.evaluate(() => (document.body as HTMLElement).innerText);
  await browser.close();

  console.log(`\n── ${url}\n   ${text.length} characters of visible text\n`);

  const findings = await proofreadPage(text, { route: 'scripts/proofread-page' });

  if (!findings.length) {
    console.log('   nothing flagged.\n');
    return;
  }

  for (const f of findings) {
    console.log(`   ${f.confidence.padEnd(6)} ${f.category}`);
    console.log(`          “${f.quote}”`);
    console.log(`       →  ${f.suggestion}`);
    console.log(`          ${f.why}\n`);
  }
  console.log(`   ${findings.length} flagged. These are CANDIDATES — read them, decide yourself.\n`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
