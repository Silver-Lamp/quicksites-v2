// scripts/seed-demo-food-city.ts
//
// Seed a FICTIONAL city of restaurants with rich, tagged menus — the development target for
// the "what are you hungry for?" tag-search.
//
// ⚠️ WHY NOT JUST FILL IN THE RENTON MENUS. burnett-s-pub-2bvmo.delivered.menu carries
// Burnett's Pub's real name, real address and a real phone number. Sample dishes there mean a
// diner can ring them and order something that does not exist — which is exactly what
// scripts/strip-placeholder-menus.ts removed, and it has nothing to do with SEO rankings. The
// businesses here are invented, so nobody can be misquoted.
//
// It is also BETTER test data. These menus are authored to exercise a tag-search rather than
// to be typical: overlapping tags, dietary edge cases (vegan AND gluten-free AND spicy on one
// item), price bands from $4 to $38, cuisines that share ingredients, and deliberate near-miss
// names ("Chili Oil Wontons" vs "Wonton Soup") so ranking and filtering have something to get
// wrong. A real cohort would not have given you that even with real menus.
//
// Every site is claim_source='demo_seed' + meta.is_demo — the existing convention (see
// lib/builder/generateDemoSite.ts) — so they are identifiable and excludable everywhere.
//
//   npx tsx scripts/seed-demo-food-city.ts            # dry run
//   npx tsx scripts/seed-demo-food-city.ts --apply
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
if (!url || !serviceKey) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY');
  process.exit(1);
}
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

// A city that does not exist, so no real business anywhere shares the name.
const CITY = 'Marrowdale';
const REGION = 'WA';

type Item = { name: string; description?: string; price: string; tags: string[] };
type Section = { name: string; items: Item[] };
type Hours = { tz: string; days: Array<{ key: string; label: string; closed?: boolean; periods?: Array<{ open: string; close: string }> }> };
type Demo = { name: string; slug: string; cuisines: string[]; phone: string; sections: Section[]; hours?: Hours };

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Schedules are deliberately VARIED so the "open now" filter has all three states to render at
 * any hour: a late-night bar (crosses midnight), a bakery that shuts mid-afternoon, and one
 * place closed on Mondays. A cohort where everything is open 9-5 would let a broken open-now
 * check pass unnoticed.
 */
function hours(open: string, close: string, closedDay?: number): Hours {
  return {
    tz: 'America/Los_Angeles',
    days: DAYS.map((key, i) => ({
      key,
      label: LABELS[i],
      closed: closedDay === i,
      periods: closedDay === i ? [] : [{ open, close }],
    })),
  };
}

