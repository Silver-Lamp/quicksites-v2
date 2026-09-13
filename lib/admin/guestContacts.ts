// lib/admin/guestContacts.ts
//
// Who built this guest site, and how could we reach them?
//
// A guest session has no email. What a guest site DOES carry: a business name, sometimes the URL
// it was rebuilt from (`meta.rebuilt_from` — their real website), and sometimes a phone or email
// in `meta.contact`. ⚠️ Most of those emails are ours, not theirs: `autogenerateForTemplate`
// fills an empty contact with `hello@<business-slug>.com`, and the 2026-09-13 scan "found" that
// on 9 of 16 sites. Nothing in the repo generates phone numbers, so a phone is scraped or typed —
// but a scraped one came from the source site, not from the person, so it is a lead, not consent.
//
// Pure. The script (scripts/guest-contacts.ts) adds a live fetch of the source website.

export type ContactOnRecord = {
  email: string | null;
  /** True when the email is the scaffold's `hello@<slug>.com` placeholder, not a person's. */
  emailIsPlaceholder: boolean;
  phone: string | null;
  address: string | null;
  sourceUrl: string | null;
};

const slugOf = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'your-business';

/** The exact address `autogenerateForTemplate` invents for a business with no email. */
export function placeholderEmailFor(businessName: string | null | undefined): string {
  return `hello@${slugOf(businessName || 'your-business')}.com`;
}

const GENERIC_PLACEHOLDER = /@(example\.com|yourbusiness\.com|your-business\.com|placeholder\.\w+|sentry\.io|schema\.org)$/i;

