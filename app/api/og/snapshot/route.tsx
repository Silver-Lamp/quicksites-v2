import { renderOgImage } from '@/lib/og/renderOgImage';
import { Theme, Brand } from '@/types/template';

const ALLOWED_THEMES: Theme[] = ['dark', 'light'];
const ALLOWED_BRANDS: Brand[] = ['green', 'blue', 'red', 'purple', 'orange'];

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') || 'QuickSites';
  const content = searchParams.get('content') || '🚀 Build fast. Launch faster.';

  const themeParam = searchParams.get('theme');
  const brandParam = searchParams.get('brand');

  const theme: Theme = ALLOWED_THEMES.includes(themeParam as Theme)
    ? (themeParam as Theme)
    : 'dark';

  const brand: Brand = ALLOWED_BRANDS.includes(brandParam as Brand)
    ? (brandParam as Brand)
    : 'green';

  return renderOgImage({ title, content, theme, brand });
}
