import { readFile } from 'fs/promises';
import * as Diff from 'diff';

async function compareSnapshots(a: string, b: string) {
  const [xmlA, xmlB] = await Promise.all([readFile(a, 'utf8'), readFile(b, 'utf8')]);

  const diff = Diff.createPatch('sitemap-diff', xmlA, xmlB, 'Previous', 'Current');

  console.log(diff);
}

// Example usage:
await compareSnapshots(
  'snapshots/sitemap-index-previous.xml',
  'snapshots/sitemap-index-latest.xml'
);
