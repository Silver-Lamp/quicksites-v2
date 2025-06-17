import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getSnapshotWithBranding(snapshotId: string) {
  const { data, error } = await supabase
    .from('snapshots')
    .select(
      `
      id,
      template_name,
      data,
      branding_profiles (
        theme,
        brand,
        accent_color,
        logo_url
      )
    `
    )
    .eq('id', snapshotId)
    .single();

  if (error) {
    console.error('Snapshot fetch failed:', error);
    return null;
  }

  return {
    ...data,
    branding: data.branding_profiles || {},
  };
}
