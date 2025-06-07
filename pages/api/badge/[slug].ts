export default function handler(req, res) {
  const { slug, format } = req.query;
  if (!slug) return res.status(400).send('Missing slug');

  const domain = 'https://yourdomain.com';
  const imageUrl = \`\${domain}/api/badge/\${slug}\`;
  const supportUrl = \`\${domain}/support/\${slug}\`;

  let html = '';
  if (format === 'markdown') {
    html = \`[![Weekly Top Campaign Badge](\${imageUrl})](\${supportUrl})\`;
  } else if (format === 'iframe') {
    html = \`<iframe src="\${imageUrl}" width="600" height="320" style="border:0;"></iframe>\`;
  } else {
    html = \`
<div style="font-family: sans-serif; text-align: center; padding: 1em;">
  <a href="\${supportUrl}" target="_blank">
    <img src="\${imageUrl}" alt="Weekly Top Campaign Badge" style="width: 300px; border-radius: 8px;" />
  </a>
  <p style="font-size: 14px; color: #888;">Proudly featured on the Odessa Weekly Leaderboard</p>
</div>\`;
  }

  res.setHeader('Content-Type', 'text/plain');
  res.send(html);
}
