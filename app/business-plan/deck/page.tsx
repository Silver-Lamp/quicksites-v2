// app/business-plan/deck/page.tsx
// Presentation view of /business-plan. Same data — the deck reads VERTICALS and the live
// evidence rather than carrying its own copy, so what is said in the room and what the
// database holds cannot diverge.
//
// Public for the same reason the plan is: a deck that can only be presented, never sent,
// gets retyped into an email by someone working from memory. It carries no operator panel;
// every slide is content a reader is meant to see.
import type { Metadata } from 'next';
import { VERTICALS } from '@/lib/business/verticals';
import { loadPlanEvidence } from '@/lib/business/planEvidence';
import DeckClient from '@/components/business-plan/deck-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'QuickSites — business plan deck',
  robots: { index: false, follow: false }, // unlisted: public URL, invisible to search
};

export default async function BusinessPlanDeckPage() {
  const evidence = await loadPlanEvidence();
  return <DeckClient verticals={VERTICALS} evidence={evidence} />;
}
