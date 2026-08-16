// app/cart/page.tsx
//
// Server component so the Venmo handle can be resolved from the request host before render —
// the cart is an app route with no template in scope, but it is reached at the tenant's own
// host. See lib/payments/venmoForHost.ts.

import CartPageClient from '@/components/cart/CartPageClient';
import { venmoHandleForCurrentHost } from '@/lib/payments/venmoForHost';

export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const venmoHandle = await venmoHandleForCurrentHost();
  return <CartPageClient venmoHandle={venmoHandle} />;
}
