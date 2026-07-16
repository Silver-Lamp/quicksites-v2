// app/welcome/[id]/page.tsx
//
// Post-claim payoff. After an owner claims their auto-built site, we land them here
// (instead of straight into the editor) to show the demand we captured while it was a
// preview — "N people tried to order, here's who" — the activation moment that turns the
// claim into "turn on online ordering now." Owner/admin-gated (the leads are PII the
// public claim page never shows). Falls back to a simple welcome when there's no demand.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getDemandDetails } from '@/lib/menu/demand';

function telHref(phone: string | null) {
  const d = (phone || '').replace(/[^\d+]/g, '');
  return d ? `tel:${d}` : '';
}

export default async function ClaimWelcomePage({ params }: { params: { id: string } }) {
  const id = params.id;
  const editorHref = `/admin/templates/${id}`;

  const supa = await getServerSupabase();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/welcome/${id}`)}`);

  const { data: tpl } = await supabaseAdmin
    .from('templates')
    .select('owner_id, business_name, template_name')
    .eq('id', id)
    .maybeSingle();
  if (!tpl) redirect('/admin/templates');

  // Owner or platform admin only — the leads below are customer PII.
  const isOwner = (tpl as any).owner_id === user.id;
  if (!isOwner) {
    const { data: adminRow } = await supabaseAdmin.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
    if (!adminRow) redirect(editorHref); // not theirs → just send them to the editor
  }

  const name = (tpl as any).business_name || (tpl as any).template_name || 'your site';
  const detail = (await getDemandDetails([id]))[id];
  const count = detail?.count ?? 0;
  const leads = detail?.leads ?? [];
  const calls = detail?.calls ?? 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center px-6 py-16 text-center">
      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
        Claimed ✓
      </span>
      <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
        🎉 {name} is yours.
      </h1>

      {count > 0 ? (
        <>
          <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
            While it was a preview, <span className="font-semibold text-amber-300">{count} {count === 1 ? 'person' : 'people'} tried to order</span>.
            Turn on online ordering to reach them{leads.length ? " — here's who:" : '.'}
          </p>

          {leads.length > 0 && (
            <ul className="mt-6 w-full space-y-2 text-left">
              {leads.map((l, i) => (
                <li key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-zinc-100">{l.name || 'Someone'}</span>
                    {l.phone && (
                      <a href={telHref(l.phone)} className="text-sm text-sky-400 hover:text-sky-300">📞 {l.phone}</a>
                    )}
                  </div>
                  {l.items && <div className="mt-1 text-sm text-zinc-300">“{l.items}”</div>}
                </li>
              ))}
            </ul>
          )}
          {calls > 0 && (
            <p className="mt-3 text-sm text-zinc-500">+ {calls} more tapped to call (no message left).</p>
          )}
        </>
      ) : (
        <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
          Your site is live and yours to edit. Add your menu, hours, and online ordering to start taking orders.
        </p>
      )}

      <div className="mt-8">
        <Link
          href={editorHref}
          className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-6 py-3 text-base font-semibold text-zinc-950 transition hover:bg-emerald-300"
        >
          Open your site editor →
        </Link>
      </div>
    </main>
  );
}
