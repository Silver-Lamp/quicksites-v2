// lib/garageSales/sales.ts
//
// Reads for the sticker landing and the public directory. Every public read projects the address
// through lib/garageSales/address.ts — see the note there for why that is not optional.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { publicAddress, PUBLIC_SALE_COLUMNS_WITH_ADDRESS, type PublicAddress } from './address';
import { buildPayLinks, type PaymentHandles } from './payLinks';

export type PublicSale = {
  id: string;
  title: string;
  description: string | null;
  address: PublicAddress;
  lat: number | null;
  lng: number | null;
  startsAt: string;
  endsAt: string;
  stickerCode: string | null;
  handles: PaymentHandles;
  hasPayment: boolean;
};

export type PublicItem = {
  id: string;
  name: string;
  priceCents: number | null;
  imageUrl: string | null;
  sold: boolean;
};

/** Shape a DB row for public consumption. The ONLY place a sale row becomes public data. */
function toPublicSale(row: any, now: Date): PublicSale {
  const handles = (row.payment_handles ?? {}) as PaymentHandles;
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    address: publicAddress(row, now),
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    stickerCode: row.sticker_code ?? null,
    handles,
    hasPayment: buildPayLinks(handles, null).length > 0,
  };
}

export type StickerState =
  | { state: 'unknown' }
  | { state: 'unclaimed'; code: string }
  | { state: 'ended'; code: string; sale: PublicSale }
  | { state: 'live'; code: string; sale: PublicSale; items: PublicItem[] };

/**
 * What should a scan of this code show?
 *
 * Deliberately collapses "no such code" and "code exists but nothing claimed it" into different
 * states, because they need different pages: an unknown code is probably a typo (offer the
 * directory and a retype box), while an unclaimed one is a real sticker somebody is holding
 * (offer to set the sale up).
 */
export async function readSticker(code: string, now: Date = new Date()): Promise<StickerState> {
  const { data: sticker } = await supabaseAdmin
    .from('garage_sale_stickers')
    .select('code, claimed_at')
    .eq('code', code)
    .maybeSingle();

  if (!sticker) return { state: 'unknown' };

  const { data: row } = await supabaseAdmin
    .from('garage_sales')
    .select(PUBLIC_SALE_COLUMNS_WITH_ADDRESS)
    .eq('sticker_code', code)
    .maybeSingle();

  if (!row) return { state: 'unclaimed', code };

  const sale = toPublicSale(row, now);
  // Expiry is read from the data, not from a job that has to run. A "short-lived site" whose
  // shortness depends on a cron is a site that outlives its sale every time the cron fails.
  if (new Date(sale.endsAt) <= now) return { state: 'ended', code, sale };

  const { data: items } = await supabaseAdmin
    .from('garage_sale_items')
    .select('id, name, price_cents, image_url, sold_at, position')
    .eq('sale_id', sale.id)
    .order('position', { ascending: true });

  return {
    state: 'live',
    code,
    sale,
    items: (items ?? []).map((i: any) => ({
      id: i.id,
      name: i.name,
      priceCents: i.price_cents ?? null,
      imageUrl: i.image_url ?? null,
      sold: !!i.sold_at,
    })),
  };
}

/**
 * Sales a shopper can go to: listed, not finished, and starting within the next week.
 * `near` sorts by distance when the browser gave us a position; without one it is
 * chronological, which is the honest fallback rather than a silent nationwide list.
 */
export async function listSales(opts: { near?: { lat: number; lng: number } | null; limit?: number } = {}) {
  const now = new Date();
  const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data } = await supabaseAdmin
    .from('garage_sales')
    .select(PUBLIC_SALE_COLUMNS_WITH_ADDRESS)
    .eq('listed', true)
    .gt('ends_at', now.toISOString())
    .lt('starts_at', horizon.toISOString())
    .order('starts_at', { ascending: true })
    .limit(opts.limit ?? 100);

  const sales = (data ?? []).map((r: any) => toPublicSale(r, now));
  const near = opts.near;
  if (!near) return sales.map((s) => ({ sale: s, miles: null as number | null }));

  return sales
    .map((s) => ({ sale: s, miles: s.lat != null && s.lng != null ? haversineMiles(near, { lat: s.lat, lng: s.lng }) : null }))
    .sort((a, b) => (a.miles ?? 1e9) - (b.miles ?? 1e9));
}

/** Great-circle distance in miles. */
export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
