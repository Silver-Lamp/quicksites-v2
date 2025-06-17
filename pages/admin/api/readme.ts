import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const filePath = path.join(process.cwd(), 'README.md');
  const markdown = fs.readFileSync(filePath, 'utf8');
  const html = marked(markdown);
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}
