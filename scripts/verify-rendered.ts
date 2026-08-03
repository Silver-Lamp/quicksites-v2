// scripts/verify-rendered.ts
//
// Run the render gate against published URLs.
//
//   npx tsx scripts/verify-rendered.ts <url> [more urls…] \
//     [--must "exact copy you wrote"] [--disclosure "text that must come first"]
//
// ⚠️ IT EXITS NON-ZERO ON A FAILURE, WHICH IS THE ONLY REASON IT IS A SCRIPT RATHER THAN A REPORT.
// A checklist run by hand is skipped on the engagement where you are late; a command that fails
// is not. Wire it into CI or a pre-publish step and the checks stop depending on discipline.
//
// ⚠️ AN INAPPLICABLE RULE IS PRINTED, NOT HIDDEN. A rule that proved nothing is not a rule that
// passed, and a summary that folds the two together is how a green run comes to mean less than it
// looks like it means.

import { renderPage } from '@/lib/verify/render';
import { runRules, defaultRules, summarize } from '@/lib/verify/renderGate';

function arg(name: string): string[] {
  const out: string[] = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) if (argv[i] === `--${name}` && argv[i + 1]) out.push(argv[++i]);
  return out;
}

async function main() {
  const urls = process.argv.slice(2).filter((a) => a.startsWith('http'));
  if (!urls.length) {
    console.error('usage: verify-rendered.ts <url…> [--must "copy"] [--disclosure "text"]');
    process.exit(2);
  }
  const mustContain = arg('must');
  const disclosure = arg('disclosure')[0];
  const prefer = process.argv.includes('--serverless') ? ('serverless' as const) : undefined;

  let failed = 0;
  for (const url of urls) {
    console.log(`\n── ${url}`);
    const r = await renderPage(url, prefer);
    if (!r.ok) {
      // Reported, never swallowed: a verifier whose browser did not start is a green row that
      // means nothing, which is worse than no verifier at all.
      console.log(`   COULD NOT RENDER (${r.driver}): ${r.error}`);
      failed++;
      continue;
    }

    const findings = runRules(r.page, defaultRules({ mustContain, disclosure }));
    for (const f of findings) {
      const mark = f.status === 'pass' ? '✓' : f.status === 'fail' ? '✗' : '·';
      console.log(`   ${mark} ${f.rule.padEnd(46)} ${f.detail}`);
    }
    const s = summarize(findings);
    console.log(
      `   → ${s.passed} passed, ${s.failed} failed, ${s.inapplicable} proved nothing` +
        `  [${r.driver}, ${r.page.scanned.visibleNodes} visible nodes]`,
    );
    if (!s.ok) failed++;
  }

  console.log(failed ? `\n${failed} page(s) failed the gate.` : '\nAll pages passed the gate.');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
