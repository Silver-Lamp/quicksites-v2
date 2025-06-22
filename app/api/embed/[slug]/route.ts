export const runtime = 'nodejs';

import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = url.pathname.split('/').pop();

  if (!slug) {
    return new Response('Missing slug', { status: 400 });
  }

  const domain = 'https://quicksites.ai';
  const html = `
    <div style="font-family: sans-serif; text-align: center; padding: 1em;">
      <a href="${domain}/support/${slug}" target="_blank">
        <img src="${domain}/api/badge/${slug}" alt="Weekly Top Campaign Badge" style="width: 300px; border-radius: 8px;" />
      </a>
      <p style="font-size: 14px; color: #888;">Proudly featured on the Odessa Weekly Leaderboard</p>
    </div>
  `;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
    },
  });
}
