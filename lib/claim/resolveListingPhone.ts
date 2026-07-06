// lib/claim/resolveListingPhone.ts
//
// Server-derive the phone number to verify a claim against, from the imported listing.
// The importer stashes the business phone on the contact / location / order_bar block's
// content.phone (see lib/rebuild/assembleDraft.ts), with column fallbacks. This is the
// LISTING channel — it must come from our data, never from a claimer-supplied number,
// or the whole proof-of-control gate is moot.
import { toE164 } from '@/lib/auth/claimVerify';

function safeParse(x: any): any {
  if (typeof x !== 'string') return x ?? {};
  try { return JSON.parse(x); } catch { return {}; }
}

export function resolveListingPhone(row: {
  phone?: any;
  contact_phone?: any;
  data?: any;
} | null | undefined): string | null {
  if (!row) return null;
  const candidates: any[] = [row.phone, row.contact_phone];

  const data = safeParse(row.data);
  const blocks: any[] = Array.isArray(data?.pages?.[0]?.blocks) ? data.pages[0].blocks : [];
  for (const b of blocks) {
    const p = b?.content?.phone;
    if (typeof p === 'string' && p.trim()) candidates.push(p);
  }

  for (const c of candidates) {
    const e = toE164(typeof c === 'string' ? c : '');
    if (e) return e;
  }
  return null;
}
