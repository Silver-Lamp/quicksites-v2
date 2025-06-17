import { supabase } from './db.js';

export async function logDomainGeneration({ domain, city, state, template }) {
  const { data, error } = await supabase
    .from('domains')
    .insert([
      { domain, city, state, template_id: template, is_claimed: false },
    ]);
  if (error) throw error;
  return data;
}
