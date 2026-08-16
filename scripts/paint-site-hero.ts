// scripts/paint-site-hero.ts
//
// Repaint one site's hero. THIS SPENDS ~$0.04 PER RUN — hence one template id per invocation,
// no batch flag, and a printed cost line. A script that can repaint a fleet is one typo away
// from a bill nobody authorised.
//
//   npx tsx scripts/paint-site-hero.ts <templateId> [--subject "..."]
//
// Needs OPENAI_API_KEY + the Supabase service role in the environment. Requires Node 22
// (supabase-js needs a native WebSocket).

import 'dotenv/config';
import { paintSiteHero } from '../lib/images/paintHero';

async function main() {
  const [templateId, ...rest] = process.argv.slice(2);
  if (!templateId) {
    console.error('usage: npx tsx scripts/paint-site-hero.ts <templateId> [--subject "..."]');
    process.exit(1);
  }

  const si = rest.indexOf('--subject');
  const subject = si >= 0 ? rest[si + 1] ?? null : null;

  console.log(`Painting hero for ${templateId}${subject ? ` (subject: ${subject})` : ''}…`);
  console.log('This calls gpt-image-1 once — approximately $0.04.');

  const res = await paintSiteHero(templateId, null, { subject });

  if (!res.changed) {
    console.error(`✗ no change: ${res.reason}${res.warning ? ` — ${res.warning}` : ''}`);
    process.exit(1);
  }

  console.log(`✓ painted: ${res.url}`);
  console.log(res.republished
    ? '✓ republished — the live page serves the new snapshot'
    : '⚠ NOT republished — the draft has the new hero but the live page still serves the old snapshot');
  if (res.warning) console.warn(`⚠ ${res.warning}`);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
