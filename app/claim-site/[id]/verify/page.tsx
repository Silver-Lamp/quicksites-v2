// app/claim-site/[id]/verify/page.tsx
//
// Claim verification gate: before an outreach draft transfers, the claimer proves they
// control the business by entering a code we text to the phone on its public listing.
// Token-gated to a still-claimable listing_import draft. See docs/CLAIM_VERIFICATION_PLAN.md.
import Link from 'next/link';
import { verifySiteClaimToken } from '@/lib/auth/siteClaimToken';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { maskPhone } from '@/lib/auth/claimVerify';
import { resolveListingPhone } from '@/lib/claim/resolveListingPhone';
import ClaimVerifyForm from '@/components/claim/claim-verify-form';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function ClaimVerifyPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = typeof sp?.token === 'string' ? sp.token : '';
  const payload = verifySiteClaimToken(token);
  const tokenOk = !!payload && payload.templateId === params.id;

  const { data: tpl } = tokenOk
    ? await supabaseAdmin
        .from('templates')
        .select('id, slug, business_name, template_name, claim_source, data')
        .eq('id', params.id)
        .maybeSingle()
    : { data: null };

  const claimable = tokenOk && tpl && (tpl as any).claim_source === 'listing_import';
  const name = (tpl as any)?.business_name || (tpl as any)?.template_name || 'your business';
  const phone = claimable ? resolveListingPhone(tpl as any) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      {!claimable ? (
        <>
          <h1 className="text-3xl font-bold">This link is no longer available</h1>
          <p className="mt-3 text-zinc-400">It may have expired, or this site has already been claimed.</p>
          <Link href="/" className="mt-6 text-sky-400 underline underline-offset-4">Go home</Link>
        </>
      ) : !phone ? (
        <>
          <h1 className="text-2xl font-bold">Let’s verify it’s you</h1>
          <p className="mt-3 text-zinc-400">
            We couldn’t find a phone number on {name}’s listing to text a code to. Reply to the
            message we sent you, or contact us and we’ll verify you by phone.
          </p>
          <a href={`/preview/${encodeURIComponent((tpl as any).slug ?? params.id)}`} className="mt-6 text-sky-400 underline underline-offset-4">
            Preview your site
          </a>
        </>
      ) : (
        <>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            One quick check
          </span>
          <h1 className="mt-6 text-3xl font-bold tracking-tight">Verify you run {name}</h1>
          <p className="mt-3 text-zinc-400">
            We’ll text a 6-digit code to the number on your public listing —{' '}
            <span className="font-medium text-zinc-200">{maskPhone(phone)}</span>. Enter it to claim
            your site.
          </p>
          <ClaimVerifyForm id={params.id} token={token} masked={maskPhone(phone)} />
          <p className="mt-6 text-xs text-zinc-500">
            Not your number?{' '}
            <a href={`/preview/${encodeURIComponent((tpl as any).slug ?? params.id)}`} className="underline underline-offset-2">
              Preview the site
            </a>{' '}
            and reply to our message — we’ll verify you another way.
          </p>
        </>
      )}
    </main>
  );
}
