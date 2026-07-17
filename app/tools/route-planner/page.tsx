import RoutePlanner from './route-planner-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Route Planner', robots: { index: false } };

// Tasker route planner — plan an efficient store walk for a day of AisleAsk cataloging
// stops. Deep-linkable: ?stops=addr1|addr2|... (AisleAsk can hand a tasker their assigned
// stores) and optional ?start=addr. See crosstalk ideas.md §19.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const raw = typeof sp?.stops === 'string' ? sp.stops : Array.isArray(sp?.stops) ? sp.stops.join('|') : '';
  const start = typeof sp?.start === 'string' ? sp.start : '';
  const initialStops = raw.split('|').map((x) => x.trim()).filter(Boolean);
  return <RoutePlanner initialStops={initialStops} initialStart={start} />;
}
