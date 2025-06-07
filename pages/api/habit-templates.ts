export default async function handler(_req, res) {
  const templates = [
    {
      emoji: '🦷',
      title: 'Floss',
      slug: 'floss',
      message: 'Daily dental check-in.',
      example_lat: 0,
      example_lon: 0
    },
    {
      emoji: '💧',
      title: 'Drink Water',
      slug: 'water',
      message: 'Hydration matters!',
      example_lat: 0,
      example_lon: 0
    },
    {
      emoji: '🧘',
      title: 'Meditate',
      slug: 'meditate',
      message: 'Log your daily calm.',
      example_lat: 0,
      example_lon: 0
    }
  ];

  res.status(200).json(templates);
}
