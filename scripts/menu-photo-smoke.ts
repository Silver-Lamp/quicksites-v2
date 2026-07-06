// scripts/menu-photo-smoke.ts
//
// Smoke-test the menu-photo vision extractor without the UI: pass one or more menu
// image URLs and it prints the structured menu it read. This is the "no website"
// ingestion path — a restaurant's menu photo → the same menu shape assembleDraft
// consumes. No DB write.
//
//   npm run smoke:menu-photo -- <image-url> [<image-url> ...]
//
// Needs OPENAI_API_KEY (+ Supabase URL/anon for the meter chain) in .env.local.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

// Node 20 has no native WebSocket; the meter chain constructs a Supabase realtime
// client at import. Polyfill from `ws` before that import runs.
if (typeof (globalThis as any).WebSocket === 'undefined') {
  try {
    // @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
    const ws = (await import('ws')).default;
    (globalThis as any).WebSocket = ws;
  } catch {
    /* ignore */
  }
}

async function main() {
  const urls = process.argv.slice(2).filter(Boolean);
  if (!urls.length) {
    console.error('Usage: npm run smoke:menu-photo -- <image-url> [<image-url> ...]');
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set in .env.local — the vision call needs it.');
    process.exit(1);
  }

  console.log(`\n▶ Reading ${urls.length} menu photo(s)…`);
  const { menuFromPhotos } = await import('@/lib/rebuild/menuFromPhotos');
  const menu = await menuFromPhotos(urls, null);

  if (!menu?.sections?.length) {
    console.log('\n⚠ No legible menu found in those images.');
    return;
  }
  for (const s of menu.sections) {
    console.log(`\n▸ ${s.name}`);
    for (const it of s.items) {
      console.log(`   • ${it.name}${it.price ? `  ${it.price}` : ''}${it.description ? `\n     ${it.description}` : ''}`);
    }
  }
  const items = menu.sections.reduce((n, s) => n + s.items.length, 0);
  console.log(`\n✅ Extracted ${menu.sections.length} section(s), ${items} item(s) — no rows written.`);
}

main().catch((e) => {
  console.error('❌', e?.message || e);
  process.exit(1);
});
