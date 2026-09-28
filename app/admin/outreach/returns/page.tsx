// app/admin/outreach/returns/page.tsx
//
// The screen for working through a physical stack of returned postcards.
//
// ⚠️ A separate page rather than a panel on the pipeline, because this is a SESSION: the
// operator sits with an envelope in hand, finds the card, marks it, moves on. It wants search
// and a flat list, not a summary.
import Link from 'next/link';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { loadReturnsList } from '@/lib/outreach/mail/returnsList';
import PostcardReturnsClient from '@/components/admin/postcard-returns-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function PostcardReturnsPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;

  const list = await loadReturnsList();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 text-white">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Returned postcards</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-400">
            Search the name printed on the card, say why it came back, and re-send the ones where
            you found a better address.
          </p>
        </div>
        <Link
          href="/admin/outreach"
          className="text-sm text-sky-400 underline underline-offset-4 hover:text-sky-300"
        >
          ← Outreach pipeline
        </Link>
      </div>

      {/* ⚠️ The reason is load-bearing, so say so before they touch the dropdown rather than
          only in a confirm. Two of the six options end the relationship. */}
      <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-300">
        <p>
          <span className="font-medium text-neutral-100">The reason matters.</span>{' '}
          <span className="text-amber-200">Out of business</span> and{' '}
          <span className="text-amber-200">refused</span> <strong>close the business</strong> — no
          future sweep, site build, postcard or forward-to will consider them again. The others
          only record what happened to this card.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          A returned card also stops counting as “arrived”, so the scan rate is measured against
          the cards that actually landed. Postage already spent still counts as mailed.
        </p>
      </div>

      <div className="mt-6">
        <PostcardReturnsClient list={list} />
      </div>
    </div>
  );
}
