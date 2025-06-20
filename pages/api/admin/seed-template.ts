import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, name, description, template_id, preview, data } = JSON.parse(req.body);

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
