// A republish must refresh BOTH served copies: published_sites (platform / templates.custom_domain)
// and the legacy sites.published_snapshot_id → snapshots (custom hosts bound the old way). The
// second was missing until 2026-10-17, when graftontowing.com kept a coffee shop's address after
// a "republished" footer sync.
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.join(process.cwd(), 'lib/templates/republishIfPublished.ts'), 'utf8');

it('after the platform RPC, the legacy sites snapshot is minted from the draft and the site repointed', () => {
  const rpc = src.indexOf("rpc('publish_template_demo'");
  const legacy = src.indexOf('await refreshLegacySiteSnapshots(templateId)');
  expect(rpc).toBeGreaterThan(-1);
  expect(legacy).toBeGreaterThan(rpc);
  expect(src).toMatch(/\.from\('sites'\)[\s\S]*\.not\('published_snapshot_id', 'is', null\)/);
  expect(src).toMatch(/next\.hash = createHash\('sha256'\)/); // NOT NULL column
  expect(src).toMatch(/\.update\(\{ published_snapshot_id: /);
  // never a silent failure: a legacy miss rides out as a warning
  expect(src).toMatch(/legacy sites snapshot: \$\{legacy\.warning\}/);
});
