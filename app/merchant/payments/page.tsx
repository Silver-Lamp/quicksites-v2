// app/merchant/payments/page.tsx
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function MerchantPaymentsPage({ searchParams }: { searchParams: { merchant?: string } }) {
  const supabase = await getServerSupabase(); // normal session; RLS enforces owner
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return <div className="p-8">Please sign in.</div>;

  // pick merchant (first one if none passed)
  const { data: merchants } = await supabase.from('merchants').select('id, display_name, site_slug, default_currency').order('created_at');
  const merchantId = searchParams.merchant || merchants?.[0]?.id;
  if (!merchantId) return <div className="p-8">No merchant yet.</div>;

  const { data: acct } = await supabase
    .from('payment_accounts')
    .select('id, provider, account_ref, status, collect_platform_fee, platform_fee_percent, platform_fee_min_cents')
    .eq('merchant_id', merchantId).limit(1).maybeSingle();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Payments</h1>
      <p className="mt-2 text-sm text-neutral-400">Configure where checkout is routed for <b>{merchants?.find(m => m.id === merchantId)?.display_name}</b>.</p>

      {acct ? (
        <div className="mt-6 rounded-xl border border-neutral-800 p-5">
          <div className="text-sm">
            <div><span className="text-neutral-400">Provider:</span> {acct.provider}</div>
            <div className="mt-1"><span className="text-neutral-400">Account Ref:</span> <code className="font-mono">{acct.account_ref}</code></div>
            <div className="mt-1"><span className="text-neutral-400">Status:</span> {acct.status}</div>
          </div>
          <form action={async (fd: FormData) => {
            'use server';
            const supa = await getServerSupabase(); // owner; RLS
            const { error } = await supa.from('payment_accounts').update({
                account_ref: String(fd.get('account_ref') || ''),
                status: String(fd.get('status') || 'active'),
                collect_platform_fee: String(fd.get('collect_platform_fee') || 'off') === 'on',
                platform_fee_percent: Number(fd.get('platform_fee_percent') || 0) / 100,  // input is %
                platform_fee_min_cents: Math.round(Number(fd.get('platform_fee_min') || 0) * 100), // input is $
            }).eq('id', acct.id);
            if (error) throw error;
            }} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-6">
            <div className="md:col-span-3">
                <label className="block text-xs text-neutral-400">Account Ref</label>
                <input name="account_ref" defaultValue={acct.account_ref}
                className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
            </div>
            <div>
                <label className="block text-xs text-neutral-400">Status</label>
                <select name="status" defaultValue={acct.status}
                className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800">
                <option value="active">active</option>
                <option value="disabled">disabled</option>
                </select>
            </div>

            <div className="md:col-span-6 mt-4">
                <div className="text-sm font-medium">Platform fee (Stripe Connect)</div>
                <p className="text-xs text-neutral-400">If enabled, we add an application fee on each order and transfer the remainder to your connected account.</p>
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
                <input id="cpf" name="collect_platform_fee" type="checkbox"
                defaultChecked={acct.collect_platform_fee ?? false} className="h-4 w-4" />
                <label htmlFor="cpf" className="text-sm">Collect platform fee</label>
            </div>
            <div>
                <label className="block text-xs text-neutral-400">Percent (%)</label>
                <input name="platform_fee_percent" type="number" min={0} max={100}
                defaultValue={Math.round((acct.platform_fee_percent || 0) * 100)}
                className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
            </div>
            <div>
                <label className="block text-xs text-neutral-400">Minimum ($)</label>
                <input name="platform_fee_min" type="number" min={0} step="0.01"
                defaultValue={(acct.platform_fee_min_cents || 0) / 100}
                className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
            </div>

            <div className="md:col-span-6 flex items-center justify-end">
                <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium">Save</button>
            </div>
            </form>
        </div>
      ) : (
        <CreatePaymentAccount merchantId={merchantId} />
      )}
    </div>
  );
}

function CreatePaymentAccount({ merchantId }: { merchantId: string }) {
  async function create(fd: FormData) {
    'use server';
    const supabase = await getServerSupabase({ serviceRole: true }); // owner creates own account; RLS checks
    const provider = String(fd.get('provider') || 'stripe');
    const account_ref = String(fd.get('account_ref') || '');
    const { error } = await supabase.from('payment_accounts').insert({
      merchant_id: merchantId,
      provider,
      account_ref,
      status: 'active'
    });
    if (error) throw error;
  }
  return (
    <form action={create} className="mt-6 grid grid-cols-1 gap-3 rounded-xl border border-neutral-800 p-5 md:grid-cols-3">
      <div>
        <label className="block text-xs text-neutral-400">Provider</label>
        <select name="provider" defaultValue="stripe" className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800">
          <option value="stripe">Stripe</option>
          <option value="paypal">PayPal</option>
          <option value="square">Square</option>
          <option value="authorize_net">Authorize.Net</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-neutral-400">Account Ref</label>
        <input name="account_ref" placeholder="e.g., acct_123 (or provider account id)"
          className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
      </div>
      <div className="flex items-end">
        <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium">Connect</button>
      </div>
      <p className="md:col-span-3 text-xs text-neutral-500">
        For Stripe Connect, this is the destination <code className="font-mono">acct_…</code>. For others, store whatever identifier their webhook will return so we can reconcile later.
      </p>
    </form>
  );
}
