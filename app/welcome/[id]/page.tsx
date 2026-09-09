// app/welcome/[id]/page.tsx
//
// Post-claim payoff. After an owner claims their auto-built site, we land them here (instead of
// straight into the editor). Two jobs:
//
//   1. Show the site is LIVE at its address — true since claim publishes it (lib/tradeSites/activate).
//   2. For a trade site, offer the one paid thing: a custom domain we register and manage. This is
//      the self-serve conversion the business plan depends on ("a claim link and a card on file or it
//      is nothing"). Flag-gated: with TRADE_SITE_BILLING_ENABLED off the page shows no price at all.
//
// Restaurants keep the demand block ("N people tried to order") — that activation hook is theirs.
// Owner/admin-gated (the leads are PII the public claim page never shows).
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { signInHref } from '@/lib/auth/authLinks';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getDemandDetails } from '@/lib/menu/demand';
import { publicSiteUrl } from '@/lib/sites/publicUrl';
import { getSenderProfile } from '@/lib/outreach/senderProfile';
import { isTradeIndustry, tradeSiteBillingEnabled, tradeSiteDomainPriceCents } from '@/lib/tradeSites/config';
import { getTradeSiteSubscription } from '@/lib/tradeSites/subscriptions';
import TradeSiteUpgrade from '@/components/welcome/trade-site-upgrade';

function telHref(phone: string | null) {
  const d = (phone || '').replace(/[^\d+]/g, '');
  return d ? `tel:${d}` : '';
}

function priceLabel(cents: number): string {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}/month`;
}

export default async function ClaimWelcomePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const id = params.id;
  const editorHref = `/admin/templates/${id}`;

  const supa = await getServerSupabase();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect(signInHref(`/welcome/${id}`));

  const { data: tpl } = await supabaseAdmin
    .from('templates')
    .select('owner_id, business_name, template_name, slug, custom_domain, industry, published')
    .eq('id', id)
    .maybeSingle();
  if (!tpl) redirect('/admin/templates');

  // Owner or platform admin only — the leads below are customer PII.
  const isOwner = (tpl as any).owner_id === user.id;
  if (!isOwner) {
    const { data: adminRow } = await supabaseAdmin.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
    if (!adminRow) redirect(editorHref); // not theirs → just send them to the editor
  }

  const t = tpl as any;
  const name = t.business_name || t.template_name || 'your site';
  const url = publicSiteUrl({ custom_domain: t.custom_domain, slug: t.slug });
  const isTrade = isTradeIndustry(t.industry);
  const upgraded = searchParams?.upgraded === '1';

  const detail = isTrade ? null : (await getDemandDetails([id]))[id];
  const count = detail?.count ?? 0;
  const leads = detail?.leads ?? [];
  const calls = detail?.calls ?? 0;

  const sub = isTrade ? await getTradeSiteSubscription(id) : null;
  const hasActiveSub = !!sub && sub.subscription_status === 'active';
  const offerDomain = isTrade && tradeSiteBillingEnabled() && !t.custom_domain && !hasActiveSub;
  // The warmest moment to offer a human: the owner just claimed. Same profile the card printed.
  const sender = await getSenderProfile().catch(() => null);
  const bookingUrl = sender?.bookingUrl && /^https:\/\/\S+$/i.test(sender.bookingUrl) ? sender.bookingUrl : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center px-6 py-16 text-center">
      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
        Claimed ✓
      </span>
      <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
        🎉 {name} is yours.
      </h1>

      {url && t.published ? (
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          It’s live at{' '}
          <a href={url} target="_blank" rel="noopener" className="font-semibold text-sky-400 hover:text-sky-300">
            {url.replace(/^https?:\/\//, '')}
          </a>
          . Everything on it came from your public listing — edit anything that isn’t right.
        </p>
      ) : (
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Your site is yours to edit. Open the editor to review it and publish when it looks right.
        </p>
      )}

      {upgraded && sub && (
        <div className="mt-6 w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-left text-sm">
          <div className="font-semibold text-emerald-300">Payment received.</div>
          <div className="mt-1 text-muted-foreground">
            {sub.domain_status === 'bound'
              ? <>{sub.desired_domain} is connected. DNS can take up to an hour to reach everyone.</>
              : <>We’re setting up {sub.desired_domain}. Your subdomain keeps working meanwhile; we’ll email you when the domain is connected.</>}
          </div>
        </div>
      )}

      {!isTrade && count > 0 && (
        <>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            While it was a preview, <span className="font-semibold text-amber-300">{count} {count === 1 ? 'person' : 'people'} tried to order</span>.
            Turn on online ordering to reach them{leads.length ? " — here's who:" : '.'}
          </p>

          {leads.length > 0 && (
            <ul className="mt-6 w-full space-y-2 text-left">
              {leads.map((l, i) => (
                <li key={i} className="rounded-xl border border-border bg-card p-3 text-card-foreground">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{l.name || 'Someone'}</span>
                    {l.phone && (
                      <a href={telHref(l.phone)} className="text-sm text-sky-400 hover:text-sky-300">📞 {l.phone}</a>
                    )}
                  </div>
                  {l.items && <div className="mt-1 text-sm text-muted-foreground">“{l.items}”</div>}
                </li>
              ))}
            </ul>
          )}
          {calls > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">+ {calls} more tapped to call (no message left).</p>
          )}
        </>
      )}

      {offerDomain && (
        <TradeSiteUpgrade templateId={id} priceLabel={priceLabel(tradeSiteDomainPriceCents())} businessName={name} />
      )}

      <div className="mt-8">
        <Link
          href={editorHref}
          className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-6 py-3 text-base font-semibold text-zinc-950 transition hover:bg-emerald-300"
        >
          Open your site editor →
        </Link>
      </div>
      {bookingUrl && (
        <p className="mt-6 max-w-md text-sm text-muted-foreground">
          Want a hand setting it up?{' '}
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline underline-offset-4">
            Book 15 minutes{sender?.name ? ` with ${sender.name}` : ''}
          </a>
          .
        </p>
      )}
      <p className="mt-6 max-w-md text-xs text-muted-foreground">
        Don’t want it? Say the word and it’s gone — email support@quicksites.ai from the address you signed up with.
      </p>
    </main>
  );
}
