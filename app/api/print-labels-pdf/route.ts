// app/api/print-labels-pdf/route.ts

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { NextRequest } from 'next/server';
import { Readable } from 'stream';

export const runtime = 'nodejs'; // 👈 important: edge runtimes can't use fs or playwright

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { handle } = await req.json();

  if (!handle || typeof handle !== 'string') {
    return new Response('Missing or invalid handle', { status: 400 });
  }

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('user_metadata->>handle', handle)
    .single();

  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  const { data: blocks } = await supabase
    .from('blocks')
    .select('*')
    .eq('owner_id', user.id);

  const html = `
    <html>
      <head>
        <style>
          body { font-family: sans-serif; font-size: 12px; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .block { padding: 12px; border: 1px solid #ccc; border-radius: 4px; text-align: center; }
          img { width: 90px; height: 90px; }
        </style>
      </head>
      <body>
        <h1>Block QR Labels: @${handle}</h1>
        <div class="grid">
          ${blocks
            ?.map(
              (b) => `
            <div class="block">
              <div style="font-size: 18px">${b.emoji} ${b.title}</div>
              <div style="margin: 6px 0;">${b.message}</div>
              <img src="https://quicksites.ai/api/block-qr?handle=${handle}&blockId=${b.id}" />
              <div style="font-size: 10px;">/world/${handle}#block-${b.id}</div>
            </div>
          `
            )
            .join('')}
        </div>
      </body>
    </html>
  `;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '10mm', right: '10mm' },
  });

  await browser.close();

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${handle}-qr-labels.pdf"`,
    },
  });
}
