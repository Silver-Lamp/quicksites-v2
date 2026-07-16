// app/bring-your-domain/page.tsx
//
// "Bring your own domain" — for someone already paying for a domain elsewhere
// (usually semi-parked, often with Workspace email on it) who wants it to serve a
// real site here. Flow: check the domain → say what the site should be → get a
// starter draft + the exact two DNS records (no transfer, MX/email untouched).
// Rides the guest-build flow (anonymous draft, sign up to publish), so it gates on
// the same flag as /build.
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

export default function BringYourDomainPage() {
  if (!guestBuildEnabled()) redirect('/login');

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
        <BringYourDomainClient />
      </main>
    </>
  );
}
