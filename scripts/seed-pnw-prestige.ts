// scripts/seed-pnw-prestige.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(url, key, { auth: { persistSession: false } });
const uuid = () => crypto.randomUUID();

async function main() {
  const pageId = uuid();
  const blockId = uuid();

  const content = {
    brand: 'PNW On Demand Services',
    tagline: 'Exterior Cleaning • Roof & Gutter • Pressure & Soft Wash',
    subTagline: 'Premium care for homes & businesses across the Pacific Northwest.',
    ctaLabel: 'Get a Free Quote',
    phone: '(253) 204-1960',
    email: 'team@example.com',
    address: 'Puget Sound, WA',
    badges: ['Licensed', 'Insured', 'Eco-Safe', '5★ Rated'],
    services: [
      { title: 'Roof & Gutter Cleaning', blurb: 'Gentle, effective debris removal', bullets: ['Moss treatment','Downspout flush','Prevention plan'] },
      { title: 'Exterior House Washing', blurb: 'Soft-wash safe for siding', bullets: ['Mildew & algae','Low-pressure','Rinse-to-shine'] },
      { title: 'Pressure Washing', blurb: 'Driveways, sidewalks, decks, patios', bullets: ['Oil/rust reduction','Slip-safe clean'] },
      { title: 'Commercial & Residential', blurb: 'Reliable scheduling, pro results' },
    ],
    packages: [
      { name: 'Refresh', price: '$349+', description: 'Siding soft-wash + front walk' },
      { name: 'Signature', price: '$799+', description: 'Roof & gutters + house wash + driveway', featured: true },
      { name: 'Pro Care', price: 'Custom', description: 'Commercial/estates maintenance' },
    ],
    portfolio: [],
    testimonials: [],
    serviceAreas: ['Auburn','Kent','Renton','Maple Valley','Federal Way','Tacoma'],
    footerNote: `© ${new Date().getFullYear()} PNW On Demand Services. All rights reserved.`,
  };

  const row = {
    id: uuid(),
    template_name: 'PNW Prestige – Exterior Cleaning',
    slug: 'pnw-prestige-cleaning',
    layout: 'single',
    color_scheme: 'emerald',
    theme: 'dark',
    brand: 'green',
    industry: 'exterior_cleaning',
    is_site: false,
    published: false,
    verified: false,
    // Store blocks under data.pages (your editor supports this)
    data: {
      color_mode: 'dark',
      pages: [
        {
          id: pageId,
          slug: '',
          title: 'Home',
          content_blocks: [
            {
              id: blockId,
              type: 'exterior_agency',
              props: { content },
            },
          ],
          show_header: true,
          show_footer: true,
          meta: { title: 'Home', visible: true },
        },
      ],
    },
    // NOTE: no headerBlock/footerBlock here
  };

  const { data, error } = await supabase
    .from('templates')
    .upsert(row, { onConflict: 'slug' })
    .select('id, slug, template_name');

  if (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
  console.log('Seeded/updated:', data?.[0]);
}

main();
