// app/build/page.tsx
//
// Focused entry to the no-signup guest builder. Renders the quick-start form
// directly. If the guest-build feature flag is off, falls back to /login so we
// never drop someone into a flow whose editor would bounce them (the editor's
// anon access is also flag-gated).
import { signInHref } from '@/lib/auth/authLinks';
import { redirect } from 'next/navigation';
import { guestBuildEnabled } from '@/lib/flags/guestBuild';
import SiteHeader from '@/components/site/site-header';
import GuestStart from '@/components/home/guest-start';
import { PathChooserCompact } from '@/components/pricing/path-chooser';

export const dynamic = 'force-dynamic';

export default async function BuildPage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string }>;
}) {
  const sp = await searchParams;
  const initialIndustry = typeof sp.industry === 'string' ? sp.industry : undefined;
  if (!guestBuildEnabled()) redirect(signInHref());

  return (
    <>
      <SiteHeader sticky />
      <main className="relative flex min-h-screen flex-col items-center bg-zinc-950 px-6 pt-20 pb-16 text-center text-white">
        <h1 className="max-w-2xl text-3xl md:text-5xl font-extrabold tracking-tight">
          Build your site — free
        </h1>
        {/*
          "Your work saves as you go" is stated OUT LOUD on purpose. A guest draft is a real
          Supabase anonymous session that survives closing the tab and upgrades IN PLACE on
          signup (same uid → the draft is already theirs). Nothing here is disposable — but a
          visitor who isn't told that assumes the opposite, treats the builder as a toy, and
          leaves rather than risk losing the work. The true sentence is also the persuasive
          one, so there's no reason to make them guess. The editor says the same thing in
          GuestPublishBanner; this is the same promise at the door.
        */}
        <p className="mt-4 max-w-xl text-zinc-400">
          Describe your business and watch a real site appear. Edit it live — your work
          saves as you go, and the site stays yours when you sign up to publish. No credit card.
        </p>
        <GuestStart initialIndustry={initialIndustry} />
        {/* The other four doors from /pricing, for the visitor who clicked "Build my own site"
            and would rather not self-serve after all. Same list as the pricing page. */}
        <div className="mt-14">
          <PathChooserCompact exclude="merchant" lead="Not sure self-serve is for you? The other ways to get a site:" />
        </div>
      </main>
    </>
  );
}
