// lib/porchhearth/client.ts
//
// Typed server-side client for the PorchHearth public API (crosstalk/contracts/
// neighborhood-{stay,meals}-embed.md, LIVE). Reads are public; bookings/orders are proxy-authed
// (X-QS-Proxy-Secret) and MUST be called server-to-server only. Bodies are built to EXACTLY the
// whitelisted fields — the engine validates `forbidNonWhitelisted`, so an extra key is a 400.

import { phUrl, porchhearthProxySecret } from '@/lib/porchhearth/config';

export type PhProperty = {
  id: string;
  title: string;
  address?: string;
  images?: string[];
  beds?: number;
  bathrooms?: number;
  maxGuests?: number;
  amenities?: string[];
  basePriceCents?: number;
  minimumStayNights?: number;
  maximumStayNights?: number;
  cancellationPolicy?: string;
  hostAudioUrl?: string;
};

export type PhAvailability = {
  available: boolean;
  nights?: number;
  /** Total price in cents. The contract promises this; the live engine currently emits it inside
   *  `priceBreakdown.totalCents` instead — propertyAvailability() normalizes so callers can rely on it. */
  quoteCents?: number;
  priceBreakdown?: { totalCents?: number } | null;
  reason?: string;
};

export type PhBookingResult = {
  bookingId: string;
  status: string; // 'PENDING' until Stripe captures (webhook)
  amountCents?: number;
  // Hosted checkout (2026-07-19): `checkoutUrl` is a Stripe-hosted Checkout Session — the block
  // redirects the guest there to pay. (`clientSecret` kept optional for backwards-safety.)
  payment: null | { checkoutUrl?: string; clientSecret?: string };
  note?: string;
  siteRef?: string;
};

export class PorchHearthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'PorchHearthError';
  }
}

const TIMEOUT_MS = 12_000;

async function phFetch(url: string, init: RequestInit = {}): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON error body */
    }
    if (!res.ok) {
      const msg = json?.error || json?.message || `PorchHearth ${res.status}`;
      throw new PorchHearthError(res.status, msg);
    }
    return json;
  } finally {
    clearTimeout(t);
  }
}

/** Public read: geo-scoped rental properties. `geo` is "lat,lng". */
export async function listProperties(params: {
  geo: string;
  radiusMi?: number;
  guests?: number;
  city?: string;
  state?: string;
  limit?: number;
}): Promise<{ properties: PhProperty[]; geo?: any }> {
  const q = new URLSearchParams({ geo: params.geo });
  if (params.radiusMi != null) q.set('radius_mi', String(params.radiusMi));
  if (params.guests != null) q.set('guests', String(params.guests));
  if (params.city) q.set('city', params.city);
  if (params.state) q.set('state', params.state);
  if (params.limit != null) q.set('limit', String(params.limit));
  return phFetch(`${phUrl('properties')}?${q.toString()}`);
}

/** Public read: availability + a quote for a date range. */
export async function propertyAvailability(
  id: string,
  params: { from: string; to: string; guests?: number },
): Promise<PhAvailability> {
  const q = new URLSearchParams({ from: params.from, to: params.to });
  if (params.guests != null) q.set('guests', String(params.guests));
  const raw: any = await phFetch(`${phUrl(`properties/${encodeURIComponent(id)}/availability`)}?${q.toString()}`);
  // Contract drift shim (crosstalk 2026-07-21): the live engine returns the price inside
  // `priceBreakdown.totalCents` rather than the contracted `quoteCents`. Normalize so the
  // booking form's `quoteCents` read works today, and keeps working once the engine conforms.
  const quoteCents =
    typeof raw?.quoteCents === 'number'
      ? raw.quoteCents
      : typeof raw?.priceBreakdown?.totalCents === 'number'
        ? raw.priceBreakdown.totalCents
        : undefined;
  return { ...raw, ...(quoteCents != null ? { quoteCents } : {}) } as PhAvailability;
}

