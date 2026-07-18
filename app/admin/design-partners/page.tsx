// app/admin/design-partners/page.tsx
//
// Superadmin design-partner CRM — the people the owner is recruiting to use/pilot/spread QuickSites
// (+ sibling products), each with a /for-<name> page. Contacts + context + pipeline status/next-step.
// Admin-gated shell; the client fetches + edits. HiveJournal builds the sibling page (crosstalk).

import { getAdminUser } from '@/lib/auth/getAdminUser';
import DesignPartnersClient from '@/components/admin/design-partners-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Design Partners' };

export default async function DesignPartnersPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;
  return <DesignPartnersClient />;
}
