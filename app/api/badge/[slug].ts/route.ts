export const runtime = 'nodejs';

import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Extract the slug from the dynamic route
  const match = pathname.match(/\/badge\/([^/]+)/);
  const slug = match?.[1];
  const format = searchParams.get('format');

  if (!slug) {
    return new Response('Missing slug', {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const domain = 'https://quicksites.ai';
  const imageUrl = `${domain}/api/badge/${slug}`;
  const supportUrl = `${domain}/support/${slug}`;

  let body = '';
  let contentType = 'text/plain';

  if (format === 'markdown') {
    body = `[![Weekly Top Campaign Badge](${imageUrl})](${supportUrl})`;
  } else if (format === 'iframe') {
    body = `<iframe src="${imageUrl}" width="600" height="320" style="border:0;"></iframe>`;
    contentType = 'text/html';
  } else {
    body = `
      <div style="font-family: sans-serif; text-align: center; padding: 1em;">
        <a href="${supportUrl}" target="_blank">
          <img src="${imageUrl}" alt="Weekly Top Campaign Badge" style="width: 300px; border-radius: 8px;" />
        </a>
        <p style="font-size: 14px; color: #888;">Proudly featured on the Odessa Weekly Leaderboard</p>
      </div>
    `.trim();
    contentType = 'text/html';
  }

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      ...corsHeaders(),
    },
  });
}

// Optional CORS headers if used in embeds or cross-origin
function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
