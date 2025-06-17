import { ImageResponse } from '@vercel/og';
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Dynamic color palettes
const THEMES = {
  dark: {
    background: '#0f172a',
    foreground: 'white',
    cardBg: '#1e293b',
    secondary: '#94a3b8',
  },
  light: {
    background: '#f1f5f9',
    foreground: '#0f172a',
    cardBg: '#e2e8f0',
    secondary: '#475569',
  },
};

const BRANDS = {
  green: '#22c55e',
  blue: '#3b82f6',
  red: '#ef4444',
};

const Logo = ({ brandColor }: { brandColor: string }) => (
  <div
    style={{
      width: 48,
      height: 48,
      borderRadius: '50%',
      backgroundColor: brandColor,
      color: 'white',
      fontWeight: 'bold',
      fontSize: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans-serif',
    }}
  >
    GR
  </div>
);

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const snapshotId = searchParams.get('snapshotId');
  const themeParam = searchParams.get('theme') || 'dark';
  const brandParam = searchParams.get('brand') || 'green';

  const theme = THEMES[themeParam as keyof typeof THEMES] || THEMES.dark;
  const brandColor = BRANDS[brandParam as keyof typeof BRANDS] || BRANDS.green;

  let snapshotTitle = 'Snapshot Not Found';
  let heroText = 'No preview available.';

  if (snapshotId) {
    const { data, error } = await supabase
      .from('snapshots')
      .select('template_name, data')
      .eq('id', snapshotId)
      .single();

    if (data && !error) {
      snapshotTitle = data.template_name || snapshotTitle;
      const heroBlock = data.data?.pages?.[0]?.content_blocks?.find(
        (b: any) => b.type === 'hero'
      );
      if (heroBlock?.content) {
        heroText = heroBlock.content;
      }
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: theme.background,
          color: theme.foreground,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '40px',
          fontFamily: 'Inter, sans-serif',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        {/* Logo */}
        <div
          style={{ display: 'flex', position: 'absolute', top: 40, left: 40 }}
        >
          <Logo brandColor={brandColor} />
        </div>

        {/* Preview Card */}
        <div
          style={{
            flexGrow: 1,
            background: theme.cardBg,
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 48, fontWeight: 'bold' }}>{heroText}</div>
            <div
              style={{ fontSize: 20, color: theme.secondary, marginTop: 10 }}
            >
              {snapshotId ? snapshotTitle : 'Missing snapshot ID'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '30px',
            fontSize: 24,
            color: theme.secondary,
            borderTop: `1px solid ${theme.secondary}`,
            paddingTop: 20,
          }}
        >
          snapshot.quicksites.ai
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
