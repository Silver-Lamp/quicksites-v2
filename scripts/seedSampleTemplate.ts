// scripts/seedSampleTemplate.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
              url: 'https://placebear.com/800/400',
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

async function seed() {
  const { data, error } = await supabase.from('templates').insert([sample]);
  if (error) console.error('❌ Seed failed', error);
  else console.log('✅ Seeded sample template', data);
}

seed();