/** Is this email one we made up (scaffold placeholder or a generic example), or one a person supplied? */
export function isPlaceholderEmail(email: string | null | undefined, businessName: string | null | undefined): boolean {
  const e = String(email ?? '').trim().toLowerCase();
  if (!e) return true;
  if (GENERIC_PLACEHOLDER.test(e)) return true;
  if (e === placeholderEmailFor(businessName).toLowerCase()) return true;
  // The scaffold runs on whatever the name was AT GENERATION — a site rebuilt from adzemedia.com
  // gets hello@adzemedia.com, then the person renames it "Adze Media". Compare with hyphens
  // stripped, either side a prefix of the other, so a rename cannot turn our placeholder into
  // "their" address. hello@ for an unrelated business stays theirs.
  if (!/^hello@[a-z0-9-]+\.com$/.test(e) || !businessName) return false;
  const local = e.slice(6, e.lastIndexOf('.com')).replace(/-/g, '');
  const name = slugOf(businessName).replace(/-/g, '');
  if (local.length < 4 || name.length < 4) return false;
  return local === name || local.startsWith(name) || name.startsWith(local);
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// North American shapes that a PERSON writes: (206) 774-9444 · 206-774-9444 · 206.774.9444 ·
// +1 206 774 9444 · +12067749444. Separators are required for the bare form — a run of ten digits
// with none is a timestamp or a photo id, and "122.3150847" is a map coordinate (the first scan
// listed both as phones). Lookarounds keep a match from starting or ending inside a longer number.
const PHONE_RE = /(?<![\d.])(?:\+1\d{10}|(?:\+?1[ .-])?\(\d{3}\)[ .-]?\d{3}[ .-]\d{4}|(?:\+?1[ .-])?\d{3}[ .-]\d{3}[ .-]\d{4})(?![\d.])/g;
const FAKE_PHONE = /555[ .-]?01\d\d|\b000[ .-]?000[ .-]?0000|123[ .-]?4567/;

/** Emails and phones in a blob of text (a scraped page), de-duped, placeholders and image names dropped. */
export function extractContactsFromText(text: string, businessName?: string | null): { emails: string[]; phones: string[] } {
  const emails = new Set<string>();
  for (const m of text.match(EMAIL_RE) ?? []) {
    const e = m.toLowerCase();
    if (/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(e)) continue;
    if (isPlaceholderEmail(e, businessName ?? null)) continue;
    emails.add(e);
  }
  const phones = new Set<string>();
  for (const m of text.match(PHONE_RE) ?? []) {
    const p = m.trim();
    if (FAKE_PHONE.test(p)) continue;
    phones.add(p);
  }
  return { emails: [...emails], phones: [...phones] };
}

/** What the template itself records — no network. */
export function contactOnRecord(data: any, businessName: string | null | undefined): ContactOnRecord {
  const meta = data?.meta ?? {};
  const c = meta.contact ?? {};
  const email = String(c.email ?? meta.contact_email ?? '').trim() || null;
  // A typed phone field can hold "Not provided" or "call us" — only a real number shape counts.
  const rawPhone = String(c.phone ?? meta.phone ?? '').trim();
  const phone = (rawPhone.match(PHONE_RE) ?? []).find((p) => !FAKE_PHONE.test(p)) ?? null;
  const address = String(c.address ?? '').trim() || null;
  const sourceUrl = String(meta.rebuilt_from ?? '').trim() || null;
  return { email, emailIsPlaceholder: isPlaceholderEmail(email, businessName), phone, address, sourceUrl };
}

// ── Business-name lookup (Places Text Search) ─────────────────────────────────────────────────
//
// For the name-only sites. ⚠️ A guest site records NO city, so "Smoothie Shop" or "pepe" will
// match some business somewhere. A lookup here is therefore never an answer, only a CANDIDATE
// the operator confirms by eye before anything is mailed — postage to the wrong "Joe's Bakery"
// is the invented-menu class with a stamp on it. The rule below decides which candidates are
// even worth showing.

export type LookupCandidate = {
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
};

const NAME_STOP = new Set(['the', 'a', 'and', 'of', 'shop', 'store', 'services', 'service', 'llc', 'inc', 'co', 'company']);
// Words that name a TRADE, not a business: "real estate" is two of them and no business at all.
const GENERIC_INDUSTRY = new Set([
  'real', 'estate', 'realty', 'towing', 'plumbing', 'roofing', 'electric', 'electrical', 'hvac', 'concrete', 'paving', 'asphalt',
  'bakery', 'cafe', 'coffee', 'restaurant', 'diner', 'grill', 'pizza', 'smoothie', 'juice', 'bar', 'food',
  'media', 'photography', 'photo', 'studio', 'design', 'marketing', 'consulting', 'software', 'dev', 'tech',
  'lawn', 'landscaping', 'cleaning', 'painting', 'auto', 'repair', 'salon', 'fitness', 'yoga', 'clinic', 'dental', 'law', 'legal',
  'thrift', 'clothing', 'boutique', 'emporium', 'collectible', 'toy', 'mask', 'masks', 'wine', 'tasting', 'parties', 'train', 'trains',
]);

/** Words in the name that could identify a business — filler and generic trade words do not count. */
export function distinctiveTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s'&-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^'|'$/g, ''))
    .filter((t) => t.length > 2 && !NAME_STOP.has(t) && !GENERIC_INDUSTRY.has(t.replace(/'s$/, '')));
}

/**
 * Is there enough in the name to look up at all? "pepe", "real estate", "Smoothie Shop" → no.
 * Needs at least one word that is not a trade word, plus either a second word of any kind, a
 * possessive ("Jay Berry's"), or a locality recorded on the site.
 */
export function lookupWorthTrying(businessName: string, hint?: { address?: string | null }): boolean {
  const distinct = distinctiveTokens(businessName);
  if (!distinct.length) return !!hint?.address && businessName.trim().length >= 4 && !/^(real estate|quicksites)$/i.test(businessName.trim());
  if (hint?.address) return true;
  const words = businessName.trim().split(/\s+/).filter((w) => w.length > 2 && !NAME_STOP.has(w.toLowerCase()));
  return words.length >= 2 || /'s$|'$/.test(businessName.trim());
}

/** The text query — name plus whatever locality the site recorded. */
export function lookupQueryFor(businessName: string, hint?: { address?: string | null }): string {
  return [businessName.trim(), hint?.address?.trim()].filter(Boolean).join(', ');
}

export type LookupVerdict =
  | { show: true; score: number; note: string | null }
  | { show: false; reason: 'no_match' | 'name_differs' | 'not_worth_trying'; score: number };

/**
 * Whether a Places result is worth putting in front of a person. Never "accept": the operator
 * confirms. Shown when the returned name overlaps the site's name strongly; a locality on the
 * site that the result does not share is noted, not fatal (the person typed it loosely).
 */
export function assessLookup(
  businessName: string,
  candidate: LookupCandidate | null,
  similarity: (a: string, b: string) => number,
  hint?: { address?: string | null },
): LookupVerdict {
  if (!lookupWorthTrying(businessName, hint)) return { show: false, reason: 'not_worth_trying', score: 0 };
  if (!candidate) return { show: false, reason: 'no_match', score: 0 };
  const score = similarity(businessName, candidate.name);
  if (score < 0.6) return { show: false, reason: 'name_differs', score };
  const addr = (hint?.address ?? '').trim().toLowerCase();
  const note = addr && candidate.address && !candidate.address.toLowerCase().includes(addr.split(',')[0]) ? `site says "${hint!.address}", result is elsewhere` : null;
  return { show: true, score, note };
}

export type GuestLead = {
  templateId: string;
  slug: string | null;
  businessName: string;
  createdAt: string;
  minutesEdited: number;
  onRecord: ContactOnRecord;
  /** From fetching the source website, when there was one. */
  scraped: { emails: string[]; phones: string[]; fetched: boolean; error?: string } | null;
  /** From a Places lookup by business name — a CANDIDATE for a person to confirm, never a fact. */
  lookup: { query: string; candidate: LookupCandidate | null; verdict: LookupVerdict } | null;
  /** The single best way to reach them, or null: a real email > a phone > the website's contact page. */
  bestChannel: 'email' | 'phone' | 'website' | null;
  reachable: boolean;
};

export function classifyLead(input: {
  templateId: string; slug: string | null; businessName: string; createdAt: string; updatedAt: string;
  onRecord: ContactOnRecord; scraped: GuestLead['scraped']; lookup?: GuestLead['lookup'];
}): GuestLead {
  const realEmail = (!input.onRecord.emailIsPlaceholder && input.onRecord.email) || input.scraped?.emails[0] || null;
  const phone = input.onRecord.phone || input.scraped?.phones[0] || null;
  // ⚠️ A lookup candidate never sets the channel — it is unconfirmed. `reachable` stays honest:
  // it means we hold something the PERSON or THEIR SITE gave us.
  const bestChannel: GuestLead['bestChannel'] = realEmail ? 'email' : phone ? 'phone' : input.onRecord.sourceUrl ? 'website' : null;
  return {
    templateId: input.templateId,
    slug: input.slug,
    businessName: input.businessName,
    createdAt: input.createdAt,
    minutesEdited: Math.max(0, Math.round((new Date(input.updatedAt).getTime() - new Date(input.createdAt).getTime()) / 60_000)),
    onRecord: input.onRecord,
    scraped: input.scraped,
    lookup: input.lookup ?? null,
    bestChannel,
    reachable: bestChannel !== null,
  };
}
