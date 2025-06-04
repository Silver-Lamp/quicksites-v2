// Inside your /api/share.ts

const { template_name, data, editor_email, branding_profile_id } = req.body;

const { data: insertResult, error } = await supabase
  .from('snapshots')
  .insert([
    {
      template_name,
      data,
      editor_email: editor_email || 'anonymous',
      shared_at: new Date().toISOString(),
      branding_profile_id
    }
  ])
  .select()
  .single();
