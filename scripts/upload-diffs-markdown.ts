import { readFile } from 'fs/promises';
import * as Diff from 'diff';
import { supabase } from '@/lib/supabaseClient.js';

function formatMarkdownDiff(diffText: string, title: string) {
  return `## 📄 ${title}

<details>
<summary>Click to expand diff</summary>

\`\`\`diff
${diffText}
\`\`\`

</details>
`;
}

async function createAndUploadMarkdownReport(
  fileA: string,
  fileB: string,
  mdKey: string,
  title: string
) {
  const [xmlA, xmlB] = await Promise.all([readFile(fileA, 'utf8'), readFile(fileB, 'utf8')]);

  const patch = Diff.createPatch(title, xmlA, xmlB, 'Previous', 'Current');
  const markdown = formatMarkdownDiff(patch, title);

  const { error } = await supabase.storage.from('sitemaps').upload(mdKey, markdown, {
    contentType: 'text/markdown',
    upsert: true,
  });

  if (error) {
    console.error(`❌ Markdown upload failed: ${error.message}`);
  } else {
    console.log(`✅ Markdown uploaded as ${mdKey}`);
  }
}

// Generate and upload both reports
await createAndUploadMarkdownReport(
  'snapshots/sitemap-index-previous.xml',
  'snapshots/sitemap-index-latest.xml',
  'sitemap-index.diff.md',
  'sitemap-index.xml'
);

await createAndUploadMarkdownReport(
  'snapshots/sitemap-hreflang-previous.xml',
  'snapshots/sitemap-hreflang-latest.xml',
  'sitemap-hreflang.diff.md',
  'sitemap-hreflang.xml'
);
