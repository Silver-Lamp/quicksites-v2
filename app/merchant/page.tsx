// app/merchant/page.tsx
//
// Merchant "Getting Started" checklist — the landing page for /merchant.
// Reads real state (Stripe Connect + catalog) and walks a merchant from a bare
// account to a shareable, buyable storefront. Targets the funnel gap between
// `merchant_connected` and `catalog_item_created` → first sale.
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import CopyStoreLink from '@/components/merchant/CopyStoreLink';

export const dynamic = 'force-dynamic';

type Step = {
  title: string;
  body: string;
  done: boolean;
  href: string;
  cta: string;
  note?: string;
};

export default async function MerchantGettingStartedPage({
  searchParams,
}: {
  searchParams: { merchant?: string };
}) {
  const supabase = await getServerSupabase();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return <div className="p-8">Please sign in.</div>;

  // RLS-scoped: only the signed-in user's merchants.
  const { data: merchants } = await supabase
    .from('merchants')
    .select('id, display_name, name, site_slug')
    .order('created_at');

  const merchant = merchants?.find((m) => m.id === (searchParams.merchant || merchants?.[0]?.id));

  if (!merchant) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-semibold">Getting started</h1>
        <p className="mt-3 text-white/70">
          You don&apos;t have a merchant account yet. Create a site in the builder and enable
          commerce to start selling — then this checklist will guide you to your first sale.
        </p>
        <Link
          href="/admin/templates/new"
          className="mt-5 inline-block rounded-md border border-sky-500/40 bg-sky-500/10 px-4 py-2 font-medium text-sky-200 hover:bg-sky-500/20"
        >
          Build a site
        </Link>
      </div>
    );
  }

  // The merchant above is RLS-confirmed to belong to this user, so it's safe to
  // read its connect/catalog state with the service-role client.
  const admin = await getServerSupabase({ serviceRole: true });
  const qs = `?merchant=${merchant.id}`;

  const [{ data: pa }, { count: activeItems }] = await Promise.all([
    admin
      .from('payment_accounts')
      .select('status, account_ref')
      .eq('merchant_id', merchant.id)
      .maybeSingle(),
    admin
      .from('catalog_items')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchant.id)
      .eq('status', 'active'),
  ]);

  const connected = pa?.status === 'active';
  const connectStarted = !!pa?.account_ref && !connected;
  const hasProduct = (activeItems ?? 0) > 0;

  const steps: Step[] = [
    {
      title: 'Connect payouts',
      body: 'Link a Stripe account so you get paid. QuickSites takes its platform fee automatically at checkout — you keep the rest.',
      done: connected,
      href: `/merchant/connect${qs}`,
      cta: connected ? 'Manage payouts' : connectStarted ? 'Finish connecting' : 'Connect Stripe',
      note: connectStarted ? 'Started, but Stripe hasn’t enabled charges yet.' : undefined,
    },
    {
      title: 'Add your first product',
      body: 'List something to sell — a product, service, or digital item. You can add priced variants (size/color) and inventory too.',
      done: hasProduct,
      href: `/merchant/catalog${qs}`,
      cta: hasProduct ? 'Manage catalog' : 'Add a product',
      note: hasProduct ? `${activeItems} active item${activeItems === 1 ? '' : 's'}.` : undefined,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const readyToSell = connected && hasProduct;
  const storePath = `/store/${merchant.site_slug || merchant.id}`;
  const merchantName = merchant.display_name || merchant.name || 'your store';

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Getting started</h1>
      <p className="mt-1 text-white/60">
        Two steps to a live, buyable storefront for <span className="text-white/90">{merchantName}</span>.
      </p>

      {/* progress */}
      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-sky-500 transition-all"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
        <span className="text-sm text-white/60">
          {doneCount} of {steps.length}
        </span>
      </div>

      {/* steps */}
      <ol className="mt-6 space-y-3">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className={`rounded-xl border p-4 ${
              s.done ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/12 bg-white/5'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  s.done ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/70'
                }`}
              >
                {s.done ? '✓' : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-white">{s.title}</div>
                <p className="mt-1 text-sm text-white/60">{s.body}</p>
                {s.note && <p className="mt-1 text-xs text-white/45">{s.note}</p>}
                <Link
                  href={s.href}
                  className={`mt-3 inline-block rounded-md px-3 py-1.5 text-sm font-medium ${
                    s.done
                      ? 'border border-white/15 text-white/80 hover:bg-white/5'
                      : 'border border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20'
                  }`}
                >
                  {s.cta}
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* share reward */}
      <div
        className={`mt-6 rounded-xl border p-4 ${
          readyToSell ? 'border-sky-500/30 bg-sky-500/5' : 'border-white/10 bg-white/[0.03] opacity-70'
        }`}
      >
        <div className="font-medium text-white">
          {readyToSell ? '🎉 Your store is ready to sell' : 'Share your store'}
        </div>
        {readyToSell ? (
          <div className="mt-3">
            <p className="mb-2 text-sm text-white/60">Send this link to customers:</p>
            <CopyStoreLink path={storePath} />
          </div>
        ) : (
          <p className="mt-1 text-sm text-white/55">
            Finish the steps above and your shareable storefront link appears here.
          </p>
        )}
      </div>
    </div>
  );
}
