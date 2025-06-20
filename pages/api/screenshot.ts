import puppeteer from 'puppeteer';
import { json } from '@/lib/api/json';
import fs from 'fs';
import path from 'path';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const domain = _req.query.domain;
  if (!domain) return res.status(400).send('Missing domain');

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(`https://${domain}`, { waitUntil: 'networkidle2' });

  const screenshotPath = path.join(process.cwd(), 'public/screenshots', `${domain}.png`);
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });

  await browser.close();
  return json({
    message: 'Screenshot saved',
    path: `/screenshots/${domain}.png`,
  });
}
