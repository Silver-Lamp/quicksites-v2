// lib/outreach/mail/lob.ts
//
// Physical postcard mail via Lob (https://lob.com) — the cold-outreach channel for
// geo-competition campaigns. We mail the competition poster + QR to each competing
// business (addresses come from the Places sweep). Called via raw fetch (no SDK dep).
//
// GATED behind POSTCARD_MAIL_ENABLED (+ LOB_API_KEY) because it SPENDS MONEY per piece —
// a campaign never mails by accident.

const LOB_API = 'https://api.lob.com/v1/postcards';

export function lobConfigured(): boolean {
  return !!process.env.LOB_API_KEY;
}
export function postcardMailEnabled(): boolean {
  return (process.env.POSTCARD_MAIL_ENABLED === '1' || process.env.POSTCARD_MAIL_ENABLED === 'true') && lobConfigured();
}

export type LobAddress = {
  name: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
};

/** Best-effort parse of a Places formatted address into Lob components. */
export function parseUsAddress(
  formatted: string | null | undefined,
  cityHint?: string | null,
  regionHint?: string | null,
): { line1: string; city: string; state: string; zip: string } | null {
  if (!formatted) return null;
  // "123 Main St, Boston, MA 02101, USA"
  const parts = formatted.split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const line1 = parts[0];
  // Find a "ST 12345" segment for state+zip.
  let state = (regionHint || '').trim();
  let zip = '';
  for (const seg of parts.slice(1)) {
    const m = seg.match(/\b([A-Z]{2})\s+(\d{5})(?:-\d{4})?\b/);
    if (m) {
      state = m[1];
      zip = m[2];
      break;
    }
    const zc = seg.match(/\b(\d{5})(?:-\d{4})?\b/);
    if (zc && !zip) zip = zc[1];
  }
  const city = (cityHint || parts[1] || '').trim();
  if (!line1 || !city || !state || !zip) return null;
  return { line1, city, state, zip };
}

function fromAddress(): LobAddress | null {
  const name = process.env.LOB_FROM_NAME;
  const line1 = process.env.LOB_FROM_LINE1;
  const city = process.env.LOB_FROM_CITY;
  const state = process.env.LOB_FROM_STATE;
  const zip = process.env.LOB_FROM_ZIP;
  if (!name || !line1 || !city || !state || !zip) return null;
  return { name, line1, city, state, zip, country: 'US' };
}

/**
 * Send one postcard. Returns { id } on success. Throws on misconfig or Lob API error.
 * `size` defaults to 6x9 (matches the poster proportions).
 */
export async function sendPostcard(opts: {
  to: LobAddress;
  frontHtml: string;
  backHtml: string;
  description?: string;
  size?: '4x6' | '6x9' | '6x11';
}): Promise<{ id: string }> {
  const key = process.env.LOB_API_KEY;
  if (!key) throw new Error('LOB_API_KEY is not set.');
  const from = fromAddress();
  if (!from) throw new Error('LOB_FROM_* return address env is not set.');

  const form = new URLSearchParams();
  form.set('description', opts.description ?? 'QuickSites geo-competition postcard');
  form.set('size', opts.size ?? '6x9');
  form.set('front', opts.frontHtml);
  form.set('back', opts.backHtml);
  form.set('to[name]', opts.to.name);
  form.set('to[address_line1]', opts.to.line1);
  form.set('to[address_city]', opts.to.city);
  form.set('to[address_state]', opts.to.state);
  form.set('to[address_zip]', opts.to.zip);
  form.set('to[address_country]', opts.to.country ?? 'US');
  form.set('from[name]', from.name);
  form.set('from[address_line1]', from.line1);
  form.set('from[address_city]', from.city);
  form.set('from[address_state]', from.state);
  form.set('from[address_zip]', from.zip);
  form.set('from[address_country]', 'US');

  const auth = Buffer.from(`${key}:`).toString('base64');
  const res = await fetch(LOB_API, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `Lob error (${res.status}).`);
  return { id: String(json?.id ?? '') };
}
