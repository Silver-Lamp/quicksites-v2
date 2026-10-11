// app/admin/post-build/page.tsx
//
// "Build from a post": someone announced a sale in a Facebook group — a product with a price,
// a time and a place, photos, their own words — and this turns that into a claimable site plus
// the DM to send them. The River Williams recipe (2026-10-10) as a form. Admin-gated; in the
// sidebar under Growth.
import { getAdminUser } from '@/lib/auth/getAdminUser';
import PostBuildClient from '@/components/admin/post-build-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function PostBuildPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 text-white">
      <h1 className="text-2xl font-semibold">Build from a post</h1>
      <p className="mt-1 max-w-3xl text-sm text-neutral-400">
        Someone posted a sale in a group: what, how much, when, where, photos. Type it in here exactly as they
        said it and this builds their site as an unclaimed draft, mints the claim link, and drafts the DM.
        Nothing is generated — only their words go on the page, and the scaffold blocks that would speak for
        them (FAQ, services, a contact form, an order bar) are stripped.
      </p>
      <PostBuildClient />
    </div>
  );
}
