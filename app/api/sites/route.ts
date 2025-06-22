export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // consider anon if safe
);

export async function GET() {
  const { data, error } = await supabase.from('public_sites').select('*');

  if (error) {
    return json({ error: error.message }, { status: 500 });
  }

  return json(data);
}
