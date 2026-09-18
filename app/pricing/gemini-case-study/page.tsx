// app/pricing/gemini-case-study/page.tsx
//
// "A Gemini Case Study" — a shareable deck comparing agency unit economics across QuickSites,
// 10Web and Framer, as Google's Gemini modelled it, with our corrections on the slides where its
// assumptions do not match what we charge.
//
// Public and indexable: the whole point is that an agency can send the link to a partner. Each
// slide is deep-linkable (?slide=<id>), and every slide renders into the DOM so the page reads as
// a document for a crawler and prints as pages.
import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import Slideshow from '@/components/case-studies/slideshow';
import { buildSlides } from '@/lib/caseStudies/geminiAgencyEconomics';

export const dynamic = 'force-dynamic';

const TITLE = 'A Gemini Case Study — agency unit economics';
const DESC =
  'Google’s Gemini compared QuickSites, 10Web and Framer on what an agency actually keeps. We published it with our corrections on the slides where its assumptions differ from our pricing.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC, type: 'article' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
};

export default function GeminiCaseStudyPage() {
  const slides = buildSlides();
  return (
    <>
      <SiteHeader sticky />
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-4xl px-6 pb-20 pt-12">
          <Link href="/pricing" className="text-xs text-muted-foreground hover:text-foreground">
            ← Pricing
          </Link>

          <span className="mt-4 inline-flex rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
            Third-party analysis · published with corrections
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">A Gemini Case Study</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Google’s Gemini modelled what an agency keeps on a maintenance retainer across
            QuickSites, 10Web and Framer. It put us first. We are publishing it anyway with its
            seams showing — including two slides that correct it — because an agency evaluating us
            will check the maths, and should.
          </p>

          {/* Suspense: Slideshow reads useSearchParams for the ?slide deep link, which Next
              requires be wrapped even on a dynamic page. */}
          <React.Suspense fallback={<div className="mt-6 h-64 rounded-2xl border border-border bg-card" />}>
            <Slideshow slides={slides} shareBase="https://www.quicksites.ai/pricing/gemini-case-study" />
          </React.Suspense>

          <div className="mt-8 rounded-xl border border-border bg-card p-5 text-card-foreground">
            <h2 className="text-base font-semibold">Run it on your own numbers</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Every figure above depends on a retainer and a labour rate that are yours, not ours.
              The calculator uses our real plan prices and your inputs.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <Link
                href="/pricing#agency"
                className="rounded-lg border border-sky-400/50 bg-sky-500/15 px-4 py-2 font-medium text-sky-100 hover:bg-sky-500/25"
              >
                Agency pricing →
              </Link>
              <Link href="/compare" className="rounded-lg border border-border px-4 py-2 hover:bg-accent">
                How we compare, with sources
              </Link>
              <Link href="/partners" className="rounded-lg border border-border px-4 py-2 hover:bg-accent">
                The revenue-share route
              </Link>
            </div>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Gemini is Google’s AI, and this analysis was produced by it, not by a QuickSites
            employee or a paying customer. It is not a customer testimonial and we have not
            verified its 10Web or Framer figures — neither vendor appears in our own{' '}
            <Link href="/compare" className="underline underline-offset-4">
              comparison registry
            </Link>
            , where the pricing we do cite carries sources.
          </p>
        </div>
      </main>
    </>
  );
}
