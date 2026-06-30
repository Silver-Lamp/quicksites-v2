// lib/commerce/pod/fulfillment.ts
//
// Phase 2 — turn a paid order's POD line items into Lulu/Gelato print jobs.
// A line item is POD when its catalog_items.metadata.fulfillment_provider is
// 'lulu' or 'gelato' (spec in metadata.pod_spec). Fully gated by POD_ENABLED;
// best-effort (never throws into the payment path). Records every attempt in
// print_orders, including 'awaiting_address'/'awaiting_fulfillment' when it
// can't complete yet (no shipping captured, or provider not configured).

import { getServerSupabase } from '@/lib/supabase/server';
import { isPodEnabled, isProviderConfigured, recordPrintOrder, type PodProvider } from './index';
import * as lulu from './lulu';
import * as gelato from './gelato';

/** Best-effort: extract a shipping address from the Stripe session/PI raw on the order. */
function extractShipping(raw: any): {
  name?: string; line1?: string; line2?: string; city?: string; state?: string;
  postal?: string; country?: string; email?: string; phone?: string;
} | null {
  const obj = raw?.data?.object ?? raw ?? {};
  const ship = obj.shipping_details ?? obj.shipping ?? obj.customer_details ?? null;
  const addr = ship?.address ?? obj.customer_details?.address ?? null;
  if (!addr) return null;
  return {
    name: ship?.name ?? obj.customer_details?.name ?? undefined,
    line1: addr.line1, line2: addr.line2 ?? undefined,
    city: addr.city, state: addr.state ?? undefined,
    postal: addr.postal_code, country: addr.country,
    email: obj.customer_details?.email ?? obj.receipt_email ?? undefined,
    phone: ship?.phone ?? obj.customer_details?.phone ?? undefined,
  };
}

export async function fulfillOrderPodItems(orderId: string): Promise<{ created: number; queued: number }> {
  let created = 0, queued = 0;
  if (!isPodEnabled()) return { created, queued };

  try {
    const supa = await getServerSupabase({ serviceRole: true });
    const { data: order } = await (supa as any)
      .from('orders').select('id, merchant_id, currency, raw').eq('id', orderId).single();
    if (!order) return { created, queued };

    const { data: items } = await (supa as any)
      .from('order_items').select('id, catalog_item_id, title, quantity, metadata').eq('order_id', orderId);
    if (!items?.length) return { created, queued };

    const ship = extractShipping(order.raw);

    for (const it of items) {
      // POD spec: prefer the line-item metadata, else the catalog item's metadata.
      let meta: any = it.metadata && it.metadata.fulfillment_provider ? it.metadata : null;
      if (!meta && it.catalog_item_id) {
        const { data: ci } = await (supa as any)
          .from('catalog_items').select('metadata').eq('id', it.catalog_item_id).maybeSingle();
        meta = ci?.metadata ?? null;
      }
      const provider = meta?.fulfillment_provider as PodProvider | undefined;
      if (provider !== 'lulu' && provider !== 'gelato') continue; // not a POD item
      const spec = meta?.pod_spec ?? {};

      const base = {
        order_id: orderId, merchant_id: order.merchant_id, provider,
        shipping_address: ship, raw: { item_id: it.id, spec },
      };

      // Can't ship without an address, or fulfill without provider creds → queue it.
      if (!ship?.line1 || !isProviderConfigured(provider)) {
        await recordPrintOrder({ ...base, status: !ship?.line1 ? 'awaiting_address' : 'awaiting_fulfillment' });
        queued++;
        continue;
      }

      try {
        if (provider === 'lulu') {
          const job = await lulu.createPrintJob({
            title: it.title || spec.title || 'Book',
            interiorUrl: spec.interiorUrl, coverUrl: spec.coverUrl,
            pageCount: Number(spec.pageCount) || 0, quantity: Math.max(1, Number(it.quantity) || 1),
            podPackageId: spec.podPackageId,
            shippingAddress: {
              name: ship.name || 'Customer', street1: ship.line1!, street2: ship.line2,
              city: ship.city || '', state_code: ship.state, postcode: ship.postal || '',
              country_code: ship.country || 'US', phone_number: ship.phone || '0000000000', email: ship.email,
            },
            shippingLevel: (spec.shippingLevel as lulu.ShippingLevel) || 'MAIL',
            externalId: `${orderId}:${it.id}`,
          });
          await recordPrintOrder({ ...base, provider_job_id: String(job.id), status: job.status || 'CREATED' });
        } else {
          const order2 = await gelato.createGelatoOrder({
            orderReferenceId: `${orderId}:${it.id}`, customerReferenceId: ship.email || orderId,
            productUid: spec.productUid, fileUrl: spec.fileUrl, quantity: Math.max(1, Number(it.quantity) || 1),
            currency: order.currency || 'USD',
            shippingAddress: {
              firstName: (ship.name || 'Customer').split(' ')[0], lastName: (ship.name || '').split(' ').slice(1).join(' ') || '—',
              addressLine1: ship.line1!, addressLine2: ship.line2, city: ship.city || '',
              state: ship.state, postCode: ship.postal || '', country: ship.country || 'US',
              email: ship.email || '', phone: ship.phone,
            },
          });
          await recordPrintOrder({ ...base, provider_job_id: String(order2.id), status: order2.fulfillmentStatus || 'created' });
        }
        created++;
      } catch (e: any) {
        await recordPrintOrder({ ...base, status: 'error', raw: { ...base.raw, error: String(e?.message || e).slice(0, 300) } });
        queued++;
      }
    }
  } catch (e: any) {
    console.warn('[pod] fulfillOrderPodItems failed:', e?.message || e);
  }
  return { created, queued };
}
