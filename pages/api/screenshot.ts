import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const domain = req.query.domain;
  if (!domain) return res.status(400).send('Missing domain');

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(`https://${domain}`, { waitUntil: 'networkidle2' });

  const screenshotPath = path.join(process.cwd(), 'public/screenshots', `${domain}.png`);
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });

  await browser.close();
  return res.status(200).json({ message: 'Screenshot saved', path: `/screenshots/${domain}.png` });
}