const DEMOS: Demo[] = [
  {
    name: 'Copper Kettle Noodle House',
    slug: 'demo-copper-kettle-noodle-house',
    hours: hours('11:00', '22:00'),
    cuisines: ['Chinese restaurant', 'Noodle shop'],
    phone: '(555) 0100',
    sections: [
      {
        name: 'Small plates',
        items: [
          { name: 'Chili Oil Wontons', description: 'Pork wontons, black vinegar, chili crisp.', price: '$11', tags: ['spicy', 'pork', 'shareable'] },
          { name: 'Smashed Cucumber', description: 'Garlic, sesame, rice vinegar.', price: '$7', tags: ['vegan', 'gluten-free', 'cold', 'light'] },
          { name: 'Scallion Pancake', price: '$8', tags: ['vegetarian', 'shareable'] },
        ],
      },
      {
        name: 'Noodles',
        items: [
          { name: 'Wonton Soup', description: 'Clear broth, pork and shrimp wontons.', price: '$14', tags: ['soup', 'pork', 'shellfish', 'comfort'] },
          { name: 'Dan Dan Noodles', description: 'Sesame, preserved mustard, ground pork.', price: '$16', tags: ['spicy', 'pork', 'noodles'] },
          { name: 'Mushroom Hand-Pulled Noodles', price: '$15', tags: ['vegan', 'noodles', 'umami'] },
          { name: 'Beef Brisket Noodle Soup', description: 'Five-spice broth, bok choy.', price: '$18', tags: ['beef', 'soup', 'noodles', 'comfort'] },
        ],
      },
    ],
  },
  {
    name: 'Alder & Ash',
    slug: 'demo-alder-and-ash',
    hours: hours('16:00', '01:00'),
    cuisines: ['American restaurant', 'Wood-fired'],
    phone: '(555) 0101',
    sections: [
      {
        name: 'From the fire',
        items: [
          { name: 'Wood-Fired Half Chicken', description: 'Lemon, thyme, charred onion.', price: '$26', tags: ['chicken', 'gluten-free', 'main'] },
          { name: 'Dry-Aged Ribeye', description: '14oz, bone marrow butter.', price: '$38', tags: ['beef', 'splurge', 'main'] },
          { name: 'Charred Cauliflower Steak', description: 'Romesco, toasted hazelnut.', price: '$19', tags: ['vegan', 'gluten-free', 'main'] },
        ],
      },
      {
        name: 'Sides',
        items: [
          { name: 'Ember Potatoes', price: '$9', tags: ['vegetarian', 'gluten-free', 'side'] },
          { name: 'Little Gem Salad', description: 'Buttermilk, dill, cucumber.', price: '$12', tags: ['vegetarian', 'light', 'side'] },
        ],
      },
    ],
  },
  {
    name: 'Salt Line Taqueria',
    slug: 'demo-salt-line-taqueria',
    hours: hours('10:00', '23:00'),
    cuisines: ['Mexican restaurant', 'Taqueria'],
    phone: '(555) 0102',
    sections: [
      {
        name: 'Tacos',
        items: [
          { name: 'Al Pastor', description: 'Pork shoulder, pineapple, onion.', price: '$4', tags: ['pork', 'gluten-free', 'cheap-eats'] },
          { name: 'Baja Fish', description: 'Beer-battered cod, cabbage, crema.', price: '$5', tags: ['fish', 'fried'] },
          { name: 'Hongos', description: 'Roasted mushroom, salsa verde.', price: '$4', tags: ['vegan', 'gluten-free', 'cheap-eats'] },
          { name: 'Birria', description: 'Slow-braised beef, consommé for dipping.', price: '$6', tags: ['beef', 'rich', 'popular'] },
        ],
      },
      {
        name: 'Bigger',
        items: [
          { name: 'Birria Ramen', description: 'The consommé, but with noodles.', price: '$17', tags: ['beef', 'noodles', 'soup', 'fusion'] },
          { name: 'Chile Relleno', description: 'Poblano, queso, ranchera.', price: '$16', tags: ['vegetarian', 'spicy', 'main'] },
        ],
      },
    ],
  },
  {
    name: 'Fennel Street Bakery',
    slug: 'demo-fennel-street-bakery',
    hours: hours('07:00', '15:00'),
    cuisines: ['Bakery', 'Cafe'],
    phone: '(555) 0103',
    sections: [
      {
        name: 'Morning',
        items: [
          { name: 'Cardamom Bun', price: '$5', tags: ['vegetarian', 'sweet', 'breakfast'] },
          { name: 'Ham & Gruyère Croissant', price: '$7', tags: ['pork', 'breakfast'] },
          { name: 'Gluten-Free Almond Cake', price: '$6', tags: ['vegetarian', 'gluten-free', 'sweet'] },
        ],
      },
      {
        name: 'Lunch',
        items: [
          { name: 'Roast Squash Sandwich', description: 'Whipped feta, pickled shallot.', price: '$13', tags: ['vegetarian', 'sandwich', 'lunch'] },
          { name: 'Tomato Soup', description: 'With a cheddar toastie.', price: '$12', tags: ['vegetarian', 'soup', 'comfort', 'lunch'] },
        ],
      },
    ],
  },
  {
    name: 'The Quiet Pearl',
    slug: 'demo-the-quiet-pearl',
    hours: hours('16:00', '23:00', 1),
    cuisines: ['Seafood restaurant', 'Oyster bar'],
    phone: '(555) 0104',
    sections: [
      {
        name: 'Raw',
        items: [
          { name: 'Half Dozen Oysters', price: '$21', tags: ['shellfish', 'gluten-free', 'cold', 'splurge'] },
          { name: 'Hamachi Crudo', description: 'Yuzu, chili, olive oil.', price: '$19', tags: ['fish', 'gluten-free', 'spicy', 'cold'] },
        ],
      },
      {
        name: 'Hot',
        items: [
          { name: 'Clam Chowder', price: '$14', tags: ['shellfish', 'soup', 'comfort'] },
          { name: 'Fish & Chips', price: '$22', tags: ['fish', 'fried', 'main'] },
          { name: 'Grilled Whole Branzino', price: '$32', tags: ['fish', 'gluten-free', 'main', 'splurge'] },
        ],
      },
    ],
  },
  {
    name: 'Mira Vegan Kitchen',
    slug: 'demo-mira-vegan-kitchen',
    hours: hours('11:00', '21:00'),
    cuisines: ['Vegan restaurant', 'Health food'],
    phone: '(555) 0105',
    sections: [
      {
        name: 'Bowls',
        items: [
          { name: 'Harissa Chickpea Bowl', description: 'Freekeh, preserved lemon, herbs.', price: '$15', tags: ['vegan', 'spicy', 'bowl', 'healthy'] },
          { name: 'Sesame Tofu Bowl', description: 'Brown rice, cucumber, crispy shallot.', price: '$14', tags: ['vegan', 'gluten-free', 'bowl', 'healthy'] },
        ],
      },
      {
        name: 'Plates',
        items: [
          { name: 'Jackfruit Birria Tacos', price: '$13', tags: ['vegan', 'gluten-free', 'spicy'] },
          { name: 'Mushroom Wellington', price: '$24', tags: ['vegan', 'main', 'splurge'] },
          { name: 'Cashew Mac', description: 'No dairy, still filthy.', price: '$16', tags: ['vegan', 'comfort', 'main'] },
        ],
      },
    ],
  },
];

