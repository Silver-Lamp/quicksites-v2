// scripts/seed-italy-demo.mts
//
// The Italy Step 1 DEMO (HJ crosstalk 2026-10-14; docs/ITALY_RESTAURANT_DEMO.md): one fictional
// trattoria, Italian content, a `table_booking` block, eight tables and a few sample bookings,
// published as a demo (`claim_source='demo_seed'`, `meta.is_demo`). Demo-grade on purpose: no
// real guest, no billing, no generated people (the hero carries no image).
//
//   npx tsx --env-file=.env.local scripts/seed-italy-demo.mts            # dry run
//   npx tsx --env-file=.env.local scripts/seed-italy-demo.mts --apply    # insert + publish
//   … --apply --bookings                                                  # (re)seed sample bookings only
//
// Idempotent on the slug: a second --apply reuses the existing template and tables.

// @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
import ws from 'ws';
(globalThis as any).WebSocket ??= ws;

import { randomUUID } from 'node:crypto';
import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

const APPLY = process.argv.includes('--apply');
const BOOKINGS_ONLY = process.argv.includes('--bookings');
const OPERATOR_ID = 'fbde34ec-16e7-4dfe-94b5-ca2cc4d448d2';
const SLUG = 'trattoria-del-borgo-demo';
const NAME = 'Trattoria del Borgo';
const TZ = 'Europe/Rome';

const MENU = {
  title: 'Il nostro menù',
  note: 'Prezzi in euro, coperto incluso.',
  currency: 'EUR',
  sourced_at: new Date().toISOString().slice(0, 10),
  sections: [
    {
      name: 'Antipasti',
      description: '',
      items: [
        { name: 'Tagliere di salumi e formaggi', description: 'Salumi del territorio, pecorino, miele di castagno.', price: '€ 14', tags: [] },
        { name: 'Bruschette miste', description: 'Pomodoro e basilico, fegatini, lardo di Colonnata.', price: '€ 9', tags: ['V'] },
        { name: 'Carciofi alla romana', description: 'Mentuccia, aglio, olio nuovo.', price: '€ 10', tags: ['V'] },
      ],
    },
    {
      name: 'Primi',
      description: 'Pasta fatta in casa ogni mattina.',
      items: [
        { name: 'Pici cacio e pepe', description: 'Pecorino romano, pepe nero.', price: '€ 13', tags: ['V'] },
        { name: 'Pappardelle al cinghiale', description: 'Ragù di cinghiale cotto sei ore.', price: '€ 15', tags: ['Popolare'] },
        { name: 'Ravioli ricotta e spinaci', description: 'Burro e salvia.', price: '€ 14', tags: ['V'] },
        { name: 'Ribollita', description: 'Cavolo nero, fagioli, pane raffermo.', price: '€ 11', tags: ['V'] },
      ],
    },
    {
      name: 'Secondi',
      description: '',
      items: [
        { name: 'Bistecca alla fiorentina', description: 'Chianina, al chilo. Per due.', price: '€ 55', tags: [] },
        { name: 'Peposo dell’Impruneta', description: 'Manzo al Chianti e pepe nero.', price: '€ 18', tags: [] },
        { name: 'Baccalà alla livornese', description: 'Pomodoro, olive, capperi.', price: '€ 19', tags: [] },
        { name: 'Verdure grigliate', description: 'Di stagione, olio del Chianti.', price: '€ 12', tags: ['V'] },
      ],
    },
    {
      name: 'Dolci',
      description: '',
      items: [
        { name: 'Cantucci e Vin Santo', description: '', price: '€ 7', tags: [] },
        { name: 'Panna cotta ai frutti di bosco', description: '', price: '€ 7', tags: [] },
        { name: 'Tiramisù della casa', description: '', price: '€ 8', tags: ['Popolare'] },
      ],
    },
  ],
};

const HOURS = {
  title: 'Orari',
  tz: TZ,
  alwaysOpen: false,
  note: 'Chiuso il lunedì.',
  display_style: 'table',
  days: [
    { key: 'mon', label: 'Lun', closed: true, periods: [] },
    { key: 'tue', label: 'Mar', closed: false, periods: [{ open: '12:00', close: '14:30' }, { open: '19:00', close: '22:30' }] },
    { key: 'wed', label: 'Mer', closed: false, periods: [{ open: '12:00', close: '14:30' }, { open: '19:00', close: '22:30' }] },
    { key: 'thu', label: 'Gio', closed: false, periods: [{ open: '12:00', close: '14:30' }, { open: '19:00', close: '22:30' }] },
    { key: 'fri', label: 'Ven', closed: false, periods: [{ open: '12:00', close: '14:30' }, { open: '19:00', close: '23:00' }] },
    { key: 'sat', label: 'Sab', closed: false, periods: [{ open: '12:00', close: '15:00' }, { open: '19:00', close: '23:00' }] },
    { key: 'sun', label: 'Dom', closed: false, periods: [{ open: '12:00', close: '15:00' }] },
  ],
  exceptions: [],
};

