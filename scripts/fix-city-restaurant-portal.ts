// scripts/fix-city-restaurant-portal.ts
//
// Turn a <city>-restaurant.com portal into an actual directory.
//
// THE BUG: renton-restaurant.com was built from the SINGLE-RESTAURANT food scaffold
// (hero, menu, location, hours, faq, contact_form, order_bar). So a city portal shipped with
// "Our Menu — Breakfast / Lunch / Dinner" and a street address, as though the city itself
// were a restaurant. Its hero promised "Browse the spots below" and the next thing on the
// page was a menu for a restaurant that doesn't exist.
//
// Everything needed to render it properly already existed — the `restaurants_directory`
// block, the cohort (outreach_prospects on the campaign) and the public feed. Only the block
// was missing. This script swaps the single-restaurant blocks for the directory.
//
// THE COPY IS THE OTHER HALF, and it is not cosmetic. The old hero said "direct online
// ordering — no middleman markup" while every restaurant in the cohort is an UNCLAIMED draft
// that cannot take an order: no merchant, no Stripe, no claimed owner. That is a live public
// page, naming five real Renton businesses, promising a capability that does not exist. The
// replacement promises only what works today (browse the menu, call the restaurant) and says
// plainly that online ordering arrives per-restaurant as each one claims its page.
//
//   npx tsx scripts/fix-city-restaurant-portal.ts <slug>            # dry run
//   npx tsx scripts/fix-city-restaurant-portal.ts <slug> --apply
//
// Requires the campaign to exist with kind='restaurant_competition' and its cohort attached.
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const SLUG = process.argv.find((a) => !a.startsWith('--') && !a.endsWith('.ts') && !a.includes('/'))
  || 'renton-restaurant';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
if (!url || !serviceKey) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY');
  process.exit(1);
}
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

// Single-restaurant blocks that make no sense on a city portal, PLUS the directory itself —
// dropping and re-adding it is what makes this script idempotent. Without that, a second run
// appends a second directory (observed: 4 blocks → 5), and a portal quietly ends up listing
// its cohort twice.
const DROP = new Set(['menu', 'location', 'hours', 'order_bar', 'restaurants_directory']);

