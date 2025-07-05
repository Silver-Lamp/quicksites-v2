// app/api/industries/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export async function GET() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from('industries')
    .select('name')
    .order('name', { ascending: true });

  if (error) {
    console.error('Failed to fetch industries:', error);
    return NextResponse.json({ error: 'Failed to fetch industries' }, { status: 500 });
  }

  const industryNames = data.map((row) => row.name).filter(Boolean);

  return NextResponse.json(industryNames, {
    status: 200,
    headers: {
      'Cache-Control': 's-maxage=3600, stale-while-revalidate',
    },
  });
}
