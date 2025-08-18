// lib/favicon/downloadFaviconBundle.ts
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export async function downloadFaviconZip(sources: Record<string, Blob>) {
  const zip = new JSZip();

  for (const size in sources) {
    zip.file(`favicon-${size}x${size}.png`, sources[size]);
  }

  zip.file('manifest.json', JSON.stringify({
    icons: Object.keys(sources).map(size => ({
      src: `favicon-${size}x${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png',
    })),
    name: 'QuickSite',
    short_name: 'QS',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#111111',
  }, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, 'favicons.zip');
}
