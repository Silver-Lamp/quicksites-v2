// scripts/manage-hosts-from-supabase.ts
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const HOSTS_PATH = os.platform() === 'win32'
  ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
  : '/etc/hosts';

const MARKER = '# QuickSites.dev';
const LOCAL_DOMAIN = 'localhost';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchSlugs(): Promise<string[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('slug')
    .eq('is_site', true)
    .eq('published', true);

  if (error || !data) {
    console.error('❌ Error fetching slugs from Supabase:', error);
    process.exit(1);
  }

  return data.map((t) => t.slug);
}

function getExistingLines(content: string, slugs: string[]): string[] {
  return content
    .split('\n')
    .filter((line) => !slugs.some((slug) => line.includes(`${slug}.${LOCAL_DOMAIN}`)));
}

function buildEntry(slug: string) {
  return `127.0.0.1 ${slug}.${LOCAL_DOMAIN}`;
}

async function addHosts() {
  const slugs = await fetchSlugs();
  const current = fs.readFileSync(HOSTS_PATH, 'utf-8');
  const baseLines = getExistingLines(current, slugs);

  const newLines = slugs.map(buildEntry);
  const updated = [...baseLines, MARKER, ...newLines].join('\n');

  fs.writeFileSync(HOSTS_PATH, updated, 'utf-8');
  console.log(`✅ Added ${slugs.length} slugs to /etc/hosts`);
}

async function removeHosts() {
  const slugs = await fetchSlugs();
  const current = fs.readFileSync(HOSTS_PATH, 'utf-8');
  const cleaned = getExistingLines(current, slugs).filter((line) => line.trim() !== MARKER);
  fs.writeFileSync(HOSTS_PATH, cleaned.join('\n'), 'utf-8');
  console.log(`🧹 Removed QuickSites entries from /etc/hosts`);
}

const action = process.argv[2];
if (action === 'add') {
  addHosts();
} else if (action === 'remove') {
  removeHosts();
} else {
  console.log(`Usage: ts-node scripts/manage-hosts-from-supabase.ts add | remove`);
}
