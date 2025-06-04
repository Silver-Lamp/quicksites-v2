import fs from 'fs';
import path from 'path';
import { marked } from 'marked';

export default function handler(req, res) {
  const filePath = path.join(process.cwd(), 'README.md');
  const markdown = fs.readFileSync(filePath, 'utf8');
  const html = marked(markdown);
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}