function buildTemplateData(d: Demo) {
  const blocks = [
    {
      _id: `${d.slug}-hero`,
      type: 'hero',
      content: {
        headline: d.name,
        subheadline: `${d.cuisines.join(' · ')} — call ahead or stop by.`,
        image_url: '',
      },
    },
    {
      _id: `${d.slug}-menu`,
      type: 'menu',
      // Fictional menus, dated now so the dev target exercises the FRESH path. Without this
      // every demo price renders "call to confirm" and the finder looks broken rather than honest.
      content: { title: 'Menu', currency: 'USD', sections: d.sections, verified_at: new Date().toISOString() },
    },
    {
      _id: `${d.slug}-location`,
      type: 'location',
      content: {
        title: 'Find Us',
        business_name: d.name,
        address: `${100 + Math.floor(Math.random() * 800)} Main St, ${CITY}, ${REGION}`,
        phone: d.phone,
        show_map: false,
      },
    },
    ...(d.hours ? [{ _id: `${d.slug}-hours`, type: 'hours', content: { title: 'Hours', ...d.hours } }] : []),
    { _id: `${d.slug}-order`, type: 'order_bar', content: { phone: d.phone, enabled: true, cta_href: '#menu', cta_label: 'View Menu', call_label: 'Call' } },
  ];

  return {
    color_mode: 'light',
    services: d.cuisines,
    meta: {
      // The marker every other demo uses (lib/builder/generateDemoSite.ts).
      is_demo: true,
      business_name: d.name,
      industry: 'restaurant',
      industry_label: 'Restaurant',
      services: d.cuisines,
      city: CITY,
      state: REGION,
      title: `${d.name} — ${d.cuisines[0]} in ${CITY}, ${REGION}`,
      description: `${d.name} — ${d.cuisines[0].toLowerCase()} in ${CITY}, ${REGION}. Sample data for development.`,
      contact: { phone: d.phone, city: CITY, state: REGION },
    },
    pages: [{ id: 'home', slug: 'index', title: 'Home', path: '/', show_header: true, show_footer: true, content_blocks: blocks, blocks }],
  };
}

