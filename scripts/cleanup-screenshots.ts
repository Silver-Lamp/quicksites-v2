import fs from 'fs';
import path from 'path';

const screenshotsDir = path.join(process.cwd(), 'public/__screenshots__');
const pinnedPath = path.join(screenshotsDir, 'pinned.json');
const maxAgeDays = 30;
const now = Date.now();

let pinned: string[] = ['main', 'develop'];

if (fs.existsSync(pinnedPath)) {
  try {
    const data = fs.readFileSync(pinnedPath, 'utf-8');
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed.pinned)) {
      pinned = parsed.pinned;
    }
  } catch (err) {
    console.error('Failed to parse pinned.json:', err);
  }
}

if (!fs.existsSync(screenshotsDir)) {
  console.log('No screenshots directory found.');
  process.exit(0);
}

const folders = fs.readdirSync(screenshotsDir).filter(name => !name.startsWith('.') && name !== 'pinned.json');

folders.forEach(folder => {
  if (pinned.includes(folder)) return;

  const folderPath = path.join(screenshotsDir, folder);
  const stats = fs.statSync(folderPath);
  const ageDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);

  if (ageDays > maxAgeDays) {
    fs.rmSync(folderPath, { recursive: true, force: true });
    console.log(`🧹 Deleted old screenshot branch: ${folder}`);
  }
});
