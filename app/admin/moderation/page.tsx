// app/admin/moderation/page.tsx
//
// The platform moderation cockpit — every comment needing attention across all sites
// in one admin view (pending approvals + reported-but-still-live). Per-site owners
// moderate inline in the block editor; this is the operator's cross-site sweep.
import { getAdminUser } from '@/lib/auth/getAdminUser';
import ModerationClient from '@/components/admin/moderation-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function ModerationPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <ModerationClient />
    </div>
  );
}
