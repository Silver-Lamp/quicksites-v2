import { createClient } from '@supabase/supabase-js';
import { toBuffer } from 'html-pdf-node';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const { handle } = req.query;
  if (!handle) return res.status(400).send('Missing handle');

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('user_metadata->>handle', handle)
    .single();

  if (!user) return res.status(404).json({ error: 'User not found' });

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
          ${blocks.map(b => `
            <div class="block">
              <div style="font-size: 18px">${b.emoji} ${b.title}</div>
              <div style="margin: 6px 0;">${b.message}</div>
              <img src="https://quicksites.ai/api/block-qr?handle=${handle}&blockId=${b.id}" />
              <div style="font-size: 10px;">/world/${handle}#block-${b.id}</div>
            </div>
          `).join('')}
        </div>
      </body>
    </html>
  `;

  const buffer = await toBuffer({ content: html });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${handle}-qr-labels.pdf"`);
  res.end(buffer);
}
