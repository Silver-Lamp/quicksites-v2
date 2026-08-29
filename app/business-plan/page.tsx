// app/business-plan/page.tsx
//
// The business plan as a SHAREABLE surface — a link you can send to a partner, an operator or
// an investor without them needing an account.
//
// It was admin-gated until 2026-08-28, which made it useless for the one job it was built for:
// it could be read in a room but not sent afterwards, so what actually got sent was a summary
// written from memory. The gate moved rather than disappeared — one operator panel is still
// admin-only (see components/business-plan/operator-panel.tsx), and it deliberately holds
// nothing that would make the business look worse than the public half already says it does.
//
// Unlisted: public URL, noindex, linked from nowhere. Everything on it is honest enough to
// survive being forwarded, which is the standard a shareable plan has to meet anyway.
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';
import PlanBody from '@/components/business-plan/plan-body';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getVertical, loadPlanEvidence } from '@/lib/business/verticals';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'QuickSites — business plan',
  description: 'How QuickSites makes money: six lines, one set of rails, and what is unproven.',
  robots: { index: false, follow: false }, // unlisted: public URL, invisible to search
};

export default async function BusinessPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const { v } = await searchParams;
  const [admin, evidence] = await Promise.all([getAdminUser(), loadPlanEvidence()]);

  return (
    <>
      <SiteHeader sticky />
      <div className="min-h-screen bg-zinc-950">
        <PlanBody vertical={getVertical(v)} evidence={evidence} isAdmin={!!admin} />
      </div>
    </>
  );
}
