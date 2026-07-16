// app/admin/outreach/page.tsx
// CedarSites outreach pipeline — every auto-built listing-import draft, its menu status,
// claim status, and links. Now also a tab inside the unified Growth workspace
// (/admin/growth?tab=pipeline); this standalone route stays as an alias. Admin-gated.
import Link from 'next/link';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import OutreachPipeline from '@/components/admin/outreach-pipeline';
import { loadOutreachDrafts } from '@/lib/outreach/growthData';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function OutreachPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;

  const list = await loadOutreachDrafts();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 text-white">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Outreach pipeline</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Auto-built local-business sites from the listing importer. Send the claim link; they preview, sign up, and own it.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-sm">
          <Link href="/admin/go-live" className="text-emerald-400 underline underline-offset-4 hover:text-emerald-300">
            Go-live readiness →
          </Link>
          <Link href="/admin/demand-funnel" className="text-sky-400 underline underline-offset-4 hover:text-sky-300">
            Demand funnel →
          </Link>
          <Link href="/restaurants" className="text-amber-300 underline underline-offset-4 hover:text-amber-200">
            The offer →
          </Link>
        </div>
      </div>
      <div className="mt-8">
        <OutreachPipeline list={list} />
      </div>
    </div>
  );
}
