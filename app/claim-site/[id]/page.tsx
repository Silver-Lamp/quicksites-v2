// app/claim-site/[id]/page.tsx
//
// Public claim landing for a CedarSites outreach draft. The business opens the link
// we sent → previews the site we built from their listing → "Claim it free" arms the
// claim cookie and sends them to sign up (ownership transfers post-login). Renders
// only for a valid token that binds this id AND a still-claimable draft.
import Link from 'next/link';
import { verifySiteClaimToken } from '@/lib/auth/siteClaimToken';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { CLAIM_VERIFICATION_ENABLED } from '@/lib/flags/claimVerification';
import ClaimSiteHero from '@/components/sites/claim-site-hero';
import { getGeoCampaignByTemplateId } from '@/lib/outreach/geoCampaigns';
import { resolveCampaignBrand } from '@/lib/outreach/campaignBrand';

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
  const slug = (tpl as any)?.slug ?? params.id;
  const previewHref = `/preview/${encodeURIComponent(slug)}`;

  // With verification on, "Claim it free" first proves control of the business (OTP to
  // the listing phone); otherwise it arms the claim cookie directly (legacy).
  const claimHref = CLAIM_VERIFICATION_ENABLED
    ? `/claim-site/${params.id}/verify?token=${encodeURIComponent(token)}`
    : `/api/claim-draft/${params.id}?token=${encodeURIComponent(token)}`;

  if (!claimable) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-3xl font-bold">This link is no longer available</h1>
        <p className="mt-3 text-zinc-400">
          It may have expired, or this site has already been claimed. Ask us for a fresh link.
        </p>
        <Link href="/" className="mt-6 text-sky-400 underline underline-offset-4">Go home</Link>
      </main>
    );
  }

  // Brand the claim page to the campaign's owning org (CedarSites) instead of QuickSites.
  const campaign = await getGeoCampaignByTemplateId(params.id);
  const brand = await resolveCampaignBrand(campaign?.org_id ?? null);

  return (
    <ClaimSiteHero
      name={name}
      previewHref={previewHref}
      claimHref={claimHref}
      urlLabel={(tpl as any)?.slug ? `${slug}.delivered.menu` : 'your new site'}
      brandName={brand.orgId ? brand.name : null}
      brandLogoUrl={brand.logoUrl}
    />
  );
}
