// lib/admin/guestLeads.ts
//
// The guest-lead list, server-side — shared by the ops panel's API and `npm run guests:contacts`,
// so the operator sees the same rows in the browser and the terminal.
//
// Three tiers of cost, each opt-in: what the template recorded (free, one query); what the source
// website shows (a fetch per site that has one); a Places lookup by name (paid, ~$0.03 a name —
// and only ever a CONFIRM candidate: a guest site records no city).
import { supabaseAdmin } from '@/lib/supabase/admin';
import { contactOnRecord, classifyLead, extractContactsFromText, lookupQueryFor, lookupWorthTrying, assessLookup, type GuestLead } from './guestContacts';
import { nameSimilarity } from '@/lib/outreach/addressBackfill';

export type LoadGuestLeadsOptions = { fetchSources?: boolean; lookup?: boolean; templateIds?: string[] };

export async function scrapeSourceFor(url: string, businessName: string): Promise<GuestLead['scraped']> {
  try {
    const { scrapeSite } = await import('@/lib/rebuild/scrapeSite');
    const home = await scrapeSite(url);
    let text = `${home.bodyText}\n${home.links.map((l) => l.href).join('\n')}`;
    const contactLink = home.links.find((l) => /contact/i.test(l.label) || /\/contact/i.test(l.href));
    if (contactLink) {
      try {
        const c = await scrapeSite(contactLink.href);
        text += `\n${c.bodyText}\n${c.links.map((l) => l.href).join('\n')}`;
      } catch { /* the homepage alone is fine */ }
    }
    const mailtos = text.match(/mailto:([^"'\s?]+)/gi)?.map((m) => m.slice(7)) ?? [];
    const tels = text.match(/tel:([^"'\s?]+)/gi)?.map((m) => m.slice(4)) ?? [];
    return { ...extractContactsFromText(`${text}\n${mailtos.join('\n')}\n${tels.join('\n')}`, businessName), fetched: true };
  } catch (e: any) {
    return { emails: [], phones: [], fetched: false, error: e?.message || 'fetch_failed' };
  }
}

export async function lookupFor(businessName: string, address: string | null): Promise<GuestLead['lookup']> {
  const hint = { address };
  const query = lookupQueryFor(businessName, hint);
  if (!lookupWorthTrying(businessName, hint)) return { query, candidate: null, verdict: assessLookup(businessName, null, nameSimilarity, hint) };
  try {
    const { searchPlaceByText } = await import('@/lib/places/searchText');
    const m = await searchPlaceByText(query);
    const candidate = m ? { placeId: m.placeId, name: m.name, address: m.address, phone: m.phone, website: m.website } : null;
    return { query, candidate, verdict: assessLookup(businessName, candidate, nameSimilarity, hint) };
  } catch {
    return { query, candidate: null, verdict: { show: false, reason: 'no_match', score: 0 } };
  }
}

export async function loadGuestLeads(opts: LoadGuestLeadsOptions = {}): Promise<GuestLead[]> {
  let q = (supabaseAdmin as any)
    .from('templates')
    .select('id, slug, business_name, template_name, created_at, updated_at, owner_id, data')
    .eq('claim_source', 'guest_build')
    .order('created_at', { ascending: false });
  if (opts.templateIds?.length) q = q.in('id', opts.templateIds);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const leads: GuestLead[] = [];
  const lookupCache = new Map<string, GuestLead['lookup']>();
  for (const t of (data ?? []) as any[]) {
    const businessName = String(t.business_name || t.template_name || t.slug || 'Untitled');
    const onRecord = contactOnRecord(t.data, businessName);
    const scraped = onRecord.sourceUrl && opts.fetchSources ? await scrapeSourceFor(onRecord.sourceUrl, businessName) : null;
    let lookup: GuestLead['lookup'] = null;
    if (opts.lookup) {
      const key = `${businessName.toLowerCase()}|${onRecord.address ?? ''}`;
      if (!lookupCache.has(key)) lookupCache.set(key, await lookupFor(businessName, onRecord.address));
      lookup = lookupCache.get(key) ?? null;
    }
    leads.push(classifyLead({ templateId: t.id, slug: t.slug, businessName, createdAt: t.created_at, updatedAt: t.updated_at, onRecord, scraped, lookup }));
  }
  return leads;
}
