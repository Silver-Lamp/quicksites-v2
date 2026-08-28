// app/bring-your-domain/page.tsx
//
// "Bring your own domain" — for someone already paying for a domain elsewhere
// (usually semi-parked, often with Workspace email on it) who wants it to serve a
// real site here. Flow: check the domain → say what the site should be → get a
// starter draft + the exact two DNS records (no transfer, MX/email untouched).
// Rides the guest-build flow (anonymous draft, sign up to publish), so it gates on
// the same flag as /build.
import { signInHref } from '@/lib/auth/authLinks';
import { redirect } from 'next/navigation';
import { guestBuildEnabled } from '@/lib/flags/guestBuild';
import SiteHeader from '@/components/site/site-header';
import BringYourDomainClient from '@/components/byo/bring-your-domain-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Bring your domain — QuickSites',
  description:
    'Already paying for a domain? Point it at a real site in two DNS records — no transfer, your email keeps working.',
};

export default async function BringYourDomainPage({
  searchParams,
}: {
  // Next 15: searchParams is async. Entry points (homepage tab, /admin/templates/new
  // card) pass ?domain= so the check runs the moment the page opens; ?ref= carries a
  // public page (Facebook etc.) to build the draft FROM (the parked-domain + FB combo).
  searchParams: Promise<{ domain?: string; ref?: string }>;
}) {
  if (!guestBuildEnabled()) redirect(signInHref());
  const sp = await searchParams;
  const initialDomain = typeof sp?.domain === 'string' ? sp.domain.slice(0, 253) : '';
  const initialRef = typeof sp?.ref === 'string' ? sp.ref.slice(0, 500) : '';

  return (
    <>
      <SiteHeader sticky />
      <main className="relative flex min-h-screen flex-col items-center bg-zinc-950 px-6 pt-20 pb-16 text-center text-white">
        <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight md:text-5xl">
          Already own a domain? Bring it over.
        </h1>
        <p className="mt-4 max-w-xl text-zinc-400">
          Keep your registrar, keep your email, keep paying exactly what you pay now. We'll build the site and show you
          the two DNS records that point your domain at it.
        </p>
        <BringYourDomainClient initialDomain={initialDomain} initialRef={initialRef} />
      </main>
    </>
  );
}
