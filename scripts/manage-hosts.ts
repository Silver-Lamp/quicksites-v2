// scripts/manage-hosts.ts
import fs from 'fs';
import os from 'os';
import path from 'path';

const HOSTS_PATH = os.platform() === 'win32'
  ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
  : '/etc/hosts';

const SLUGS = ['tow-test-1', 'tow-test-2', 'tow-test-3']; // ✅ customize

const MARKER = '# QuickSites.dev';

function buildEntry(slug: string) {
  return `127.0.0.1 ${slug}.localhost`;
}

function getExistingLines(content: string): string[] {
  return content
    .split('\n')
    .filter((line) => !SLUGS.some((slug) => line.includes(`${slug}.localhost`)));
}

function addHosts() {
  const current = fs.readFileSync(HOSTS_PATH, 'utf-8');
  const baseLines = getExistingLines(current);

  const newLines = SLUGS.map(buildEntry);
  const updated = [...baseLines, MARKER, ...newLines].join('\n');

  fs.writeFileSync(HOSTS_PATH, updated, 'utf-8');
  console.log(`✅ Added ${SLUGS.length} entries to /etc/hosts`);
}

function removeHosts() {
  const current = fs.readFileSync(HOSTS_PATH, 'utf-8');
  const cleaned = getExistingLines(current).filter((line) => line.trim() !== MARKER);
  fs.writeFileSync(HOSTS_PATH, cleaned.join('\n'), 'utf-8');
  console.log(`🧹 Removed QuickSites entries from /etc/hosts`);
}

const action = process.argv[2];
if (action === 'add') {
  addHosts();
} else if (action === 'remove') {
  removeHosts();
} else {
  console.log(`Usage: ts-node manage-hosts.ts add | remove`);
}
