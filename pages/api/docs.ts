// pages/api/docs.ts
import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(_req, res) {
  const spec = readFileSync(join(process.cwd(), 'openapi.json'), 'utf8');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).send(spec);
}
