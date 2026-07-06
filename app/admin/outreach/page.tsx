// app/admin/outreach/page.tsx
// CedarSites outreach pipeline — every auto-built listing-import draft, its menu
// status, claim status, and links, in one place. Replaces the leads-results.json +
// manual cleanup with a managed surface. Admin-gated.
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { mintSiteClaimToken } from '@/lib/auth/siteClaimToken';
import OutreachActions from '@/components/admin/outreach-actions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Row = {
  id: string;
  slug: string | null;
  business_name: string | null;
  template_name: string | null;
  created_at: string | null;
  claim_source: string | null;
  data: any;
};

/** Count menu items across the menu block's sections (0 if none / no menu block). */
function menuItemCount(data: any): number {
  const blocks: any[] = data?.pages?.[0]?.blocks ?? [];
  const menu = blocks.find((b) => b?.type === 'menu');
  const sections: any[] = menu?.content?.sections ?? [];
  return sections.reduce((n, s) => n + (Array.isArray(s?.items) ? s.items.length : 0), 0);
}

function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className={`text-2xl font-bold tabular-nums ${accent ?? 'text-white'}`}>{value}</div>
      <div className="mt-1 text-xs text-neutral-400">{label}</div>
    </div>
  );
}

export default async function OutreachPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );

  const { data: rows } = await db
    .from('templates')
    .select('id, slug, business_name, template_name, created_at, claim_source, data')
    .in('claim_source', ['listing_import', 'listing_claimed'])
    .order('created_at', { ascending: false })
    .limit(300);

  const list: Row[] = (rows as Row[]) ?? [];
  const total = list.length;
  const claimed = list.filter((r) => r.claim_source === 'listing_claimed').length;
  const pending = total - claimed;
  const withMenu = list.filter((r) => menuItemCount(r.data) > 0).length;
  const convRate = total ? Math.round((claimed / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 text-white">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Outreach pipeline</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Auto-built restaurant sites from the listing importer. Send the claim link; they preview, sign up, and own it.
          </p>
        </div>
        <Link href="/restaurants" className="text-sm text-amber-300 underline underline-offset-4 hover:text-amber-200">
          The offer →
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Drafts built" value={String(total)} />
        <Stat label="Pending (unclaimed)" value={String(pending)} accent="text-amber-300" />
        <Stat label="Claimed" value={String(claimed)} accent="text-emerald-300" />
        <Stat label="With a real menu" value={String(withMenu)} />
        <Stat label="Conversion" value={`${convRate}%`} />
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900">
            <tr className="text-left [&>th]:px-4 [&>th]:py-3 [&>th]:font-medium [&>th]:text-neutral-400">
              <th>Restaurant</th><th>Built</th><th>Menu</th><th>Status</th><th>Preview</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {list.map((r) => {
              const items = menuItemCount(r.data);
              const isClaimed = r.claim_source === 'listing_claimed';
              const name = r.business_name || r.template_name || r.slug || r.id.slice(0, 8);
              const previewPath = `/preview/${encodeURIComponent(r.slug ?? r.id)}`;
              const claimPath = `/claim-site/${r.id}?token=${encodeURIComponent(mintSiteClaimToken(r.id))}`;
              return (
                <tr key={r.id} className="align-middle [&>td]:px-4 [&>td]:py-3">
                  <td className="font-medium">{name}</td>
                  <td className="whitespace-nowrap text-neutral-400">{fmtDate(r.created_at)}</td>
                  <td>
                    {items > 0 ? (
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">{items} items</span>
                    ) : (
                      <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-500">no menu</span>
                    )}
                  </td>
                  <td>
                    {isClaimed ? (
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">Claimed</span>
                    ) : (
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">Pending</span>
                    )}
                  </td>
                  <td>
                    <a href={previewPath} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline underline-offset-2 hover:text-sky-300">
                      View ↗
                    </a>
                  </td>
                  <td className="text-right">
                    {isClaimed ? (
                      <span className="text-xs text-neutral-600">—</span>
                    ) : (
                      <OutreachActions id={r.id} claimPath={claimPath} />
                    )}
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-neutral-500" colSpan={6}>
                  No outreach drafts yet. Run <code className="rounded bg-neutral-900 px-1">npm run import:listings -- leads.json</code>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
