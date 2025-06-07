import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const { id, name, description, template_id, preview, data } = JSON.parse(req.body);

  const { error } = await supabase.from('starter_templates').upsert({
    id, name, description, template_id, preview, data: JSON.parse(data)
  });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
}
