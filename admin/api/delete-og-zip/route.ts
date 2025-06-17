/* app/api/delete-og-zip/route.ts */

import { supabase } from '@/lib/supabaseClient.js';
import { json } from '../../../lib/api/json.js';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const { name } = await await req.json();
  if (!name) return json({ error: 'No file name provided' }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { error } = await supabase.storage.from('campaign-ogs').remove([name]);

  if (error) {
    return json({ error: error.message }, { status: 500 });
  }

  return json({ success: true });
}
