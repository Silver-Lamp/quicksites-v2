// app/yard-sale/new/page.tsx
//
// The front door for yardsalesites.com. Make a page for your sale in a minute — no sticker, no
// account, no fee.
//
// ⚠️ WHY THIS IS THE PRODUCT AND THE DIRECTORY IS NOT. The review of the September postcard plan
// (PorchHearth, crosstalk 2026-08-17) dissolved the supply-vs-demand question this line had been
// stuck on: both sides of that fork assume we are building a marketplace, and the only sentence
// about this product that is TRUE today needs no marketplace at all —
//
//     "a page for your sale, with your photos and your address, that you can text to anyone"
//
// That is worth exactly the same to the first seller as to the thousandth. No cold start, no
// footfall claim, nothing to support that is not already so. The directory accretes as a
// by-product, and only then does "more buyers will find you" become sayable — because it will
// have become true.
//
// So the copy here promises a shareable page and printable signs, and does NOT promise shoppers.
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';
import SiteFooter from '@/components/site/site-footer';
import { ActivateForm } from '@/app/s/[code]/sticker-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  // Targets seller intent ("free yard sale listing", "make a yard sale page"), which we can serve
  // honestly TODAY. The buyer query ("yard sales near me", 10k–100k/mo) has the volume but needs
  // supply we do not have — ranking for it now would put a searcher in front of an empty week.
  title: 'Make a free page for your yard sale — share it in one text | YardSaleSites',
  description:
    'A free page for your garage or yard sale: what you are selling, when, and where. Share the link in one text, print a sign with a QR code, and take card payments if you want to. No account needed.',
  alternates: { canonical: '/yard-sale/new' },
};

export default function NewYardSalePage() {
  return (
    <>
      <SiteHeader sticky />
      <main className="mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Make a page for your sale</h1>
        <p className="mt-3 text-muted-foreground">
          Fill this in once and you get a link you can text to anyone, plus a printable sign with a
          QR code for the corner. It takes about a minute and costs nothing.
        </p>

        {/* ⚠️ Say what this does NOT do. The directory is real but thin, and a seller who reads
            "get more shoppers" and gets none has been mis-sold — in a hyperlocal market that
            seller is also the only distribution there is, and they tell their neighbours. */}
        <p className="mt-4 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">What this is:</strong> a page for your sale that
          works on its own — you share it. We also list it on this site, but it is a new listing
          and we are not going to promise you a crowd we cannot yet send.
        </p>

        {/* One form, two doors — the same component the printed-sticker flow uses. Passing no
            code is what makes it self-serve. See its header for why it was not copied. */}
        <ActivateForm />
      </main>
      <SiteFooter />
    </>
  );
}
