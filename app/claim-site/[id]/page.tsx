// app/claim-site/[id]/page.tsx
//
// Public claim landing for a CedarSites outreach draft. The business opens the link
// we sent → previews the site we built from their listing → "Claim it free" arms the
// claim cookie and sends them to sign up (ownership transfers post-login). Renders
// only for a valid token that binds this id AND a still-claimable draft.
import Link from 'next/link';
import { verifySiteClaimToken } from '@/lib/auth/siteClaimToken';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function ClaimSitePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Promise<{ token?: string; invalid?: string }>;
}) {
  const sp = await searchParams;
  const token = typeof sp?.token === 'string' ? sp.token : '';
  const payload = verifySiteClaimToken(token);
  const tokenOk = !!payload && payload.templateId === params.id && !sp?.invalid;

  const { data: tpl } = tokenOk
    ? await supabaseAdmin
        .from('templates')
        .select('id, slug, business_name, template_name, claim_source')
        .eq('id', params.id)
        .maybeSingle()
    : { data: null };

  const claimable = tokenOk && tpl && (tpl as any).claim_source === 'listing_import';
  const name = (tpl as any)?.business_name || (tpl as any)?.template_name || 'your business';

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      {!claimable ? (
        <>
          <h1 className="text-3xl font-bold">This link is no longer available</h1>
          <p className="mt-3 text-zinc-400">
            It may have expired, or this site has already been claimed. Ask us for a fresh link.
          </p>
          <Link href="/" className="mt-6 text-sky-400 underline underline-offset-4">Go home</Link>
        </>
      ) : (
        <>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            We already built it
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
            {name}’s new website is ready.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
            We assembled it from your public listing — your menu, hours, location, and online ordering.
            Free hosting; we only earn a small fee when you sell. Preview it, then claim it.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={`/preview/${encodeURIComponent((tpl as any).slug ?? params.id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-2xl border border-zinc-700 px-6 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
            >
              Preview your site ↗
            </a>
            <a
              href={`/api/claim-draft/${params.id}?token=${encodeURIComponent(token)}`}
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-6 py-3 text-base font-semibold text-emerald-950 transition hover:opacity-90"
            >
              Claim it free →
            </a>
          </div>

          <p className="mt-6 text-sm text-zinc-500">
            Claiming creates your account and makes this site yours to edit and publish.
          </p>
        </>
      )}
    </main>
  );
}
