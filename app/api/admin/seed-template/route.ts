import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { id, name, description, template_id, preview, data } = await req.json();

  const { error } = await supabase.from('starter_templates').upsert({
    id,
    name,
    description,
    template_id,
    preview,
    data: JSON.parse(data),
  });

  if (error) {
    return json({ error: error.message });
  }

  return json({ success: true });
}