async function main() {
  const { data: tpl } = await db
    .from('templates')
    .select('id, slug, rev, published, data')
    .eq('slug', SLUG)
    .maybeSingle();
  if (!tpl) {
    console.error(`no template with slug ${SLUG}`);
    process.exit(1);
  }

  const data: any = tpl.data ?? {};
  const page = data?.pages?.[0];
  const blocks: any[] = page?.content_blocks ?? data?.blocks ?? [];
  if (!blocks.length) {
    console.error('template has no blocks');
    process.exit(1);
  }

  // The campaign is matched on the portal slug, and MUST be the competition kind — that is
  // what the directory feed filters on, so a mismatch here renders an empty block.
  const { data: campaign } = await db
    .from('geo_industry_campaigns')
    .select('id, city, region, domain, kind')
    .eq('slug', SLUG)
    .eq('kind', 'restaurant_competition')
    .maybeSingle();
  if (!campaign) {
    console.error(`no restaurant_competition campaign for slug ${SLUG}`);
    process.exit(1);
  }

  // Snapshot the cohort into `entries` so the block paints instantly and still renders if the
  // API is unreachable; `campaign_id` keeps it live for winner changes without a republish.
  const { data: prospects } = await db
    .from('outreach_prospects')
    .select('id, template_id, business_name')
    .eq('geo_campaign_id', campaign.id)
    .not('template_id', 'is', null);

  const ids = (prospects ?? []).map((p: any) => p.template_id);
  const { data: memberTpls } = await db
    .from('templates')
    .select('id, slug, business_name, custom_domain, published')
    .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  const byId = new Map((memberTpls ?? []).map((t: any) => [t.id, t]));

  const entries = (prospects ?? [])
    .map((p: any) => {
      const t: any = byId.get(p.template_id) ?? {};
      if (!t.slug) return null;
      return {
        template_id: p.template_id,
        slug: t.slug,
        business_name: t.business_name || p.business_name || t.slug,
        url: t.custom_domain ? `https://${t.custom_domain}` : `https://${t.slug}.delivered.menu`,
        hero_url: '',
        is_winner: false,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.business_name.localeCompare(b.business_name));

  const cityLabel = campaign.region ? `${campaign.city}, ${campaign.region}` : campaign.city;
  const n = entries.length;

  const next: any[] = [];
  for (const b of blocks) {
    const type = String(b?.type || '');

    if (type === 'hero') {
      next.push({
        ...b,
        content: {
          ...(b.content ?? {}),
          headline: `Order from local restaurants in ${cityLabel}`,
          // Honest about today. Every clause here is true of a visitor who clicks right now:
          // the menus are real, the phone numbers work, and nothing claims an order button
          // that does not exist.
          // ⚠️ This sentence has been wrong twice; both times because it promised something
          // the pages behind it couldn't do. First it claimed "direct online ordering" when
          // no restaurant could take an order. Then it claimed "see their menu" — but four of
          // five had no real menu, only scaffold placeholders, which have since been removed
          // (scripts/strip-placeholder-menus.ts) because there is no honest menu to publish:
          // no menu photo in their listing, and no website to scrape.
          //
          // So it now promises only the two things that are true of every entry: these are
          // real local kitchens, and the phone number works. Menus appear as owners claim.
          // Before editing this, check what the linked pages actually contain.
          subheadline:
            `${n} real ${campaign.city} kitchens — find them here and call them direct. ` +
            `No delivery-app markup, no commission out of the restaurant's pocket. ` +
            `Menus and online ordering appear as each restaurant claims their page.`,
          cta_text: 'Browse restaurants',
          cta_link: '#restaurants',
          hide_cta: false,
        },
      });
      // The directory goes immediately after the hero: the hero says "below", so "below" had
      // better be the restaurants.
      next.push({
        _id: `restaurants-directory-${campaign.id.slice(0, 8)}`,
        type: 'restaurants_directory',
        content: {
          title: `${campaign.city} restaurants`,
          campaign_id: campaign.id,
          entries,
        },
      });
      continue;
    }

    if (DROP.has(type)) continue; // single-restaurant furniture

    // The scaffold left generic CONTRACTOR boilerplate here — "How do I get a quote?",
    // "before any work begins". Wrong vertical, and it reads as abandoned. Replace it with
    // the three questions this page actually provokes, answered honestly: no, you can't order
    // online yet; yes, we built these sites unprompted from public listings; and here is how
    // you take yours over. The third is the funnel.
    if (type === 'faq') {
      next.push({
        ...b,
        content: {
          ...(b.content ?? {}),
          title: 'Questions',
          items: [
            {
              question: 'Can I order online from these restaurants?',
              answer:
                `Not yet, and most don't have a menu here either — we only publish a menu when ` +
                `we can source a real one, and we won't invent one. What's here is real: the ` +
                `right ${campaign.city} kitchens, their address, hours and a phone number that ` +
                `works. Menus and online ordering turn on for a restaurant once they claim ` +
                `their page and add them.`,
              appearance: 'default',
            },
            {
              question: 'Why does my restaurant have a page here?',
              answer:
                `We built it from your public listing — your menu, hours and phone number as they ` +
                `already appear online — so diners searching for ${campaign.city} food can find you ` +
                `with a working page instead of a dead link. It's free, it's yours to take over or ` +
                `take down, and nobody is charging you or your customers for it.`,
              appearance: 'default',
            },
            {
              question: "I own one of these restaurants — how do I take it over?",
              answer:
                `Open your restaurant's page and use the "Claim this site" bar at the top. Once you ` +
                `claim it you can fix anything we got wrong, switch on online ordering, and keep ` +
                `taking orders without a delivery app's commission.`,
              appearance: 'default',
            },
          ],
        },
      });
      continue;
    }

    next.push(b);
  }

  const dropped = blocks.filter((b: any) => DROP.has(String(b?.type))).map((b: any) => b.type);
  console.log(`${SLUG}: ${blocks.length} blocks → ${next.length}`);
  console.log(`  dropped: ${dropped.join(', ') || '(none)'}`);
  console.log(`  added:   restaurants_directory (${n} entries)`);
  console.log(`  cohort:  ${entries.map((e: any) => e.business_name).join(', ')}`);
  console.log(`  published: ${tpl.published}`);

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to write.');
    return;
  }

  // ⚠️ A page can carry BOTH `content_blocks` and a legacy `blocks` twin. The renderer reads
  // content_blocks, so writing only that LOOKS completely correct on the rendered page —
  // while the stale twin is still serialized into the HTML payload. On this portal that left
  // the sentence "direct online ordering — no middleman markup" sitting in the page source of
  // a site where nobody can order online. Invisible to a reader, still a false claim in the
  // document, and one render-path change away from being visible again. Write both.
  const nextData = { ...data };
  if (nextData?.pages?.[0]) {
    const page0: any = { ...nextData.pages[0], content_blocks: next };
    if (Array.isArray(nextData.pages[0].blocks)) page0.blocks = next;
    nextData.pages = [page0, ...nextData.pages.slice(1)];
  } else {
    nextData.blocks = next;
  }

  const { commitTemplatePatch } = await import('../lib/templates/commitTemplatePatch');
  const err = await commitTemplatePatch(tpl.id, tpl.rev ?? 0, { data: nextData }, null);
  if (err) {
    console.error(`commit failed: ${err}`);
    process.exit(1);
  }
  console.log('\n✅ committed.');

  // ── PUBLISH ─────────────────────────────────────────────────────────────────────────────
  // A commit is NOT a publish, and the gap is invisible from the DB: `templates.data` was
  // already correct while the live page still served "Our Menu" for the simple reason that
  // nothing reads templates.data. The public renderer resolves
  //   slug → newest published_sites row → its template_versions.full_data
  // so pushing live means writing a fresh snapshot and pointing a publish row at it. This
  // mirrors app/api/admin/snapshots/create/route.ts exactly (same column set), because a
  // half-shaped version row would render but lose history/diff context.
  const { data: ver, error: verErr } = await db
    .from('template_versions')
    .insert({
      template_id: tpl.id,
      template_name: (tpl as any).template_name ?? SLUG,
      full_data: nextData,
      diff: null,
      commit_message: 'city portal → restaurants_directory + honest ordering copy',
      editor_id: null,
      forced_revert: false,
      thumbnail_url: null,
    })
    .select('id')
    .single();
  if (verErr || !ver) {
    console.error(`snapshot failed: ${verErr?.message}`);
    process.exit(1);
  }

  // `domain` is NOT NULL on published_sites. Prefer the campaign's real apex
  // (renton-restaurant.com) over the platform subdomain — it is what the portal is actually
  // reachable at and what the row is for.
  const publishDomain =
    campaign.domain || (tpl as any).custom_domain || `${SLUG}.delivered.menu`;

  // `published_sites_template_unique` means one publish row per template — publishing is an
  // UPDATE of where that row points, not an append. (The renderer's "newest published_sites
  // row" query reads as if there could be many; there can't.)
  const { data: existingPub } = await db
    .from('published_sites')
    .select('id')
    .eq('template_id', tpl.id)
    .maybeSingle();

  const { error: pubErr } = existingPub
    ? await db
        .from('published_sites')
        .update({ snapshot_id: ver.id, domain: publishDomain, published_at: new Date().toISOString() })
        .eq('id', existingPub.id)
    : await db
        .from('published_sites')
        .insert({ template_id: tpl.id, snapshot_id: ver.id, domain: publishDomain });
  if (pubErr) {
    console.error(`publish failed: ${pubErr.message}`);
    process.exit(1);
  }

  console.log(`✅ published — snapshot ${ver.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
