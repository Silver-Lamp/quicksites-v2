// app/ppl/funded/page.tsx
//
// Where Stripe Checkout returns a business after funding (or abandoning) a prepaid lead balance.
// Public and deliberately content-free: it names no balance, no business, no number — the
// account id in the query is Stripe's return address, not an authenticated session. The
// statement itself goes to the contact email.

import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import SiteFooter from '@/components/site/site-footer';

export const metadata = { title: 'Lead balance', robots: { index: false, follow: false } };

export default async function PplFundedPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const { canceled } = await searchParams;
  return (
    <>
      <SiteHeader sticky />
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-xl px-6 py-20 text-center">
          {canceled ? (
            <>
              <h1 className="text-2xl font-bold">No payment was made</h1>
              <p className="mt-3 text-muted-foreground">
                Your prepaid lead balance was not changed. Use the link you were sent whenever you
                are ready.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Thanks — your lead balance is being funded</h1>
              <p className="mt-3 text-muted-foreground">
                Once the payment settles, calls to your tracking number connect straight to you. A
                receipt and your balance go to the email you gave at checkout. Only calls that reach
                you and last long enough to be a conversation are deducted.
              </p>
            </>
          )}
          <Link
            href="/"
            className="mt-8 inline-flex rounded-lg border border-border px-5 py-2.5 text-sm hover:bg-muted"
          >
            Back to QuickSites
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
