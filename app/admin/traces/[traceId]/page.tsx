import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function TracePage({ params }: { params: { traceId: string } }) {
  const supabase = createServerComponentClient<Database>({ cookies });
  const { data, error } = await supabase
    .from('client_errors')
    .select('*')
    .eq('trace_id', params.traceId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[tracePage] Supabase error', error.message);
    return notFound();
  }

  if (!data || data.length === 0) {
    return <div className="p-6 text-zinc-400">No events found for this trace.</div>;
  }

  return (
    <TraceInspector traceId={params.traceId} entries={data} />
  );
}
