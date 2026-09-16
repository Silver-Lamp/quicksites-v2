// app/admin/domains/watchlist/page.tsx — the domain watchlist (lib/domains/watchlist.ts).
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getWatchlist } from '@/lib/domains/watchlist';
import DomainWatchlistClient from '@/components/admin/domain-watchlist-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function DomainWatchlistPage() {
  const admin = await getAdminUser();
  if (!admin) {
    return <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-red-500">Admin access required.</div>;
  }
  const entries = await getWatchlist();
  const v = String(process.env.VERCEL_DOMAIN_REGISTER_ENABLED ?? '').toLowerCase();
  return <DomainWatchlistClient initial={entries} registerEnabled={v === '1' || v === 'true'} />;
}