const WINDOWS = Object.fromEntries(HOURS.days.map((d) => [d.key, d.closed ? [] : d.periods]));

const TABLES = [
  { label: '1', seats: 2 },
  { label: '2', seats: 2 },
  { label: '3', seats: 4 },
  { label: '4', seats: 4 },
  { label: '5', seats: 4 },
  { label: '6', seats: 6 },
  { label: '7', seats: 6 },
  { label: '8', seats: 8 },
];

// Sample guests: invented names on an invented restaurant, never a real person's.
const SAMPLE = [
  { day: 0, time: '19:30', party: 2, table: '1', name: 'Giulia Ferri', phone: '+39 333 000 0001', source: 'web' },
  { day: 0, time: '20:00', party: 4, table: '3', name: 'Marco Bellini', phone: '+39 333 000 0002', source: 'phone' },
  { day: 0, time: '20:30', party: 6, table: '6', name: 'Famiglia Conti', phone: '+39 333 000 0003', source: 'web', notes: 'Compleanno' },
  { day: 1, time: '13:00', party: 2, table: '2', name: 'Sara Moretti', phone: '+39 333 000 0004', source: 'web' },
  { day: 1, time: '20:00', party: 8, table: '8', name: 'Ufficio Rossi', phone: '+39 333 000 0005', source: 'phone', notes: 'Cena aziendale' },
  { day: 2, time: '19:00', party: 4, table: '4', name: 'Luca Greco', phone: '+39 333 000 0006', source: 'web' },
];

