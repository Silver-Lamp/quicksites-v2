// app/admin/auto-shop-domains/page.tsx
//
// The auto-shop domain-competition cockpit — the SecondSet-forward analog of
// /admin/restaurant-domains. Launch <city>-auto-repair.com competitions from cohorts of
// no-website auto shops, watch the cohort + first-to-claim winner, and open the live apex
// directory. Admin-gated.

import { getAdminUser } from '@/lib/auth/getAdminUser';
import AutoShopDomainsClient from '@/components/admin/auto-shop-domains-client';

export const dynamic = 'force-dynamic';

export default async function AutoShopDomainsPage() {
  const admin = await getAdminUser();
  if (!admin) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-sm text-red-500">Forbidden — platform admin only.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold">🔧 Auto-shop domain competitions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A premium <code>&lt;city&gt;-auto-repair.com</code> is the prize for a cohort of no-website shops.
        First to claim their site wins the apex — a directory of shops that <b>show you the work</b> (SecondSet).
      </p>
      <div className="mt-6">
        <AutoShopDomainsClient />
      </div>
    </div>
  );
}
