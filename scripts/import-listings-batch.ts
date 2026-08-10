// scripts/import-listings-batch.ts
//
// The CedarSites cold-outreach engine: turn a list of "no website" restaurant leads
// into claimable draft sites, each with a shareable preview URL. Reuses the whole
// assembly pipeline (listing → menu-from-photos → assembleDraft) via the service
// role, so it's a one-shot operator batch job.
//
//   npm run import:listings -- leads.json
//
// leads.json is an array; each lead is one of:
//   { "query": "Hawkers Bar & Grill, Auburn WA", "photoUrls": ["<menu photo>"] }
//   { "placeId": "ChIJ…", "photoUrls": ["<menu photo>"] }
//   { "listing": { "name": "…", "phone": "…", "address": "…", "hours": [...],
//                  "photos": ["…"] }, "photoUrls": ["<menu photo>"] }
//
// photoUrls (menu images) are optional but STRONGLY recommended — a Place's generic
// photos rarely include the menu. Needs GOOGLE_PLACES_API_KEY (for query/placeId)
// and OPENAI_API_KEY (menu vision). Writes <leads>-results.json AND a print-ready
// QR per lead (encoding the claim link) into <leads>-qr/<slug>.png for the cards.

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

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

const PUBLIC_BASE = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || process.env.QS_PUBLIC_URL || '';

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2)}${Date.now()}`;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: npm run import:listings -- <leads.json>');
    process.exit(1);
  }
  let leads: any[];
  try {
    leads = JSON.parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(leads)) throw new Error('leads file must be a JSON array');
  } catch (e: any) {
    console.error(`❌ Could not read ${file}: ${e?.message || e}`);
    process.exit(1);
  }

  const { fetchGooglePlace, findPlace, buildSpecFromListing, ListingImportError } = await import('@/lib/rebuild/importListing');
  const { menuFromPhotos, pickMenuPhotos } = await import('@/lib/rebuild/menuFromPhotos');
  const { augmentListingWithYelp } = await import('@/lib/rebuild/importListingYelp');
  const { enrichListingCopy } = await import('@/lib/rebuild/enrichListingCopy');
  const { buildRebuildTemplate } = await import('@/lib/rebuild/assembleDraft');
  const { mintSiteClaimToken } = await import('@/lib/auth/siteClaimToken');
  const { menuSiteUrl, MENU_BASE_DOMAIN } = await import('@/lib/menu/deliveredMenu');

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
  const ownerId = process.env.CEDARSITES_OPERATOR_ID || null;

  // Print-ready QR per lead (points at the claim link) for the leave-behind cards.
  const qrDir = file.replace(/\.json$/i, '') + '-qr';
  mkdirSync(qrDir, { recursive: true });

  const results: any[] = [];
  console.log(`\n▶ Importing ${leads.length} lead(s)…\n`);

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i] ?? {};
    const label = lead.query || lead.placeId || lead.listing?.name || `lead ${i + 1}`;
    try {
      // 1) Resolve the listing.
      let listing: any;
      // ⚠️ The Google place id is the only STABLE identity a listing has. Kept so a re-import can
      // recognise a restaurant it already built — see the upsert below.
      let sourcePlaceId: string | null = null;
      if (lead.listing?.name) {
        listing = lead.listing;
      } else if (lead.placeId) {
        sourcePlaceId = String(lead.placeId);
        listing = await fetchGooglePlace(sourcePlaceId);
      } else if (lead.query) {
        const { placeId } = await findPlace(String(lead.query));
        sourcePlaceId = placeId;
        listing = await fetchGooglePlace(placeId);
      } else {
        throw new Error('lead needs one of: query, placeId, or listing.name');
      }

      // 2) Menu from photos. Explicit menu photos win; otherwise augment with Yelp's
      //    photos (more menu candidates) and auto-detect which are menus.
      const explicit = Array.isArray(lead.photoUrls) && lead.photoUrls.length > 0;
      if (!explicit) listing = await augmentListingWithYelp(listing).catch(() => listing);
      let photoUrls: string[] = explicit ? lead.photoUrls.map(String) : (listing.photos ?? []);
      let menu;
      try {
        if (!explicit && photoUrls.length > 1) {
          const picked = await pickMenuPhotos(photoUrls, null).catch(() => []);
          if (picked.length) photoUrls = picked;
        }
        menu = photoUrls.length ? await menuFromPhotos(photoUrls, null) : undefined;
      } catch {
        menu = undefined;
      }

      // 3) Assemble + insert a claimable draft. Upgrade the templated copy to clean,
      //    name+locale SEO-grounded copy (best-effort LLM; falls back to templated).
      const baseSpec = buildSpecFromListing(listing, menu);
      const spec = await enrichListingCopy(baseSpec, { menu, operatorId: ownerId });
      const tpl = buildRebuildTemplate({ spec, heroImage: listing.photos?.[0] ?? null, sourceUrl: listing.website ?? null });

      // ⚠️ STAMP THE PLACE ID INTO THE DRAFT. Without it a re-import has no way to tell "the same
      // restaurant again" from "a different restaurant with a similar name", which is why the
      // retry below used to manufacture a twin.
      if (sourcePlaceId) {
        tpl.data = { ...tpl.data, meta: { ...(tpl.data?.meta ?? {}), source_place_id: sourcePlaceId } };
      }

      // ⚠️ THE RETRY LOOP WAS THE DUPLICATION MECHANISM, AND IT LOOKED LIKE RESILIENCE. On a slug
      // collision (23505) it appended a random suffix and inserted a NEW ROW — so re-importing a
      // city reliably produced a second draft of every restaurant already in it. That is how
      // `the-local-907-ljdit` and `the-local-907-tqgh2` came to exist: not a bug that fired, a
      // fallback that worked exactly as written. The collision was the system telling us we
      // already had this business, and we treated it as a naming inconvenience.
      // Two ways to recognise a restaurant we already built:
      //   1. the Google place id we now stamp — exact, and the right long-term key;
      //   2. the base slug — because ⚠️ EVERY DRAFT THAT ALREADY EXISTS PREDATES (1). 127 of them
      //      carry no place id, so a place-id-only check would have been correct and useless: it
      //      would prevent the next duplicate while re-duplicating everything already imported,
      //      which is the shape of fix that passes review and changes nothing.
      const byPlace = sourcePlaceId
        ? (await db
            .from('templates')
            .select('id, slug')
            .eq('claim_source', 'listing_import')
            .eq('data->meta->>source_place_id', sourcePlaceId)
            .maybeSingle()).data
        : null;

      const bySlug = byPlace
        ? null
        : (await db
            .from('templates')
            .select('id, slug')
            .eq('claim_source', 'listing_import')
            .eq('base_slug', tpl.slug.replace(/-[a-z0-9]{4,5}$/, ''))
            .limit(1)
            .maybeSingle()).data;

      const existing = byPlace ?? bySlug;

      if (existing?.id) {
        // ⚠️ UPDATE, NEVER A SECOND ROW — and never a blind overwrite either. An operator may have
        // corrected this draft by hand, and a re-import must not silently discard that. Only the
        // menu and the identity we just read are refreshed; everything else stands.
        // ⚠️ THROUGH THE SANCTIONED RPC, NOT A DIRECT UPDATE. `app.guard_templates_update` blocks
        // direct writes to `templates` (CLAUDE.md §8) — my first version hit exactly that, which
        // is the guard working: it failed loudly instead of letting a script bypass the commit
        // path every other writer goes through. Note it failed AFTER the de-dup decision, so no
        // duplicate row was created either way.
        const { data: cur } = await db.from('templates').select('rev').eq('id', existing.id).maybeSingle();
        const { commitTemplatePatch } = await import('../lib/templates/commitTemplatePatch');
        const upErr = await commitTemplatePatch(
          existing.id,
          Number((cur as any)?.rev ?? 0),
          { data: tpl.data, business_name: tpl.business_name },
          ownerId ?? null,
        );
        if (upErr) throw new Error(upErr);
        const menuItemCount = (menu?.sections ?? []).reduce((n: number, sec: any) => n + sec.items.length, 0);
        const source = explicit ? 'manual' : menuItemCount > 0 ? 'auto' : 'none';
        results.push({
          ok: true,
          updated: true,
          businessName: spec.businessName,
          draftId: existing.id,
          slug: existing.slug,
          editorUrl: `${PUBLIC_BASE}/admin/templates/${existing.id}`,
          phone: spec.contact?.phone ?? null,
          menuSections: menu?.sections?.length ?? 0,
          menuItems: menuItemCount,
          menuSource: source,
        });
        console.log(`  ↻ ${spec.businessName} — updated the existing draft (same Google place)`);
        continue;
      }

      let insertedId: string | null = null;
      let slug = tpl.slug;
      for (let attempt = 0; attempt < 3 && !insertedId; attempt++) {
        const row: any = {
          id: uuid(),
          template_name: attempt === 0 ? tpl.template_name : `${tpl.template_name} ${attempt + 1}`,
          slug,
          data: tpl.data,
          color_mode: tpl.color_mode,
          header_block: tpl.header_block,
          footer_block: tpl.footer_block,
          is_site: false,
          industry: tpl.industry,
          business_name: tpl.business_name,
          claim_source: 'listing_import',
          ...(ownerId ? { owner_id: ownerId } : {}),
        };
        const { data, error } = await db.from('templates').insert(row).select('id, slug').single();
        if (!error && data) { insertedId = data.id; slug = data.slug; break; }
        if (error && `${error.code}` === '23505') { slug = `${tpl.slug}-${Math.random().toString(36).slice(2, 5)}`; continue; }
        throw new Error(error?.message || 'insert failed');
      }
      if (!insertedId) throw new Error('could not allocate a unique draft');

      const menuItems = (menu?.sections ?? []).reduce((n: number, s: any) => n + s.items.length, 0);
      // menuSource measures the auto-detection: 'auto' = read from listing photos,
      // 'manual' = operator supplied a menu photo, 'none' = no menu found (needs one).
      const menuSource = explicit ? 'manual' : menuItems > 0 ? 'auto' : 'none';
      // Prefer the branded delivered.menu URL when the surface is live; else relative preview.
      const previewUrl = MENU_BASE_DOMAIN ? menuSiteUrl(slug) : `${PUBLIC_BASE}/preview/${slug}`;
      const claimUrl = `${PUBLIC_BASE}/claim-site/${insertedId}?token=${encodeURIComponent(mintSiteClaimToken(insertedId))}`;

      // Ready-to-print QR (encodes the claim link → preview + one-tap claim). Owner-facing.
      const qrPath = `${qrDir}/${slug}.png`;
      try {
        await QRCode.toFile(qrPath, claimUrl, { width: 600, margin: 2, errorCorrectionLevel: 'M' });
      } catch { /* QR is a nicety — never fail the import over it */ }

      // Diner-facing ORDER QR (encodes the public menu URL). This is the one to put on a
      // window sticker / table tent — it's how real diners land on the draft and generate
      // the demand signal (a noindex draft otherwise has no traffic source).
      const orderQrPath = `${qrDir}/${slug}-order.png`;
      try {
        await QRCode.toFile(orderQrPath, previewUrl, { width: 600, margin: 2, errorCorrectionLevel: 'M' });
      } catch { /* nicety */ }

      const rec = {
        ok: true,
        businessName: spec.businessName,
        draftId: insertedId,
        slug,
        editorUrl: `${PUBLIC_BASE}/admin/templates/${insertedId}`,
        previewUrl,
        claimUrl,
        qrPath,
        orderQrPath,
        phone: spec.contact?.phone ?? null,
        menuSections: menu?.sections?.length ?? 0,
        menuItems,
        menuSource,
      };
      results.push(rec);
      const tag = menuSource === 'auto' ? '🍽 auto' : menuSource === 'manual' ? '🍽 manual' : '— no menu';
      console.log(`  ✓ ${rec.businessName} — ${menuItems} item(s) [${tag}] · claim: ${claimUrl}`);
    } catch (e: any) {
      const msg = e instanceof (ListingImportError as any) ? `[${(e as any).code}] ${e.message}` : e?.message || String(e);
      results.push({ ok: false, label, error: msg });
      console.log(`  ✗ ${label} — ${msg}`);
    }
  }

  const out = file.replace(/\.json$/i, '') + '-results.json';
  writeFileSync(out, JSON.stringify(results, null, 2));
  const ok = results.filter((r) => r.ok).length;

  // Menu hit-rate — the signal for whether paying for more photo access (Yelp
  // Premium) is worth it: a high "needs a photo" count means auto-detection is
  // missing menus, so more photos might help; a low count means don't bother.
  const okRecs = results.filter((r) => r.ok);
  const auto = okRecs.filter((r) => r.menuSource === 'auto').length;
  const manual = okRecs.filter((r) => r.menuSource === 'manual').length;
  const none = okRecs.filter((r) => r.menuSource === 'none').length;
  const autoEligible = auto + none; // leads relying on auto-detection (no supplied photo)
  const hitRate = autoEligible ? Math.round((auto / autoEligible) * 100) : 0;

  // ⚠️ "imported" counted updates as new sites. A tally that cannot tell "I built 25 things" from
  // "I refreshed 25 things I already had" is the same defect as a timestamp standing in for a
  // record — it reads like progress either way, which is exactly when you stop checking.
  const updated = okRecs.filter((r: any) => r.updated).length;
  const created = ok - updated;
  console.log(
    `\n✅ ${ok}/${leads.length} processed — ${created} new draft(s)` +
      (updated ? `, ${updated} existing refreshed (same Google place)` : '') +
      `. Results → ${out}`,
  );
  console.log(`🔳 Print-ready QR codes → ${qrDir}/  (<slug>.png = owner claim · <slug>-order.png = diner order sticker)`);
  console.log(`🍽  Menu: ${auto} auto-detected · ${manual} from a supplied photo · ${none} need a menu photo`);
  if (autoEligible) console.log(`   Auto-detect hit rate: ${hitRate}% (${auto}/${autoEligible} without a supplied photo)`);
  if (none > 0) console.log(`   → ${none} would benefit from more photo access (Yelp Premium) or a supplied menu photo.`);
  if (!PUBLIC_BASE) console.log('   (set NEXT_PUBLIC_APP_URL for absolute preview URLs)');
}

main().catch((e) => {
  console.error('❌', e?.message || e);
  process.exit(1);
});
