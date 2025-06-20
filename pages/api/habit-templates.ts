import { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
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

  json(templates);
}
