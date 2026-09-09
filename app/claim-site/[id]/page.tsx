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
import { getSenderProfile } from '@/lib/outreach/senderProfile';
import { hasMenuBlock, RESTAURANT_FEE_PERCENT } from '@/lib/commerce/pricingPolicy';
import { getDemandCount } from '@/lib/menu/demand';
import { publicSiteUrl } from '@/lib/sites/publicUrl';
import { getSiteCompetition } from '@/lib/outreach/competitionForSite';

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
        .select('id, slug, business_name, template_name, claim_source, data, custom_domain')
        .eq('id', params.id)
        .maybeSingle()
    : { data: null };

  const claimable = tokenOk && tpl && (tpl as any).claim_source === 'listing_import';
  const name = (tpl as any)?.business_name || (tpl as any)?.template_name || 'your business';
  const slug = (tpl as any)?.slug ?? params.id;
  // ⚠️ The preview is the site's REAL public address — the same one printed on the claim card —
  // rendered by the public route with no editor around it. Two things went wrong before this:
  // /preview/<slug> resolved the site from the request host (404 inside the pitch), and
  // /preview?template_id= wraps the site in the editor provider, so a prospect saw "+ Add block"
  // and Edit/move/delete toolbars over their own business's page.
  const siteUrl = publicSiteUrl({ custom_domain: (tpl as any)?.custom_domain, slug: (tpl as any)?.slug }) ?? `/sites/${encodeURIComponent(slug)}`;
  const previewHref = siteUrl;

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

  // "Questions? email us" — a branded campaign uses the org's support email; the default brand
  // uses the operator's sender profile, so a prospect can always reach a human.
  const senderProfile = brand.orgId ? null : await getSenderProfile();
  const contactEmail = brand.orgId ? brand.supportEmail : senderProfile?.email ?? null;
  // A branded campaign speaks as the org, so the operator's personal calendar stays off it.
  const bookingUrl = senderProfile?.bookingUrl ?? null;

  // Menu-ordering sites launch on restaurant terms — state the concrete take-rate on the
  // pitch ("keep 92%, no monthly"). Non-ordering drafts keep the generic copy.
  const isMenuSite = hasMenuBlock((tpl as any)?.data);
  const feePercent = isMenuSite ? Math.round(RESTAURANT_FEE_PERCENT * 100) : null;
  // Real demand is the strongest possible reason to claim NOW — surface the count (never
  // the PII) on the pitch. Only for ordering sites, where "tried to order" makes sense.
  const demandCount = isMenuSite ? await getDemandCount(params.id) : 0;
  // "It goes to one business — claim it before a competitor does" is only true when there is a
  // real race: a first-to-claim campaign with two or more businesses still in it. The same rule the
  // live site's competition banner uses; a per-business draft gets the plain, honest line instead.
  const competition = await getSiteCompetition(params.id);

  return (
    <ClaimSiteHero
      name={name}
      previewHref={previewHref}
      claimHref={claimHref}
      urlLabel={siteUrl.replace(/^https?:\/\//, '')}
      competition={!!competition}
      isFood={isMenuSite}
      brandName={brand.orgId ? brand.name : null}
      brandLogoUrl={brand.logoUrl}
      contactEmail={contactEmail}
      bookingUrl={bookingUrl}
      feePercent={feePercent}
      demandCount={demandCount}
    />
  );
}
