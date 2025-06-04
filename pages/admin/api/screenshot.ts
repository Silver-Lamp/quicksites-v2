import type { NextApiRequest, NextApiResponse } from 'next';
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs/promises';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { domain } = req.body;

  if (!domain) return res.status(400).json({ error: 'Missing domain' });

  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`https://${domain}`, { waitUntil: 'networkidle' });
    const screenshotsDir = path.resolve(process.cwd(), 'public', 'screenshots');
    await fs.mkdir(screenshotsDir, { recursive: true });
    const screenshotPath = path.join(screenshotsDir, `${domain}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await browser.close();

    return res.status(200).json({ screenshot: `/screenshots/${domain}.png` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
