// scripts/listing-smoke.ts
//
// Smoke-test the whole "no website" pipeline against a real Google listing WITHOUT
// writing to the DB: resolve the listing → auto-detect its menu photos → read the
// menu → build the spec. Proves the Places key + menu-photo auto-detection work.
//
//   npm run smoke:listing -- "Hawkers Bar & Grill, Auburn WA"
//   npm run smoke:listing -- "ChIJ…"          # a Place ID also works
//
// Needs GOOGLE_PLACES_API_KEY + OPENAI_API_KEY (+ Supabase url/anon for the meter
// chain) in .env.local.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

if (typeof (globalThis as any).WebSocket === 'undefined') {
  try {
    // @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
    const ws = (await import('ws')).default;
    (globalThis as any).WebSocket = ws;
  } catch {
    /* ignore */
  }
}

function hr(label: string) {
  console.log(`\n${'─'.repeat(4)} ${label} ${'─'.repeat(Math.max(0, 56 - label.length))}`);
}

async function main() {
  const arg = process.argv.slice(2).join(' ').trim();
  if (!arg) {
    console.error('Usage: npm run smoke:listing -- "<business name, city>" | "<placeId>"');
    process.exit(1);
  }
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.error('GOOGLE_PLACES_API_KEY not set in .env.local.');
    process.exit(1);
  }

  const { fetchGooglePlace, findPlace, buildSpecFromListing } = await import('@/lib/rebuild/importListing');
  const { pickMenuPhotos, menuFromPhotos } = await import('@/lib/rebuild/menuFromPhotos');
  const { augmentListingWithYelp } = await import('@/lib/rebuild/importListingYelp');

  hr('1) RESOLVE LISTING');
  const looksLikePlaceId = /^ChI[\w-]{10,}/.test(arg);
  let listing = looksLikePlaceId ? await fetchGooglePlace(arg) : await fetchGooglePlace((await findPlace(arg)).placeId);
  const googlePhotoCount = listing.photos?.length ?? 0;
  listing = await augmentListingWithYelp(listing);
  const addedByYelp = (listing.photos?.length ?? 0) - googlePhotoCount;
  console.log({
    name: listing.name,
    phone: listing.phone,
    address: listing.address,
    website: listing.website,
    categories: listing.categories,
    hours: listing.hours,
    photos: listing.photos?.length ?? 0,
  });

  hr('2) AUTO-DETECT MENU PHOTOS');
  const menuPhotos = listing.photos?.length ? await pickMenuPhotos(listing.photos, null) : [];
  console.log(
    `Detected ${menuPhotos.length} menu photo(s) out of ${listing.photos?.length ?? 0}` +
      (addedByYelp > 0 ? ` (+${addedByYelp} from Yelp).` : '.'),
  );

  hr('3) READ MENU (vision)');
  const source = menuPhotos.length ? menuPhotos : (listing.photos ?? []);
  const menu = source.length ? await menuFromPhotos(source, null) : undefined;
  if (menu?.sections?.length) {
    for (const s of menu.sections) {
      console.log(`\n▸ ${s.name}`);
      for (const it of s.items) console.log(`   • ${it.name}${it.price ? `  ${it.price}` : ''}`);
    }
  } else {
    console.log('(no legible menu found in the listing photos — supply photoUrls for this one)');
  }

  hr('4) ASSEMBLED SPEC (no DB write)');
  const spec = buildSpecFromListing(listing, menu);
  const items = (menu?.sections ?? []).reduce((n, s) => n + s.items.length, 0);
  console.log({
    businessName: spec.businessName,
    contact: spec.contact,
    hoursDays: spec.hours?.length ?? 0,
    menuSections: menu?.sections?.length ?? 0,
    menuItems: items,
  });
  console.log('\n✅ Pipeline ran end-to-end — no rows written.');
}

main().catch((e) => {
  console.error('❌', e?.message || e);
  process.exit(1);
});
