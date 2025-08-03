import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const host = new URL(req.url).host;

  const content = [
    'User-agent: *',
    'Allow: /',
    `Sitemap: https://${host}/sitemap.xml`,
  ].join('\n');

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}
