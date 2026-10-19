// app/merchant/bookings/[templateId]/page.tsx
//
// The restaurant's phone page: tonight and tomorrow, who is at which table, add a booking taken
// over the phone, cancel one (the table reopens on the site the same second — the exclusion
// constraint ignores cancelled rows). Owner or platform admin only; the words are in the site's
// booking locale (Italian for the Italy demo).
import { notFound } from 'next/navigation';
import { getSupabaseRSC } from '@/lib/supabase/serverClient';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { loadBookingSite, loadTables } from '@/lib/booking/db';
import { bookingStrings } from '@/lib/booking/i18n';
import BookingsClient from '@/components/merchant/bookings-client';
import ConnectHjCard from '@/components/merchant/connect-hj-card';

export const dynamic = 'force-dynamic';

export default async function MerchantBookingsPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(templateId)) notFound();
  const supabase = await getSupabaseRSC();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div className="p-8 text-sm text-muted-foreground">Please sign in.</div>;
  const site = await loadBookingSite(templateId);
  if (!site) notFound();
  const { data: adminRow } = await supabaseAdmin.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!adminRow && site.ownerId !== user.id) return <div className="p-8 text-sm text-muted-foreground">This site is not yours.</div>;
  const tables = await loadTables(templateId);
  const t = bookingStrings(site.settings.locale, site.settings.mode);
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-foreground">{t.ownerTitle}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {site.name}
        {site.slug ? (
          <>
            {' · '}
            <a className="underline underline-offset-4" href={`/sites/${site.slug}`} target="_blank" rel="noreferrer">
              /sites/{site.slug}
            </a>
          </>
        ) : null}
      </p>
      <div className="mt-6">
        <BookingsClient templateId={templateId} locale={site.settings.locale} mode={site.settings.mode} tz={site.settings.tz} tables={tables.map((x) => ({ id: x.id, label: x.label, seats: x.seats }))} maxParty={Math.max(site.settings.maxParty, ...tables.map((x) => x.seats), 1)} />
      </div>
      {/* The owner-consented link to HiveJournal's floor plan + food cost (lib/booking/partnerLink.ts). */}
      <div className="mt-8">
        <ConnectHjCard templateId={templateId} />
      </div>
    </div>
  );
}
