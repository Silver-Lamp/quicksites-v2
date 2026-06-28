// app/build/page.tsx
//
// Focused entry to the no-signup guest builder. Renders the quick-start form
// directly. If the guest-build feature flag is off, falls back to /login so we
// never drop someone into a flow whose editor would bounce them (the editor's
// anon access is also flag-gated).
import { redirect } from 'next/navigation';
import { guestBuildEnabled } from '@/lib/flags/guestBuild';
import SiteHeader from '@/components/site/site-header';
import GuestStart from '@/components/home/guest-start';

export const dynamic = 'force-dynamic';

export default function BuildPage() {
  if (!guestBuildEnabled()) redirect('/login');

  return (
    <>
      <SiteHeader sticky />
      <main className="relative flex min-h-screen flex-col items-center bg-zinc-950 px-6 pt-20 pb-16 text-center text-white">
        <h1 className="max-w-2xl text-3xl md:text-5xl font-extrabold tracking-tight">
          Build your site — free
        </h1>
        <p className="mt-4 max-w-xl text-zinc-400">
          Describe your business and watch a real site appear. Edit it live —
          sign up only when you’re ready to publish. No credit card.
        </p>
        <GuestStart />
      </main>
    </>
  );
}
