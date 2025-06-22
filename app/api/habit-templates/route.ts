export const runtime = 'nodejs';

import { NextRequest } from 'next/server';

const templates = [
  {
    emoji: '🦷',
    title: 'Floss',
    slug: 'floss',
    message: 'Daily dental check-in.',
    example_lat: 0,
    example_lon: 0,
  },
  {
    emoji: '💧',
    title: 'Drink Water',
    slug: 'water',
    message: 'Hydration matters!',
    example_lat: 0,
    example_lon: 0,
  },
  {
    emoji: '🧘',
    title: 'Meditate',
    slug: 'meditate',
    message: 'Log your daily calm.',
    example_lat: 0,
    example_lon: 0,
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const title = searchParams.get('title');

  let filtered = templates;

  if (slug) {
    filtered = filtered.filter((t) => t.slug === slug);
  }

  if (title) {
    filtered = filtered.filter((t) => t.title.toLowerCase() === title.toLowerCase());
  }

  return new Response(JSON.stringify(filtered), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
