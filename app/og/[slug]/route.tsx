import { ImageResponse } from 'next/og';
import { getServerSupabase } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const { slug } = params;
  const supabase = await getServerSupabase();

  const { data: site } = await supabase
    .from('templates')
    .select('*')
    .eq('slug', slug)
    .eq('is_site', true)
    .maybeSingle();

  if (!site) {
    return new ImageResponse(<div>Not Found</div>, { width: 1200, height: 630 });
  }

  const title = site.template_name;
  const logo = site.logo_url || 'https://quicksites.ai/default-og.png';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: 'black',
          color: 'white',
          padding: '40px',
          fontSize: 48,
        }}
      >
        <img src={logo} alt="Logo" width={96} height={96} style={{ marginBottom: 20 }} />
        <strong>{title}</strong>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
