// lib/commerce/pod/gelato.ts
//
// Gelato print-on-demand client (Order API v4: posters/apparel). Ported from
// hivejournal (apps/backend/src/services/gelato-client.ts). Env: GELATO_API_KEY.

const GELATO_ORDER_BASE = 'https://order.gelatoapis.com/v4';

export function isGelatoConfigured(): boolean {
  return !!process.env.GELATO_API_KEY;
}
function apiKey(): string {
  const key = process.env.GELATO_API_KEY;
  if (!key) throw new Error('GELATO_API_KEY is not configured');
  return key;
}

export interface GelatoShippingAddress {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postCode: string;
  country: string; // ISO-2
  email: string;
  phone?: string;
}

export interface CreateGelatoOrderInput {
  orderReferenceId: string;
  customerReferenceId: string;
  productUid: string;
  fileUrl: string; // public URL of the print-ready asset
  quantity: number;
  shippingAddress: GelatoShippingAddress;
  currency?: string;
}

export interface GelatoOrder {
  id: string;
  orderReferenceId?: string;
  fulfillmentStatus?: string;
  financialStatus?: string;
}

export async function createGelatoOrder(input: CreateGelatoOrderInput): Promise<GelatoOrder> {
  const body = {
    orderType: 'order',
    orderReferenceId: input.orderReferenceId,
    customerReferenceId: input.customerReferenceId,
    currency: input.currency || 'USD',
    items: [
      {
        itemReferenceId: `${input.orderReferenceId}-1`,
        productUid: input.productUid,
        quantity: input.quantity,
        files: [{ type: 'default', url: input.fileUrl }],
      },
    ],
    shipmentMethodUid: 'normal',
    shippingAddress: input.shippingAddress,
  };

  const res = await fetch(`${GELATO_ORDER_BASE}/orders`, {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gelato order create failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return (await res.json()) as GelatoOrder;
}

export async function getGelatoOrder(orderId: string): Promise<GelatoOrder> {
  const res = await fetch(`${GELATO_ORDER_BASE}/orders/${encodeURIComponent(orderId)}`, {
    headers: { 'X-API-KEY': apiKey() },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gelato order fetch failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return (await res.json()) as GelatoOrder;
}
