// app/admin/traces/[traceId]/page.tsx  (SERVER)
import { notFound } from 'next/navigation';
import { getSupabaseRSC } from '@/lib/supabase/serverClient';
import { TraceInspector } from '@/components/admin/traces/trace-inspector';

export const dynamic = 'force-dynamic';

export default async function TracePage({ params }: { params: { traceId: string } }) {
  const supabase = await getSupabaseRSC(); // ✅ RSC-safe (no cookie writes)

  const { data, error } = await supabase
    .from('client_errors')
    .select('*')
    .eq('trace_id', params.traceId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[TracePage] Supabase error:', error.message);
    return notFound();
  }

  if (!data || data.length === 0) {
    return <div className="p-6 text-zinc-400">No events found for this trace.</div>;
  }

  return <TraceInspector traceId={params.traceId} entries={data} />;
}