async function main() {
  const totalItems = DEMOS.reduce((n, d) => n + d.sections.reduce((m, s) => m + s.items.length, 0), 0);
  const tags = new Set(DEMOS.flatMap((d) => d.sections.flatMap((s) => s.items.flatMap((i) => i.tags))));

  console.log(`${DEMOS.length} fictional restaurants in ${CITY}, ${REGION}`);
  console.log(`${totalItems} menu items, ${tags.size} distinct tags`);
  console.log(`tags: ${[...tags].sort().join(', ')}\n`);
  for (const d of DEMOS) {
    const n = d.sections.reduce((m, s) => m + s.items.length, 0);
    console.log(`  ${d.slug.padEnd(36)} ${String(n).padStart(2)} items  ${d.cuisines.join(' · ')}`);
  }

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to create.');
    return;
  }

  console.log('');
  const templateIds: string[] = [];
  for (const d of DEMOS) {
    const { data: existing } = await db.from('templates').select('id').eq('slug', d.slug).maybeSingle();
    if (existing) {
      // Re-runs backfill anything the first pass lacked (hours were added after the initial
      // seed) rather than skipping outright — otherwise the fix never reaches seeded rows.
      // Direct UPDATEs to templates are blocked by app.guard_templates_update — go through
      // the sanctioned commit path, same as every other server-side template write.
      const { commitTemplatePatch } = await import('../lib/templates/commitTemplatePatch');
      const { data: cur } = await db.from('templates').select('rev').eq('id', (existing as any).id).maybeSingle();
      const upErr = await commitTemplatePatch(
        (existing as any).id,
        (cur as any)?.rev ?? 0,
        { data: buildTemplateData(d) },
        null,
      );
      console.log(`  ${upErr ? '✗' : '↻'} ${d.slug}${upErr ? ' ' + upErr : ' refreshed'}`);
      templateIds.push((existing as any).id);
      continue;
    }
    const { data, error } = await db
      .from('templates')
      .insert({
        template_name: d.name,
        slug: d.slug,
        data: buildTemplateData(d),
        industry: 'restaurant',
        business_name: d.name,
        city: CITY,
        phone: d.phone,
        claim_source: 'demo_seed',
        is_site: true,
        published: false,
        archived: false,
        color_mode: 'light',
      })
      .select('id')
      .single();
    if (error) {
      console.error(`  ✗ ${d.slug}: ${error.message}`);
      continue;
    }
    templateIds.push((data as any).id);
    console.log(`  ✓ ${d.slug}`);
  }

  // A campaign so the city portal has a cohort to render — the tag-search's dev target.
  const campaignSlug = `demo-${CITY.toLowerCase()}-restaurant`;
  const { data: camp } = await db
    .from('geo_industry_campaigns')
    .select('id')
    .eq('slug', campaignSlug)
    .maybeSingle();

  let campaignId = (camp as any)?.id;
  if (!campaignId) {
    const { data: made, error } = await db
      .from('geo_industry_campaigns')
      .insert({
        city: CITY,
        region: REGION,
        industry_key: 'restaurant',
        kind: 'restaurant_competition',
        domain: `${campaignSlug}.example`,
        slug: campaignSlug,
        status: 'draft',
        domain_status: 'planned',
        notes: 'DEMO — fictional businesses, sample menus. Development target for the menu tag-search.',
      })
      .select('id')
      .single();
    if (error) {
      console.error(`campaign: ${error.message}`);
      process.exit(1);
    }
    campaignId = (made as any).id;
    console.log(`\n  ✓ campaign ${campaignSlug}`);
  } else {
    console.log(`\n  = campaign ${campaignSlug} already exists`);
  }

  for (let i = 0; i < DEMOS.length; i++) {
    const tid = templateIds[i];
    if (!tid) continue;
    const { data: existing } = await db
      .from('outreach_prospects')
      .select('id')
      .eq('geo_campaign_id', campaignId)
      .eq('template_id', tid)
      .maybeSingle();
    if (existing) continue;
    // `place_id` is NOT NULL with no default. Omitting it made every insert fail — silently,
    // because the first version ignored the error and reported success anyway. Synthetic and
    // obviously fake, so it can never collide with a real Google place id.
    const { error: pErr } = await db.from('outreach_prospects').insert({
      geo_campaign_id: campaignId,
      template_id: tid,
      place_id: `demo:${DEMOS[i].slug}`,
      business_name: DEMOS[i].name,
      address: `${CITY}, ${REGION}`,
      phone: DEMOS[i].phone,
    });
    if (pErr) console.error(`  ✗ prospect ${DEMOS[i].slug}: ${pErr.message}`);
  }

  // The portal template the city page renders from. fix-city-restaurant-portal.ts needs a
  // template at the campaign's slug to swap the directory block into.
  const { data: portal } = await db.from('templates').select('id').eq('slug', campaignSlug).maybeSingle();
  if (!portal) {
    const { error: portalErr } = await db.from('templates').insert({
      template_name: `${CITY} Restaurants`,
      slug: campaignSlug,
      industry: 'restaurant',
      business_name: `${CITY} Restaurants`,
      city: CITY,
      claim_source: 'demo_seed',
      is_site: true,
      published: false,
      archived: false,
      color_mode: 'light',
      data: {
        color_mode: 'light',
        meta: { is_demo: true, industry: 'restaurant', industry_label: 'Restaurant', city: CITY, state: REGION,
                title: `${CITY} Restaurants` },
        pages: [{ id: 'home', slug: 'index', title: 'Home', path: '/', show_header: true, show_footer: true,
          content_blocks: [
            { _id: 'portal-hero', type: 'hero', content: { headline: `${CITY} Restaurants`, subheadline: '' } },
            { _id: 'portal-faq', type: 'faq', content: { title: 'Questions', items: [] } },
          ],
          blocks: [
            { _id: 'portal-hero', type: 'hero', content: { headline: `${CITY} Restaurants`, subheadline: '' } },
            { _id: 'portal-faq', type: 'faq', content: { title: 'Questions', items: [] } },
          ],
        }],
      },
    });
    if (portalErr) console.error(`  ✗ portal template: ${portalErr.message}`);
    else console.log(`  ✓ portal template ${campaignSlug}`);
  }

  console.log(`\n✅ ${DEMOS.length} demo restaurants + campaign ${campaignId}`);
  console.log(`   Build the portal:  npx tsx scripts/fix-city-restaurant-portal.ts ${campaignSlug} --apply`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
