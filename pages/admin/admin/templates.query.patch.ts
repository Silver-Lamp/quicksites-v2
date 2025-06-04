// Replace your Supabase templates query with:

const { data, error } = await supabase
  .from('templates')
  .select('*, branding_profiles ( name, theme, brand, logo_url )')
  .order('updated_at', { ascending: false });
