// app/admin/templates/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getFromDate } from '@/lib/getFromDate';
import TemplatesIndexTable from '@/components/admin/templates/templates-index-table';
import type { Database } from '@/types/supabase';

export default async function TemplatesIndexPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const supabase = createServerComponentClient<Database>({ cookies });
  const query = supabase.from('templates').select('*').order('updated_at', { ascending: false });

  const fromDate = getFromDate(searchParams.date || '');

  const finalQuery = fromDate
    ? query.gte('updated_at', fromDate.toISOString())
    : query;

  const { data: templates, error } = await finalQuery;

  if (error) {
    console.error('Error loading templates:', error.message);
  }

  return (
    <TemplatesIndexTable
      templates={templates || []}
      selectedFilter={searchParams.date || ''}
    />
  );
}
