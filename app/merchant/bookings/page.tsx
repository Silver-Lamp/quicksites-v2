// app/merchant/bookings/page.tsx — which of your sites take table bookings. A site counts when it
// has at least one table in `restaurant_tables`; an admin sees every such site.
import Link from 'next/link';
import { getSupabaseRSC } from '@/lib/supabase/serverClient';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function MerchantBookingsIndex() {
  const supabase = await getSupabaseRSC();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div className="p-8 text-sm text-muted-foreground">Please sign in.</div>;
  const { data: adminRow } = await supabaseAdmin.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  const { data: tableRows } = await supabaseAdmin.from('restaurant_tables').select('template_id').eq('active', true);
  const ids = [...new Set(((tableRows ?? []) as Array<{ template_id: string }>).map((r) => r.template_id))];
  let sites: Array<{ id: string; slug: string | null; business_name: string | null; template_name: string }> = [];
  if (ids.length) {
    let q = supabaseAdmin.from('templates').select('id, slug, business_name, template_name, owner_id').in('id', ids).order('template_name');
    if (!adminRow) q = q.eq('owner_id', user.id);
    const { data } = await q;
    sites = (data ?? []) as any;
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-foreground">Bookings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sites that take table bookings. Tonight, tomorrow, phone bookings, cancellations.</p>
      <div className="mt-6 space-y-2">
        {sites.length === 0 ? (
          <p className="text-sm text-muted-foreground">None of your sites has tables yet.</p>
        ) : (
          sites.map((s) => (
            <Link key={s.id} href={`/merchant/bookings/${s.id}`} className="block rounded-xl border border-border bg-card px-4 py-3 text-sm text-card-foreground hover:border-primary">
              <div className="font-medium">{s.business_name || s.template_name}</div>
              {s.slug ? <div className="text-xs text-muted-foreground">/sites/{s.slug}</div> : null}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
