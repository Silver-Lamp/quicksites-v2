// scripts/guest-contacts.ts
//
// Who built a site as a guest, and how could we reach them to say sorry and offer it back?
//
//   npm run guests:contacts              # every guest site: what it recorded + what its source site shows
//   npm run guests:contacts -- --csv     # same, as CSV (paste into a sheet)
//   npm run guests:contacts -- --no-fetch  # skip the live fetch of source websites
//   npm run guests:contacts -- --lookup    # ALSO look each name up on Google Places (paid, ~$0.03/site)
//                                          # → a mailing-address CANDIDATE per site, tagged CONFIRM
//
// ⚠️ A lookup is never an answer. A guest site records no city, so "Smoothie Shop" matches some
// shop somewhere; the candidate is shown with its score and the operator confirms by eye before
// a postcard goes anywhere. Names with nothing distinctive ("pepe", "real estate") are skipped
// rather than guessed. Postage to the wrong business is the invented-menu class with a stamp.
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
import { contactOnRecord, classifyLead, extractContactsFromText, lookupQueryFor, lookupWorthTrying, assessLookup, type GuestLead } from '../lib/admin/guestContacts';
import { nameSimilarity } from '../lib/outreach/addressBackfill';
import { searchPlaceByText } from '../lib/places/searchText';
import { scrapeSite } from '../lib/rebuild/scrapeSite';

const CSV = process.argv.includes('--csv');
const NO_FETCH = process.argv.includes('--no-fetch');
const LOOKUP = process.argv.includes('--lookup');

/** One Places Text Search by name (+ any locality the site recorded). A candidate, never a fact. */
async function lookupFor(businessName: string, address: string | null): Promise<GuestLead['lookup']> {
  const hint = { address };
  const query = lookupQueryFor(businessName, hint);
  if (!lookupWorthTrying(businessName, hint)) return { query, candidate: null, verdict: assessLookup(businessName, null, nameSimilarity, hint) };
  try {
    const m = await searchPlaceByText(query);
    const candidate = m ? { placeId: m.placeId, name: m.name, address: m.address, phone: m.phone, website: m.website } : null;
    return { query, candidate, verdict: assessLookup(businessName, candidate, nameSimilarity, hint) };
  } catch (e: any) {
    return { query, candidate: null, verdict: { show: false, reason: 'no_match', score: 0 } };
  }
}

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
  // One lookup per distinct business name — the same person often built the same site 3 times.
  const lookupCache = new Map<string, GuestLead['lookup']>();
  for (const t of (data ?? []) as any[]) {
    const businessName = String(t.business_name || t.template_name || t.slug || 'Untitled');
    const onRecord = contactOnRecord(t.data, businessName);
    const scraped = onRecord.sourceUrl && !NO_FETCH ? await scrapeFor(onRecord.sourceUrl, businessName) : null;
    let lookup: GuestLead['lookup'] = null;
    if (LOOKUP) {
      const key = `${businessName.toLowerCase()}|${onRecord.address ?? ''}`;
      if (!lookupCache.has(key)) lookupCache.set(key, await lookupFor(businessName, onRecord.address));
      lookup = lookupCache.get(key) ?? null;
    }
    leads.push(classifyLead({ templateId: t.id, slug: t.slug, businessName, createdAt: t.created_at, updatedAt: t.updated_at, onRecord, scraped, lookup }));
  }

  if (CSV) {
    console.log(['business', 'built', 'minutes_edited', 'best_channel', 'email', 'phone', 'source_url', 'scraped_emails', 'scraped_phones', 'lookup_candidate_name', 'lookup_score', 'lookup_address', 'lookup_phone', 'lookup_website', 'lookup_status', 'site', 'template_id'].join(','));
    for (const l of leads) {
      const email = !l.onRecord.emailIsPlaceholder ? l.onRecord.email : '';
      const lk = l.lookup;
      const show = lk?.verdict.show ? lk.candidate : null;
      const lookupStatus = !lk ? '' : lk.verdict.show ? `CONFIRM${lk.verdict.note ? ` (${lk.verdict.note})` : ''}` : lk.verdict.reason;
      const row = [l.businessName, l.createdAt.slice(0, 10), l.minutesEdited, l.bestChannel ?? '', email ?? '', l.onRecord.phone ?? '', l.onRecord.sourceUrl ?? '', (l.scraped?.emails ?? []).join(' '), (l.scraped?.phones ?? []).join(' '), show?.name ?? '', lk ? lk.verdict.score.toFixed(2) : '', show?.address ?? '', show?.phone ?? '', show?.website ?? '', lookupStatus, l.slug ? `https://${l.slug}.quicksites.ai` : '', l.templateId];
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
    if (l.lookup) {
      const v = l.lookup.verdict;
      const c = l.lookup.candidate;
      const line = v.show
        ? `CONFIRM ▸ ${c?.name ?? '?'} (${v.score.toFixed(2)}) · ${c?.address ?? 'no address'}${c?.phone ? ` · ${c.phone}` : ''}${c?.website ? ` · ${c.website}` : ''}${v.note ? ` · ⚠ ${v.note}` : ''}`
        : `lookup: ${v.reason}${c ? ` (${c.name}, ${v.score.toFixed(2)})` : ''}`;
      console.log(`${' '.repeat(27)}${line}`);
    }
  }
  const unreachable = leads.filter((l) => !l.reachable);
  const candidates = leads.filter((l) => l.lookup?.verdict.show).length;
  if (unreachable.length) {
    console.log(`\n${unreachable.length} have only a business name.${LOOKUP ? ` ${candidates} got a Places candidate — CONFIRM each by eye before any card is addressed; a guest site records no city, so a match is a guess until a person says otherwise.` : ' Re-run with --lookup to get a Places candidate for each (paid, ~$0.03 a name).'}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
