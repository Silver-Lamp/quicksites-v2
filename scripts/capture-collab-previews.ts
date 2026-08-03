// scripts/capture-collab-previews.ts
//
// Screenshot each layout in a collab and store it, so the client can COMPARE the options rather
// than read three names and open three tabs.
//
// ⚠️ WHY NOT THE EXISTING THUMBNAIL ENDPOINT. /api/public/showcase/[slug]/thumb renders a branded
// monogram card — name, initial, "Built with QuickSites". That is right for a marketing showcase
// and useless here: all three of a client's options would look nearly identical, which defeats
// the entire purpose of showing three. It also stamps our badge on her options and renders light
// while her sites are dark.
//
// ⚠️ WHY NOT AN IFRAME. Tenant sites send no X-Frame-Options, so it would work — but three live
// embeds is three full page loads on a phone, each carrying the "Hear this page" launcher and its
// own scroll behaviour. A still image is faster, calmer, and cannot misbehave; "Open it" is one
// tap away for the real thing.
//
// ⚠️ THESE GO STALE. A screenshot is a claim about how a site looked at a moment. Re-run this
// after editing any variant, or the client compares yesterday's layout against today's.
//
//   npx tsx --env-file=.env.local scripts/capture-collab-previews.ts <collab-id>
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'previews';

async function main() {
  const collabId = process.argv[2];
  if (!collabId) throw new Error('usage: capture-collab-previews.ts <collab-id>');

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );

  const { data: collab } = await db
    .from('client_collabs')
    .select('template_ids')
    .eq('id', collabId)
    .single();
  if (!collab?.template_ids?.length) throw new Error('collab not found or has no options');

  const { data: templates } = await db
    .from('templates')
    .select('id, slug')
    .in('id', collab.template_ids);

  const browser = await chromium.launch();
  for (const id of collab.template_ids as string[]) {
    const t = (templates ?? []).find((x: any) => x.id === id);
    if (!t?.slug) continue;

    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const url = `https://${t.slug}.quicksites.ai/`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
      // Let fonts settle; a screenshot mid-swap shows a layout the visitor never sees.
      await page.waitForTimeout(1500);
      // Hide our own floating launcher — it is QuickSites chrome, not part of her site, and it
      // would appear identically on all three, adding noise to the one thing being compared.
      await page.addStyleTag({
        content: '[class*="fixed"][class*="bottom"]{display:none !important}',
      });
      await page.waitForTimeout(200);

      const buf = await page.screenshot({ type: 'png' });
      const path = `collab/${t.slug}.png`;
      const up = await db.storage.from(BUCKET).upload(path, buf, {
        contentType: 'image/png',
        upsert: true, // regenerate in place, so the URL is stable
      });
      if (up.error) {
        console.log(`  ${t.slug}: upload failed — ${up.error.message}`);
      } else {
        const { data } = db.storage.from(BUCKET).getPublicUrl(path);
        console.log(`  ${t.slug}: ${data.publicUrl}`);
      }
    } catch (e: any) {
      console.log(`  ${t.slug}: capture failed — ${e?.message ?? e}`);
    } finally {
      await page.close();
    }
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
