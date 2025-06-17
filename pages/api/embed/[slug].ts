import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query;
  if (!slug) return res.status(400).send('Missing slug');

  const domain = 'https://quicksites.ai';
  const html = `
<div style="font-family: sans-serif; text-align: center; padding: 1em;">
  <a href="${domain}/support/${slug}" target="_blank">
    <img src="${domain}/api/badge/${slug}" alt="Weekly Top Campaign Badge" style="width: 300px; border-radius: 8px;" />
  </a>
  <p style="font-size: 14px; color: #888;">Proudly featured on the Odessa Weekly Leaderboard</p>
</div>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}
