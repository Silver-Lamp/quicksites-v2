/* app/api/list-og-zips/route.ts */

import { supabase } from '@/admin/lib/supabaseClient';
import { json } from '@/lib/api/json';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data, error } = await supabase.storage.from('campaign-ogs').list('', {
    limit: 100,
    sortBy: { column: 'created_at', order: 'desc' },
  });

  if (error) {
    return json({ error: error.message }, { status: 500 });
  }

  const files = (data || []).map((file) => {
    const publicUrl = supabase.storage
      .from('campaign-ogs')
      .getPublicUrl(file.name).data.publicUrl;
    const size =
      typeof file.metadata?.size === 'number'
        ? file.metadata.size
        : file.metadata?.size_bytes || 0;
    return {
      name: file.name,
      url: publicUrl,
      size,
    };
  });

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return json({
    files,
    totalBytes: totalSize,
    totalMB: (totalSize / 1024 / 1024).toFixed(1),
  });
}
