// app/admin/referrals/payout-wizard/page.tsx
import { getServerSupabase } from '@/lib/supabase/server';
import PayoutWizardClient from '@/components/admin/referrals/PayoutWizardClient';

export const dynamic = 'force-dynamic';

export default async function PayoutWizardPage() {
  // Admin gate (adjust to your role logic)
  const supa = await getServerSupabase();
  const { data: u } = await supa.auth.getUser();
  if (!u?.user) return <div className="p-8">Please sign in.</div>;
  const { data: profile } = await supa.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
  const isAdmin = (u.user.user_metadata?.role === 'admin') || profile?.role === 'admin';
  if (!isAdmin) return <div className="p-8">Forbidden.</div>;

  // Load all codes to choose from
  const svc = await getServerSupabase({ serviceRole: true });
  const { data: codes } = await svc
    .from('referral_codes')
    .select('code, owner_type, owner_id, plan')
    .order('code');

  // Default to the previous full month
  const now = new Date();
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const firstOfPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const endPrevMonth = new Date(firstOfThisMonth.getTime() - 24 * 3600 * 1000);
  const defaultStart = firstOfPrevMonth.toISOString().slice(0, 10);
  const defaultEnd = endPrevMonth.toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Payout Run Wizard</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Select referral code(s) and a date range. We’ll preview totals, let you download a combined CSV of
        <b> approved</b> items, then mark those as <b>paid</b>.
      </p>
      <div className="mt-6">
        <PayoutWizardClient
          codes={(codes || []).map(c => c.code)}
          defaultStart={defaultStart}
          defaultEnd={defaultEnd}
          baseUrl={process.env.QS_PUBLIC_URL || ''}
        />
      </div>
    </div>
  );
}
