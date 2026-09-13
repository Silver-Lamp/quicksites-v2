// scripts/guest-contacts.ts
//
// Who built a site as a guest, and how could we reach them to say sorry and offer it back?
//
//   npm run guests:contacts              # every guest site: what it recorded + what its source site shows
//   npm run guests:contacts -- --csv     # same, as CSV (paste into a sheet)
//   npm run guests:contacts -- --no-fetch  # skip the live fetch of source websites
//
// ⚠️ IT FINDS PEOPLE. IT DOES NOT WRITE MESSAGES, and it must never learn to — the same rule as
// outreach:candidates. The apology is a person's to write.
// ⚠️ A guest session has no email. What exists: the business name, sometimes the website the
// site was rebuilt from (`meta.rebuilt_from`), sometimes a phone/email in `meta.contact` — and
// most of those emails are OUR placeholder (`hello@<slug>.com`), flagged here, never listed as
// theirs. For a source website, the script fetches its homepage and /contact and lists what it
// finds; that is a lead scraped from their public page, not consent. Read before you write.
if (typeof (globalThis as any).WebSocket === 'undefined') {
  try {
    // @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
    const ws = (await import('ws')).default;
    (globalThis as any).WebSocket = ws;
  } catch {
    /* ignore */
  }
}

import { createClient } from '@supabase/supabase-js';
import { contactOnRecord, classifyLead, extractContactsFromText, type GuestLead } from '../lib/admin/guestContacts';
import { scrapeSite } from '../lib/rebuild/scrapeSite';

const CSV = process.argv.includes('--csv');
const NO_FETCH = process.argv.includes('--no-fetch');

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).');
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function scrapeFor(url: string, businessName: string): Promise<GuestLead['scraped']> {
  try {
    const home = await scrapeSite(url);
    let text = `${home.bodyText}\n${home.links.map((l) => l.href).join('\n')}`;
    const contactLink = home.links.find((l) => /contact/i.test(l.label) || /\/contact/i.test(l.href));
    if (contactLink) {
      try {
        const c = await scrapeSite(contactLink.href);
        text += `\n${c.bodyText}\n${c.links.map((l) => l.href).join('\n')}`;
      } catch { /* the homepage alone is fine */ }
    }
    // mailto: links carry the address in the href; tel: links the number.
    const mailtos = text.match(/mailto:([^"'\s?]+)/gi)?.map((m) => m.slice(7)) ?? [];
    const tels = text.match(/tel:([^"'\s?]+)/gi)?.map((m) => m.slice(4)) ?? [];
    const found = extractContactsFromText(`${text}\n${mailtos.join('\n')}\n${tels.join('\n')}`, businessName);
    return { ...found, fetched: true };
  } catch (e: any) {
    return { emails: [], phones: [], fetched: false, error: e?.message || 'fetch_failed' };
  }
}

async function main() {
  const s = db();
  const { data, error } = await s
    .from('templates')
    .select('id, slug, business_name, template_name, created_at, updated_at, owner_id, data')
    .eq('claim_source', 'guest_build')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const leads: GuestLead[] = [];
  for (const t of (data ?? []) as any[]) {
    const businessName = String(t.business_name || t.template_name || t.slug || 'Untitled');
    const onRecord = contactOnRecord(t.data, businessName);
    const scraped = onRecord.sourceUrl && !NO_FETCH ? await scrapeFor(onRecord.sourceUrl, businessName) : null;
    leads.push(classifyLead({ templateId: t.id, slug: t.slug, businessName, createdAt: t.created_at, updatedAt: t.updated_at, onRecord, scraped }));
  }

  if (CSV) {
    console.log(['business', 'built', 'minutes_edited', 'best_channel', 'email', 'phone', 'source_url', 'scraped_emails', 'scraped_phones', 'site', 'template_id'].join(','));
    for (const l of leads) {
      const email = !l.onRecord.emailIsPlaceholder ? l.onRecord.email : '';
      const row = [l.businessName, l.createdAt.slice(0, 10), l.minutesEdited, l.bestChannel ?? '', email ?? '', l.onRecord.phone ?? '', l.onRecord.sourceUrl ?? '', (l.scraped?.emails ?? []).join(' '), (l.scraped?.phones ?? []).join(' '), l.slug ? `https://${l.slug}.quicksites.ai` : '', l.templateId];
      console.log(row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    }
    return;
  }

  const pad = (v: unknown, n: number) => String(v ?? '').slice(0, n).padEnd(n);
  console.log(`${leads.length} guest-built sites · ${leads.filter((l) => l.reachable).length} reachable · ${leads.filter((l) => l.onRecord.emailIsPlaceholder && l.onRecord.email).length} carry OUR placeholder email (not theirs)\n`);
  console.log(`${pad('business', 26)} ${pad('built', 10)} ${pad('min', 5)} ${pad('channel', 8)} ${pad('email / phone on record', 34)} source website → what it shows`);
  for (const l of leads) {
    const email = l.onRecord.emailIsPlaceholder ? (l.onRecord.email ? '(placeholder)' : '') : (l.onRecord.email ?? '');
    const rec = [email, l.onRecord.phone].filter(Boolean).join(' · ') || '—';
    const src = l.onRecord.sourceUrl
      ? `${l.onRecord.sourceUrl} → ${l.scraped ? (l.scraped.fetched ? [...l.scraped.emails, ...l.scraped.phones].join(' · ') || 'nothing found' : `unreachable (${l.scraped.error})`) : 'not fetched'}`
      : '—';
    console.log(`${pad(l.businessName, 26)} ${pad(l.createdAt.slice(0, 10), 10)} ${pad(l.minutesEdited, 5)} ${pad(l.bestChannel ?? '—', 8)} ${pad(rec, 34)} ${src}`);
  }
  const unreachable = leads.filter((l) => !l.reachable);
  if (unreachable.length) console.log(`\n${unreachable.length} have only a business name — nothing to contact without a search by name, which this script deliberately does not do.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
