// lib/phone/region.ts
//
// Which phone FORMAT a site's visitor is asked for — one pure decision, read by the contact form.
//
// ⚠️ THE FORM ASKED AN ITALIAN RESTAURANT'S GUESTS FOR "(555) 123-4567" (owner, 2026-10-15, on
// the Trattoria del Borgo demo). Worse than the placeholder: the input FORMATTED every keystroke
// into the US shape, `maxLength={14}` cut a `+39 0577 000000` short, and validation refused
// anything that was not `(ddd) ddd-dddd` with the message "must be in US format". A visitor in
// San Gimignano could not leave a phone number at all — on a page whose own footer shows one with
// a +39 on it.
//
// The region comes from the site's OWN signals, in this order — an explicit country, the booking
// / site locale, the business's own phone number's country code — and defaults to US only when
// nothing says otherwise, because the fleet is US and that default was already live everywhere.
//
// ⚠️ International input is validated LOOSELY on purpose: digits with an optional leading `+`,
// 7–15 of them (E.164's ceiling), punctuation ignored. A per-country national-format table would
// refuse real numbers we never thought of, and a contact form that cannot be submitted is worse
// than one that accepts an odd-looking phone (the same rule as the never-required service picker).

export type PhoneRegion =
  | { kind: 'us' }
  | { kind: 'intl'; callingCode: string | null; country: string | null };

/** Calling code → ISO country, for the countries a site here plausibly belongs to. */
const CALLING_CODES: Record<string, string> = {
  '1': 'US',
  '39': 'IT',
  '44': 'GB',
  '49': 'DE',
  '33': 'FR',
  '34': 'ES',
  '31': 'NL',
  '32': 'BE',
  '41': 'CH',
  '43': 'AT',
  '351': 'PT',
  '353': 'IE',
  '45': 'DK',
  '46': 'SE',
  '47': 'NO',
  '358': 'FI',
  '48': 'PL',
  '30': 'GR',
  '61': 'AU',
  '64': 'NZ',
  '81': 'JP',
  '52': 'MX',
  '55': 'BR',
  '91': 'IN',
};

const COUNTRY_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(CALLING_CODES).map(([code, iso]) => [iso, code]),
);

/** A country a locale implies. `en` implies nothing — it is spoken in several countries. */
const LOCALE_COUNTRY: Record<string, string> = {
  it: 'IT',
  de: 'DE',
  fr: 'FR',
  es: 'ES',
  nl: 'NL',
  pt: 'PT',
  da: 'DK',
  sv: 'SE',
  nb: 'NO',
  no: 'NO',
  fi: 'FI',
  pl: 'PL',
  el: 'GR',
  ja: 'JP',
};

/** An example a visitor in that country would recognise. Generic when we hold no example. */
const EXAMPLES: Record<string, string> = {
  IT: '+39 333 123 4567',
  GB: '+44 7700 900123',
  DE: '+49 151 2345678',
  FR: '+33 6 12 34 56 78',
  ES: '+34 612 34 56 78',
  NL: '+31 6 12345678',
  IE: '+353 85 123 4567',
  AU: '+61 412 345 678',
  MX: '+52 55 1234 5678',
};

const deepGet = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, k) => (acc != null && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), obj);

const str = (v: unknown) => String(v ?? '').trim();

/** The calling code at the front of a `+`-prefixed number, longest match first; null otherwise. */
export function callingCodeOf(phone: string): string | null {
  const s = str(phone).replace(/[\s().-]/g, '');
  const m = /^(?:\+|00)(\d{1,3})/.exec(s);
  if (!m) return null;
  const run = m[1];
  for (const len of [3, 2, 1]) {
    const cand = run.slice(0, len);
    if (cand.length === len && CALLING_CODES[cand]) return cand;
  }
  return run.slice(0, 1) || null;
}

/**
 * The phone region for a site, from its own data. `siteData` is `templates.data` (or the whole
 * template row — both carry `meta`). Signals, strongest first:
 *   1. `meta.country` / `meta.contact.country` (ISO-2)
 *   2. `meta.booking.locale` / `meta.locale` → a country when the language implies one
 *   3. the business's own phone, when it starts with `+` or `00` and is not NANP
 * Nothing → US.
 */
export function phoneRegionForSite(siteData: unknown): PhoneRegion {
  const d = siteData as Record<string, unknown> | null | undefined;
  const meta = (deepGet(d, 'data.meta') ?? deepGet(d, 'meta') ?? {}) as Record<string, unknown>;

  const explicit = str(meta.country ?? deepGet(meta, 'contact.country')).toUpperCase();
  if (/^[A-Z]{2}$/.test(explicit)) {
    if (explicit === 'US') return { kind: 'us' };
    return { kind: 'intl', callingCode: COUNTRY_TO_CODE[explicit] ?? null, country: explicit };
  }

  const locale = str(deepGet(meta, 'booking.locale') ?? meta.locale).toLowerCase().slice(0, 2);
  const localeCountry = LOCALE_COUNTRY[locale];
  if (localeCountry) return { kind: 'intl', callingCode: COUNTRY_TO_CODE[localeCountry] ?? null, country: localeCountry };

  const ownPhone = [
    d?.phone,
    d?.contact_phone,
    deepGet(meta, 'contact_phone'),
    deepGet(meta, 'contact.phone'),
    deepGet(meta, 'booking.phone'),
  ]
    .map(str)
    .find(Boolean);
  if (ownPhone) {
    const cc = callingCodeOf(ownPhone);
    if (cc && cc !== '1') return { kind: 'intl', callingCode: cc, country: CALLING_CODES[cc] ?? null };
  }

  return { kind: 'us' };
}

/** What the empty phone input shows. */
export function phonePlaceholder(region: PhoneRegion): string {
  if (region.kind === 'us') return '(555) 123-4567';
  if (region.country && EXAMPLES[region.country]) return EXAMPLES[region.country];
  if (region.callingCode) return `+${region.callingCode} 123 456 789`;
  return '+39 333 123 4567';
}

/** The input's `maxLength` — a US number is formatted to 14 characters; the world gets room. */
export function phoneMaxLength(region: PhoneRegion): number {
  return region.kind === 'us' ? 14 : 24;
}

/**
 * The value to keep as the visitor types. The US path formats into `(ddd) ddd-dddd`; the
 * international path keeps what they typed, minus characters no phone number contains.
 */
export function formatPhoneInput(value: string, region: PhoneRegion, usFormatter: (raw: string) => string): string {
  if (region.kind === 'us') return usFormatter(value);
  return String(value ?? '').replace(/[^\d+\s().-]/g, '').slice(0, phoneMaxLength(region));
}

/** `null` when the number is acceptable, else the message to show under the field. */
export function phoneValidationError(value: string, region: PhoneRegion): string | null {
  const v = str(value);
  if (!v) return null;
  if (region.kind === 'us') {
    return /^\(\d{3}\) \d{3}-\d{4}$/.test(v) ? null : 'Enter a 10-digit phone number, e.g. (555) 123-4567.';
  }
  const compact = v.replace(/[\s().-]/g, '');
  if (!/^(\+|00)?\d{7,15}$/.test(compact)) {
    return `Enter a phone number with its country code, e.g. ${phonePlaceholder(region)}.`;
  }
  return null;
}
