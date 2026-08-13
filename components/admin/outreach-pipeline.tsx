// components/admin/outreach-pipeline.tsx
//
// The CedarSites outreach pipeline surface: every auto-built listing-import draft, its
// menu/claim status, and claim-link actions. Extracted from app/admin/outreach so it can
// render both standalone and as a tab inside the unified Growth workspace. Server component
// (mints claim tokens + builds menu URLs server-side); OutreachActions is the client bit.
import { mintSiteClaimToken } from '@/lib/auth/siteClaimToken';
import { menuSiteUrl } from '@/lib/menu/deliveredMenu';
import type { DemandLead } from '@/lib/menu/demand';
import OutreachActions from '@/components/admin/outreach-actions';
import DemandLeadsCell from '@/components/admin/demand-leads-cell';
import DraftSignalsCell from '@/components/admin/draft-signals-cell';
import type { Signal } from '@/lib/outreach/draftSignals';

export type OutreachDraft = {
  id: string;
  slug: string | null;
  business_name: string | null;
  template_name: string | null;
  created_at: string | null;
  claim_source: string | null;
  data: any;
  /** Order-intents logged on the unclaimed draft (demand capture). */
  demand?: number;
  /** Anonymous tap-to-call events (no contact left). */
  demandCalls?: number;
  /** Order-ahead leads that left a name/phone/items — newest first. */
  demandLeads?: DemandLead[];
  /** What's notable/wrong about this draft (lib/outreach/draftSignals.ts). */
  signals?: Signal[];
  /** Phase 2: have we already texted the restaurant about the demand? */
  demandNotified?: boolean;
  /** The restaurant's own phone (for a one-tap manual follow-up). */
  restaurantPhone?: string | null;
};

/** Count menu items across the menu block's sections (0 if none / no menu block). */
function menuItemCount(data: any): number {
  const blocks: any[] = data?.pages?.[0]?.blocks ?? [];
  const menu = blocks.find((b) => b?.type === 'menu');
  const sections: any[] = menu?.content?.sections ?? [];
  return sections.reduce((n, s) => n + (Array.isArray(s?.items) ? s.items.length : 0), 0);
}

/** Does this draft have a menu block at all? The funnel now spans non-food verticals
 *  (HVAC, towing, contractors) — for those, "menu" and the diner order QR don't apply,
 *  so we hide the food-only affordances rather than showing a misleading "no menu". */
function hasMenuBlock(data: any): boolean {
  const blocks: any[] = data?.pages?.[0]?.blocks ?? [];
  return blocks.some((b) => b?.type === 'menu');
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

export default function OutreachPipeline({ list }: { list: OutreachDraft[] }) {
  const total = list.length;
  const claimed = list.filter((r) => r.claim_source === 'listing_claimed').length;
  const pending = total - claimed;
  const withMenu = list.filter((r) => menuItemCount(r.data) > 0).length;
  const convRate = total ? Math.round((claimed / total) * 100) : 0;
  const totalDemand = list.reduce((n, r) => n + (r.demand ?? 0), 0);

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <Stat label="Drafts built" value={String(total)} />
        <Stat label="Pending (unclaimed)" value={String(pending)} accent="text-amber-300" />
        <Stat label="Claimed" value={String(claimed)} accent="text-emerald-300" />
        <Stat label="With a real menu" value={String(withMenu)} />
        <Stat label="Order intents" value={String(totalDemand)} accent="text-sky-300" />
        <Stat label="Conversion" value={`${convRate}%`} />
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900">
            <tr className="text-left [&>th]:px-4 [&>th]:py-3 [&>th]:font-medium [&>th]:text-neutral-400">
              <th>Business</th><th>Built</th><th>Menu</th><th>Notable</th><th>Demand</th><th>Status</th><th>Preview</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {list.map((r) => {
              const items = menuItemCount(r.data);
              const isFood = hasMenuBlock(r.data);
              const demand = r.demand ?? 0;
              const isClaimed = r.claim_source === 'listing_claimed';
              const name = r.business_name || r.template_name || r.slug || r.id.slice(0, 8);
              const previewPath = menuSiteUrl(r.slug ?? r.id);
              const claimPath = `/claim-site/${r.id}?token=${encodeURIComponent(mintSiteClaimToken(r.id))}`;
              return (
                <tr key={r.id} className="align-middle [&>td]:px-4 [&>td]:py-3">
                  <td className="font-medium">{name}</td>
                  <td className="whitespace-nowrap text-neutral-400">{fmtDate(r.created_at)}</td>
                  <td>
                    {!isFood ? (
                      <span className="text-xs text-neutral-600" title="Not a menu-based business">—</span>
                    ) : items > 0 ? (
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">{items} items</span>
                    ) : (
                      <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-500">no menu</span>
                    )}
                  </td>
                  <td className="align-top">
                    <DraftSignalsCell signals={r.signals} />
                  </td>
                  <td>
                    <DemandLeadsCell
                      count={demand}
                      calls={r.demandCalls ?? 0}
                      leads={r.demandLeads ?? []}
                      notified={r.demandNotified ?? false}
                      restaurantName={name}
                      restaurantPhone={r.restaurantPhone ?? null}
                    />
                  </td>
                  <td>
                    {isClaimed ? (
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">Claimed</span>
                    ) : (
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">Pending</span>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <a href={previewPath} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline underline-offset-2 hover:text-sky-300">
                        View ↗
                      </a>
                      {isFood && (
                        <a href={`/api/admin/outreach/${r.id}/order-qrcode`} target="_blank" rel="noopener noreferrer" className="text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-200" title="Diner order QR — print & place at the restaurant to feed demand">
                          Order QR ⤓
                        </a>
                      )}
                    </div>
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
                <td className="px-4 py-8 text-center text-neutral-500" colSpan={7}>
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
