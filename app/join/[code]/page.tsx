// Partner-branded merchant invite. A partner shares /join/<code>; the visitor
// lands on a branded welcome, and the CTA carries ?ref=<code> so middleware sets
// the qs_ref cookie. When they later create their merchant (billing/checkout ->
// ensureMerchantForUser -> ensureAttributionForMerchant), the merchant is bound
// to the partner's code and residual commissions accrue.
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import SiteHeader from '@/components/site/site-header';
import { PARTNER_FEE_SHARE } from '@/lib/commerce/partner-terms';
import { resolveOrg } from '@/lib/org/resolveOrg';
import { pickAccentColor } from '@/lib/org/theme';

export const dynamic = 'force-dynamic';

export default async function JoinByCode({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = (raw || '').trim();
  if (!code || code.length > 64) redirect('/');

  const admin = await getServerSupabase({ serviceRole: true });
  const { data: rc } = await admin
    .from('referral_codes')
    .select('code, owner_type, owner_id')
    .eq('code', code)
    .in('owner_type', ['provider_rep', 'qs_affiliate'])
    .maybeSingle();

  // Unknown/invalid invite → fall back to the normal front door.
  if (!rc) redirect('/');

  // White-label: on a reseller host the page carries the agency's brand, not
  // ours. Central/default orgs keep "QuickSites". (docs/WHITE_LABEL_PLAN.md Slice 2)
  const org = await resolveOrg();
  const isReseller = org.billing_mode === 'reseller';
  const brandName = isReseller ? org.name : 'QuickSites';
  const brandLogo = isReseller ? (org.dark_logo_url || org.logo_url || null) : null;
  // White-label accent from the org theme (docs/WHITE_LABEL_PLAN.md). Falls back
  // to the default sky styling when unset/invalid.
  const accent = isReseller ? pickAccentColor(org.theme_json) : null;

  // Best-effort partner name (never block on it).
  let partnerName = `A ${brandName} partner`;
  try {
    const { data: prof } = await admin
      .from('user_profiles')
      .select('name, email')
      .eq('user_id', (rc as any).owner_id)
      .maybeSingle();
    partnerName = (prof as any)?.name || (prof as any)?.email?.split('@')[0] || partnerName;
  } catch {
    /* keep default */
  }

  // Carry ?ref so middleware sets the qs_ref attribution cookie on click-through.
  const start = `/login?ref=${encodeURIComponent(code)}&next=${encodeURIComponent('/admin/templates/new')}`;

  const perks = [
    ['Free hosting', 'Launch your site with no monthly hosting bill.'],
    ['Built-in store', 'Sell products, meals, digital goods, or print-on-demand — checkout included.'],
    ['You keep more', 'A simple per-order fee, not a stack of monthly SaaS charges.'],
  ];

  return (
    <>
      <SiteHeader sticky />
      <main className="mx-auto max-w-2xl px-6 py-16 text-white">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
          {brandLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brandLogo} alt={brandName} className="mx-auto mb-4 h-10 w-auto object-contain" />
          )}
          <div className="text-xs uppercase tracking-wide text-sky-400" style={accent ? { color: accent } : undefined}>You've been invited</div>
          <h1 className="mt-2 text-3xl font-bold">Build your site with {brandName}</h1>
          <p className="mx-auto mt-3 max-w-md text-zinc-400">
            <span className="text-zinc-200">{partnerName}</span> invited you. Get a website and an online store,
            and only pay when you make a sale.
          </p>

          <div className="mt-8 flex justify-center">
            <Link
              href={start}
              className={`rounded-lg px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition ${accent ? '' : 'bg-sky-500 hover:bg-sky-400'}`}
              style={accent ? { backgroundColor: accent } : undefined}
            >
              Get started free
            </Link>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            No credit card to start. Invite code <code className="rounded bg-zinc-900 px-1">{code}</code>.
          </p>
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {perks.map(([title, body]) => (
            <li key={title} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="text-sm font-medium">{title}</div>
              <div className="mt-1 text-xs text-zinc-400">{body}</div>
            </li>
          ))}
        </ul>

        {/* Platform reseller-recruitment CTA — hidden on white-labeled (reseller)
            sites so we don't advertise "become a QuickSites reseller" under a
            partner's own brand. */}
        {!isReseller && (
          <p className="mt-8 text-center text-sm text-zinc-500">
            Are you an agency or reseller?{' '}
            <Link href="/partners" className="text-sky-400 underline underline-offset-4">
              Earn {Math.round(PARTNER_FEE_SHARE * 100)}% on every order your merchants process →
            </Link>
          </p>
        )}
      </main>
    </>
  );
}
