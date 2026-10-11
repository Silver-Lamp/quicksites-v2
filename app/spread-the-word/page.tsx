// app/spread-the-word/page.tsx
//
// The public, indexed referral page (owner, 2026-10-11). /for-sales is the brief for people
// recruited to SELL — calls, the domain rental, territories — and reads like a job. This is the
// version to share on social: the same two sentences, the restaurants section with the live
// table and the sweep, the store and free-site boxes, how you are paid (derived from the member
// plan, never typed), and one button: sign in. No domain rental, no call sheet, no badge that
// says "commission sales". Copy lives in lib/sales/forSalesPitches.ts beside the brief's.
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';
import SiteFooter from '@/components/site/site-footer';
import RestaurantsSection from '@/components/for-rep/restaurants-section';
import VerticalFlow from '@/components/for-rep/vertical-flow';
import { Pitch, SubPitch } from '@/components/for-rep/pitch';
import { FOR_SALES_PITCHES, SPREAD_COPY } from '@/lib/sales/forSalesPitches';
import { MEMBER_REFERRAL_PLAN } from '@/lib/rep/memberCode';
import { signUpHref } from '@/lib/auth/authLinks';
import SpreadStartButton from './start-button';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.quicksites.ai'),
  title: 'Spread the word. Earn for life. — QuickSites',
  description: SPREAD_COPY.intro,
  openGraph: { title: SPREAD_COPY.title, description: SPREAD_COPY.intro, type: 'website', url: 'https://www.quicksites.ai/spread-the-word' },
  twitter: { card: 'summary_large_image' },
  alternates: { canonical: 'https://www.quicksites.ai/spread-the-word' },
};

export const dynamic = 'force-dynamic';

export default async function SpreadTheWordPage() {
  const howPaid = SPREAD_COPY.howPaid(MEMBER_REFERRAL_PLAN.ratePct, MEMBER_REFERRAL_PLAN.durationMonths === 0);
  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        <section className="relative mx-auto max-w-3xl px-6 pb-4 pt-16">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-20 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{SPREAD_COPY.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-300">{SPREAD_COPY.intro}</p>
          <div className="mt-5">
            <SpreadStartButton signUpHref={signUpHref('/spread-the-word')} />
          </div>
        </section>

        <Pitch summary={FOR_SALES_PITCHES.lunch} art="lunch">
          <RestaurantsSection code={null} repName="a friend who sent you" token={null} prominent />
        </Pitch>

        <Pitch summary={FOR_SALES_PITCHES.business} art="business">
          <section className="mx-auto max-w-3xl px-6 pb-2 pt-6">
            <p className="text-sm leading-relaxed text-zinc-400">Two things a small business owner might need. Open the one that fits.</p>
          </section>
          <SubPitch k="store">
            <section className="mx-auto max-w-3xl px-6 pb-4">
              <VerticalFlow flow="store" />
            </section>
          </SubPitch>
          <SubPitch k="website">
            <section className="mx-auto max-w-3xl px-6 pb-4">
              <VerticalFlow flow="website" />
            </section>
          </SubPitch>
        </Pitch>

        <section className="mx-auto max-w-3xl px-6 pb-24 pt-10">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6">
            <h2 className="text-lg font-semibold text-white">{SPREAD_COPY.howPaidTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{howPaid}</p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{SPREAD_COPY.start}</p>
          </div>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
