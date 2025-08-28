// app/admin/tax/page.tsx
import { getServerSupabase } from '@/lib/supabase/server';
import { get1099Candidates } from '@/lib/tax/get1099Candidates';

function fmt(c:number, cur='USD'){ return new Intl.NumberFormat('en-US',{style:'currency',currency:cur}).format((c||0)/100); }

export const dynamic = 'force-dynamic';

export default async function TaxAdmin({ searchParams }:{ searchParams: { year?: string } }) {
  // Admin gate
  const supa = await getServerSupabase();
  const { data: u } = await supa.auth.getUser();
  if (!u?.user) return <div className="p-8">Please sign in.</div>;
  const { data: profile } = await supa.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
  const isAdmin = (u.user.user_metadata?.role === 'admin') || profile?.role === 'admin';
  if (!isAdmin) return <div className="p-8">Forbidden.</div>;

  const now = new Date();
  const defaultYear = now.getUTCFullYear();
  const taxYear = Number(searchParams.year || defaultYear);

  const candidates = await get1099Candidates(taxYear, { thresholdCents: 60000, includeCorps: false });

  // load filings to reflect furnish/file status
  const svc = await getServerSupabase({ serviceRole: true });
  const { data: filings } = await svc
    .from('affiliate_1099_filings')
    .select('affiliate_user_id, tax_year, status, furnished_on, filed_on')
    .eq('tax_year', taxYear);

  const byUser = new Map((filings || []).map(f => [f.affiliate_user_id, f]));

  const base = process.env.QS_PUBLIC_URL || '';

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tax · 1099-NEC Candidates</h1>
          <p className="mt-1 text-sm text-neutral-400">Cash-basis payouts (non-TPSO) for calendar year {taxYear}.</p>
        </div>
        <div className="flex items-center gap-2">
          <form>
            <input type="number" name="year" defaultValue={taxYear}
              className="w-24 rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
            <button className="ml-2 rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800">Go</button>
          </form>
          <a className="rounded bg-purple-600 px-4 py-2 text-sm font-medium"
             href={`${base}/api/tax/iris-export?year=${taxYear}`} target="_blank">
            Export IRIS CSV
          </a>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900">
            <tr className="[&>th]:px-4 [&>th]:py-3 text-left">
              <th>Affiliate</th>
              <th>Email</th>
              <th>Entity</th>
              <th>Total (non-TPSO)</th>
              <th>Methods</th>
              <th>TIN</th>
              <th>Backup WH</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {candidates.map(c => {
              const f = byUser.get(c.user_id);
              const status = f?.status || 'draft';
              return (
                <tr key={c.user_id} className="[&>td]:px-4 [&>td]:py-3">
                  <td className="text-sm">{c.display_name || c.address.name || '—'}</td>
                  <td className="text-xs">{c.email || '—'}</td>
                  <td className="text-xs">{c.entity_type || '—'}</td>
                  <td className="font-medium">{fmt(c.total_cents)}</td>
                  <td className="text-xs">{c.methods.join(', ')}</td>
                  <td className="text-xs">{c.tin_status || '—'}</td>
                  <td className="text-xs">{c.backup_withholding ? 'on' : 'off'}</td>
                  <td className="text-xs"><span className="rounded bg-neutral-800 px-2 py-1">{status}</span></td>
                  <td className="text-xs">
                    <form action={async (fd: FormData) => {
                      'use server';
                      const svc2 = await getServerSupabase({ serviceRole: true });
                      const uid = String(fd.get('uid'));
                      const action = String(fd.get('action'));
                      const patch: any = { updated_at: new Date().toISOString(), tax_year: taxYear, affiliate_user_id: uid };
                      if (action === 'prepared') patch.status = 'prepared';
                      if (action === 'furnished') { patch.status = 'furnished'; patch.furnished_on = new Date().toISOString().slice(0,10); }
                      if (action === 'filed') { patch.status = 'filed'; patch.filed_on = new Date().toISOString().slice(0,10); }
                      // compute amount_reported from payouts snapshot
                      const { data: rows } = await svc2
                        .from('affiliate_payouts')
                        .select('amount_cents').eq('affiliate_user_id', uid).eq('tax_year', taxYear).eq('is_tpso', false);
                      const amt = (rows || []).reduce((s,r)=>s+Number(r.amount_cents||0),0);
                      patch.amount_reported_cents = amt;
                      await svc2.from('affiliate_1099_filings').upsert(patch, { onConflict: 'affiliate_user_id,tax_year' });
                    }}>
                      <input type="hidden" name="uid" value={c.user_id} />
                      <div className="flex gap-1">
                        <button name="action" value="prepared" className="rounded bg-neutral-900 px-2 py-1">Prepared</button>
                        <button name="action" value="furnished" className="rounded bg-neutral-900 px-2 py-1">Furnished</button>
                        <button name="action" value="filed" className="rounded bg-neutral-900 px-2 py-1">Filed</button>
                      </div>
                    </form>
                  </td>
                </tr>
              );
            })}
            {candidates.length === 0 && (
              <tr><td className="px-4 py-6 text-neutral-500" colSpan={9}>No 1099-NEC candidates for {taxYear}.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