async function main() {
  const { createClient } = await import('@supabase/supabase-js');
  const { buildIndustryStarter } = await import('../lib/builder/industryScaffold');
  const { createDefaultBlock } = await import('../lib/createDefaultBlock');
  const { zonedInstant } = await import('../lib/booking/slots');
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!, { auth: { persistSession: false } });

  const { data: existing } = await db.from('templates').select('id, slug, published').eq('slug', SLUG).maybeSingle();
  let templateId: string | null = (existing as any)?.id ?? null;

  if (!templateId && !BOOKINGS_ONLY) {
    const tpl: any = buildIndustryStarter({ businessName: NAME, industryKey: 'restaurant' });
    const page = tpl.data.pages[0];
    const blocks: any[] = page.blocks;
    const byType = (t: string) => blocks.find((b) => b?.type === t);

    const hero = byType('hero');
    hero.content = { ...hero.content, headline: NAME, subheadline: 'Cucina toscana di casa, nel cuore del borgo. Pasta fresca ogni giorno.', cta_text: 'Prenota un tavolo', cta_link: '#table_booking' };
    byType('menu').content = { ...byType('menu').content, ...MENU };
    byType('hours').content = { ...byType('hours').content, ...HOURS };
    byType('location').content = { ...byType('location').content, title: 'Dove siamo', business_name: NAME, address: 'Via del Borgo 12, 53037 San Gimignano (SI)', phone: '+39 0577 000000', email: '', map_query: 'San Gimignano, Siena', show_map: false };
    const contact = byType('contact_form');
    contact.content = { ...contact.content, title: 'Domande? Gruppi numerosi? Scrivici' };
    // Drop the order bar: this demo books tables, it does not sell dishes.
    const orderIdx = blocks.findIndex((b) => b?.type === 'order_bar');
    if (orderIdx >= 0) blocks.splice(orderIdx, 1);
    // Drop the silent In Your Voice slot — the demo site speaks Italian and nobody has recorded a clone.
    const voiceIdx = blocks.findIndex((b) => b?.type === 'about_that');
    if (voiceIdx >= 0) blocks.splice(voiceIdx, 1);
    // The booking block goes right after the hero: it is the point of the demo.
    const booking = createDefaultBlock('table_booking');
    booking.content = { title: 'Prenota un tavolo', intro: 'Scegli il giorno, quanti siete e l’orario. Il tavolo resta vostro per novanta minuti.' };
    blocks.splice(1, 0, booking);
    if (Array.isArray(page.content_blocks)) page.content_blocks = blocks;

    const nav = [
      { label: 'Prenota', href: '#table_booking', appearance: 'default' },
      { label: 'Menù', href: '#menu', appearance: 'default' },
      { label: 'Dove siamo', href: '#location', appearance: 'default' },
      { label: 'Contatti', href: '#contact', appearance: 'default' },
    ];
    const headerBlk = tpl.data.headerBlock;
    if (headerBlk?.content && Array.isArray(headerBlk.content.nav_items)) headerBlk.content.nav_items = nav.map((l) => ({ ...l }));
    const footerBlk = tpl.data.footerBlock;
    if (footerBlk?.content && Array.isArray(footerBlk.content.links)) footerBlk.content.links = nav.map((l) => ({ ...l }));

    tpl.data.meta = {
      ...(tpl.data.meta ?? {}),
      business_name: NAME,
      city: 'San Gimignano',
      state: 'SI',
      is_demo: true,
      demo_kind: 'italy_table_booking',
      contact: { ...(tpl.data.meta?.contact ?? {}), phone: '+39 0577 000000', address: 'Via del Borgo 12, 53037 San Gimignano (SI)' },
      booking: { tz: TZ, windows: WINDOWS, seating_minutes: 90, slot_minutes: 30, lead_minutes: 60, max_party: 8, closed_dates: [], locale: 'it', phone: '+39 0577 000000' },
    };
    tpl.data.services = [];
    tpl.services = [];

    const row: any = {
      id: randomUUID(),
      template_name: `${NAME} (demo)`,
      slug: SLUG,
      data: tpl.data,
      color_mode: 'light',
      header_block: tpl.data.headerBlock ?? null,
      footer_block: tpl.data.footerBlock ?? null,
      is_site: false,
      industry: 'restaurant',
      business_name: NAME,
      claim_source: 'demo_seed',
      owner_id: OPERATOR_ID,
      phone: '+39 0577 000000',
    };
    console.log(`[seed] template ${SLUG}: ${blocks.map((b) => b.type).join(' → ')}`);
    if (!APPLY) {
      console.log('[seed] dry run — pass --apply to insert, publish, and seed tables + bookings');
      return;
    }
    const { data: ins, error } = await db.from('templates').insert(row).select('id').single();
    if (error) throw new Error(`insert: ${error.message}`);
    templateId = (ins as any).id;
    const { error: pErr } = await (db as any).rpc('publish_template_demo', { p_template_id: templateId });
    if (pErr) throw new Error(`publish: ${pErr.message}`);
    console.log(`[seed] inserted + published ${templateId}`);
  } else if (templateId) {
    console.log(`[seed] template exists: ${templateId} (published=${(existing as any).published})`);
  } else {
    console.log('[seed] no template yet; run without --bookings first');
    return;
  }
  if (!APPLY) return;

  const { data: tbl } = await db.from('restaurant_tables').select('id, label, seats').eq('template_id', templateId).order('sort');
  let tables = (tbl ?? []) as Array<{ id: string; label: string; seats: number }>;
  if (!tables.length) {
    const { data: made, error } = await db
      .from('restaurant_tables')
      .insert(TABLES.map((t, i) => ({ template_id: templateId, label: t.label, seats: t.seats, sort: i })))
      .select('id, label, seats');
    if (error) throw new Error(`tables: ${error.message}`);
    tables = made as any;
    console.log(`[seed] ${tables.length} tables`);
  }

  // Sample bookings: clear any earlier sample rows (source stamped in notes? no — by guest_phone prefix) and reseed.
  await db.from('table_bookings').delete().eq('template_id', templateId).like('guest_phone', '+39 333 000 %');
  const today = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
  const rows = SAMPLE.map((s) => {
    const date = formatInTimeZone(addDays(new Date(`${today}T12:00:00Z`), s.day), 'UTC', 'yyyy-MM-dd');
    const starts = zonedInstant(date, s.time, TZ);
    const table = tables.find((t) => t.label === s.table)!;
    return {
      template_id: templateId,
      table_id: table.id,
      party_size: s.party,
      starts_at: starts.toISOString(),
      ends_at: new Date(starts.getTime() + 90 * 60_000).toISOString(),
      guest_name: s.name,
      guest_phone: s.phone,
      guest_email: null,
      status: 'booked',
      source: s.source,
      notes: (s as any).notes ?? null,
      locale: 'it',
    };
  });
  const { error: bErr } = await db.from('table_bookings').insert(rows);
  if (bErr) throw new Error(`bookings: ${bErr.message}`);
  console.log(`[seed] ${rows.length} sample bookings from ${today}`);
  console.log(`[seed] site: https://www.quicksites.ai/sites/${SLUG}   owner page: https://www.quicksites.ai/merchant/bookings/${templateId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
