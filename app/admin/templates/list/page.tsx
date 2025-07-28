// app/admin/templates/list/page.tsx
'use server';

import { getFromDate } from '@/lib/getFromDate';
import TemplatesIndexTable from '@/components/admin/templates/templates-index-table';
import { getSupabase } from '@/lib/supabase/server';

export default async function TemplatesIndexPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  // const supabase = createServerComponentClient<Database>({ cookies: () => undefined });
  const supabase = await getSupabase();

  const resolvedParams = await searchParams;
  const dateParam = resolvedParams?.date || '';
  const fromDate = getFromDate(dateParam);

  let query = supabase
    .from('templates')
    .select('*')
    .order('updated_at', { ascending: false })
    .eq('archived', false);

  if (fromDate) {
    query = query.gte('updated_at', fromDate.toISOString());
  }

  const { data: templates, error } = await query;

  if (error) {
    console.error('Error loading templates:', error.message);
  }

  return (
    <TemplatesIndexTable
      templates={templates || []}
      selectedFilter={dateParam}
    />
  );
}
