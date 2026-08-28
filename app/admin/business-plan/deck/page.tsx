// app/admin/business-plan/deck/page.tsx
// Presentation view of /admin/business-plan. Same data, same admin gate — the deck reads
// VERTICALS and the live evidence rather than carrying its own copy, so what is said in the
// room and what the database holds cannot diverge.
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { VERTICALS, loadPlanEvidence } from '@/lib/business/verticals';
import DeckClient from '@/components/admin/business-plan/deck-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function BusinessPlanDeckPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;

  const evidence = await loadPlanEvidence();
  return <DeckClient verticals={VERTICALS} evidence={evidence} />;
}
