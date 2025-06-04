import { renderOgImage } from '../../../lib/og/renderOgImage';
import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const snapshotId = searchParams.get('snapshotId');
  const theme = searchParams.get('theme') || 'dark';
  const brand = searchParams.get('brand') || 'green';

  let title = 'Snapshot Not Found';
  let content = 'No preview available.';

  if (snapshotId) {
    const { data, error } = await supabase
      .from('snapshots')
      .select('template_name, data')
      .eq('id', snapshotId)
      .single();

    if (data && !error) {
      title = data.template_name || title;
      const hero = data.data?.pages?.[0]?.content_blocks?.find((b: any) => b.type === 'hero');
      if (hero?.content) content = hero.content;
    }
  }

  return renderOgImage({ title, content, theme, brand });
}