export type CreateBookingInput = {
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  buyer: { name: string; email: string; phone?: string };
  guestNotes?: string;
  siteRef?: string;
  /** Where Stripe returns the guest after the hosted checkout (defaults to delivered.menu if omitted). */
  successUrl?: string;
  cancelUrl?: string;
};

/**
 * Proxy-authed rental booking. Creates a PENDING booking and returns a Stripe HOSTED-CHECKOUT URL
 * (`payment.checkoutUrl`); the block redirects the guest there to pay (PorchHearth owns the pay page —
 * no Stripe key sharing). Server-to-server ONLY. Throws PorchHearthError(503) when the shared secret
 * isn't configured (fail-closed).
 */
export async function createBooking(input: CreateBookingInput): Promise<PhBookingResult> {
  const secret = porchhearthProxySecret();
  if (!secret) throw new PorchHearthError(503, 'PorchHearth proxy secret not configured');

  // EXACTLY the whitelisted fields (forbidNonWhitelisted on the engine).
  const body: Record<string, any> = {
    propertyId: input.propertyId,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    numberOfGuests: input.numberOfGuests,
    buyer: {
      name: input.buyer.name,
      email: input.buyer.email,
      ...(input.buyer.phone ? { phone: input.buyer.phone } : {}),
    },
    ...(input.guestNotes ? { guestNotes: input.guestNotes } : {}),
    ...(input.siteRef ? { siteRef: input.siteRef } : {}),
    ...(input.successUrl ? { successUrl: input.successUrl } : {}),
    ...(input.cancelUrl ? { cancelUrl: input.cancelUrl } : {}),
  };

  return phFetch(phUrl('bookings'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-QS-Proxy-Secret': secret,
      ...(input.siteRef ? { 'X-QS-Site-Ref': input.siteRef } : {}),
    },
    body: JSON.stringify(body),
  });
}

export type CreateOrderInput = {
  listingId: string;
  portions: number;
  fulfillment?: 'pickup' | 'delivery';
  deliveryAddress?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  buyer: { name: string; email: string; phone?: string };
  siteRef?: string;
};

export type PhOrderResult = {
  orderId: string;
  status: string;
  amountCents?: number;
  payment: { clientSecret?: string } | null;
  siteRef?: string;
};

/**
 * Proxy-authed meal order — DOES take payment (returns a Stripe PaymentIntent clientSecret to confirm
 * client-side). Server-to-server ONLY. Fail-closed 503 without the shared secret. EXACTLY the
 * whitelisted fields (forbidNonWhitelisted).
 */
export async function createOrder(input: CreateOrderInput): Promise<PhOrderResult> {
  const secret = porchhearthProxySecret();
  if (!secret) throw new PorchHearthError(503, 'PorchHearth proxy secret not configured');

  const isDelivery = input.fulfillment === 'delivery';
  const body: Record<string, any> = {
    listingId: input.listingId,
    portions: input.portions,
    ...(input.fulfillment ? { fulfillment: input.fulfillment } : {}),
    ...(isDelivery && input.deliveryAddress ? { deliveryAddress: input.deliveryAddress } : {}),
    ...(isDelivery && input.deliveryLatitude != null ? { deliveryLatitude: input.deliveryLatitude } : {}),
    ...(isDelivery && input.deliveryLongitude != null ? { deliveryLongitude: input.deliveryLongitude } : {}),
    buyer: {
      name: input.buyer.name,
      email: input.buyer.email,
      ...(input.buyer.phone ? { phone: input.buyer.phone } : {}),
    },
    ...(input.siteRef ? { siteRef: input.siteRef } : {}),
  };

  return phFetch(phUrl('orders'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-QS-Proxy-Secret': secret,
      ...(input.siteRef ? { 'X-QS-Site-Ref': input.siteRef } : {}),
    },
    body: JSON.stringify(body),
  });
}
