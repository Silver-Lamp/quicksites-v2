// pages/api/admin/seed-template.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  const { data: user, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user?.user) return res.status(401).json({ error: 'Unauthorized' });

  const role = user.user.user_metadata?.role;
  if (!['admin', 'owner'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

  const sample = {
    template_name: 'example-template',
    layout: 'default',
    color_scheme: 'blue',
    commit: '',
    industry: 'demo',
    theme: 'dark',
    brand: 'blue',
    data: {
      pages: [
        {
          id: 'index',
          slug: 'index',
          title: 'Sample Page',
          content_blocks: [
            { type: 'text', value: 'Welcome to the playground!' },
            {
              type: 'image',
              value: {
                url: 'https://placekitten.com/800/400',
                alt: 'A cute kitten',
              },
            },
            {
              type: 'video',
              value: {
                url: 'https://www.w3schools.com/html/mov_bbb.mp4',
                caption: 'Example video',
              },
            },
            {
              type: 'audio',
              value: {
                provider: 'soundcloud',
                url: 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/293',
                title: 'Sound demo',
              },
            },
            {
              type: 'quote',
              value: {
                text: 'The best way to predict the future is to invent it.',
                author: 'Alan Kay',
              },
            },
            {
              type: 'button',
              value: {
                label: 'Click Me',
                href: 'https://example.com',
                style: 'primary',
              },
            },
            {
              type: 'grid',
              value: {
                columns: 2,
                items: [
                  { type: 'text', value: 'Left column text block' },
                  {
                    type: 'image',
                    value: {
                      url: 'https://placebear.com/400/200',
                      alt: 'A bear',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  };

  const { data, error } = await supabase.from('templates').insert([sample]).select();
  if (error) return res.status(500).json({ error });
  res.status(200).json({ inserted: data });
}
