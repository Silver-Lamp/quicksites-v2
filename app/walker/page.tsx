import WalkerBoard from './walker-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Store-walk gigs', robots: { index: false } };

// The AisleAsk store-walk gig board — a tasker claims open cataloging gigs, then taps one
// "Plan my route" to walk them all efficiently (crosstalk ideas.md §10 + §19). Auth is
// enforced by the /api/walker/gigs routes; the client handles the signed-out state.
export default function Page() {
  return <WalkerBoard />;
}
