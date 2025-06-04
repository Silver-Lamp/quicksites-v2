/* app/api/compare-slugs/route.ts */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const runtime = 'edge';

function getPermutations(values: string[]): string[] {
  const pairs: string[] = [];
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      pairs.push(`${values[i]}-vs-${values[j]}`);
    }
  }
  return pairs;
}

export async function GET(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data, error } = await supabase
    .from('guest_upgrade_events')
    .select('utm_campaign');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const raw = data.map(row => row.utm_campaign || '(none)');
  const unique = Array.from(new Set(raw)).filter(Boolean);
  const slugs = getPermutations(unique);

  return NextResponse.json({ slugs });
}
