/**
 * @jest-environment node
 */
// The contract HiveJournal's persona runner depends on.
//
// Their target was pinned to a slug. We retired that site, so three persona runs went into a URL
// that had stopped existing and the last could only report a 404. This feed exists so they
// resolve targets at run time instead of chasing our retirements — which means the two things
// that must never quietly change are: the URLs are absolute, and "live" means actually serving.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KEY_TO_LABEL } from '@/lib/industries';

const src = readFileSync(join(process.cwd(), 'app/api/public/demo-cohort/route.ts'), 'utf8');
const code = src
  .split('\n')
  .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
  .join('\n');

describe('liveness comes from published_sites, not from flags', () => {
  // ⚠️ THE LOAD-BEARING INVARIANT. The public renderer serves whatever the published_sites
  // pointer references and ignores `templates.published`, `archived`, `is_public` and `status`
  // alike — a template can read published:false and still serve, or be archived and still serve.
  // Deriving liveness from those flags is exactly how a consumer ends up pointed at a dead URL,
  // which is the bug this endpoint was built to end.
  it('queries published_sites', () => {
    expect(code).toMatch(/\.from\('published_sites'\)/);
  });

  it('does not use templates.published as the liveness signal', () => {
    expect(code).not.toMatch(/\.eq\('published',\s*true\)/);
  });

  it('filters the returned list by the published set', () => {
    expect(code).toMatch(/liveIds\.has\(t\.id\)/);
  });

  it('resolves liveness in ONE query, not per template', () => {
    // A public endpoint that fans out N round-trips is a free amplification for anyone who
    // finds it.
    expect(code).toMatch(/\.in\('template_id', ids\)/);
    expect(code).not.toMatch(/for \(const t of .*\) \{[\s\S]{0,200}await db/);
  });
});

describe('the URL shape a browser can be pointed at', () => {
  it('builds an absolute https URL', () => {
    // /api/public/showcase could not serve this: its `href` mixes absolute external domains
    // with relative paths like /sites/local, so there is no single field to open.
    expect(code).toMatch(/https:\/\/\$\{t\.slug\}\$\{ORIGIN_SUFFIX\}\//);
    expect(code).toMatch(/const ORIGIN_SUFFIX = '\.quicksites\.ai'/);
  });

  it('skips a template with no slug rather than emitting https://undefined', () => {
    expect(code).toMatch(/t\.slug && liveIds\.has/);
  });
});

describe('industry tagging keeps a persona goal matched to the trade', () => {
  it('emits both the key and a human label', () => {
    expect(code).toContain('industry: t.industry');
    expect(code).toContain('industryLabel:');
  });

  it('uses the canonical label map', () => {
    // The showcase feed cases these inconsistently ('Towing' vs 'pest_control'); this one
    // resolves through KEY_TO_LABEL so a consumer gets one spelling.
    expect(code).toContain('KEY_TO_LABEL');
    expect((KEY_TO_LABEL as Record<string, string>).auto_repair).toBeTruthy();
  });
});

describe('degradation', () => {
  it('returns an empty cohort rather than a 500 when env is missing', () => {
    // A consumer polling this should see "nothing to test right now", not an error it has to
    // special-case — the same reasoning as the config-health gates.
    const guard = code.slice(code.indexOf('if (!url || !key)'), code.indexOf('const db ='));
    expect(guard).toMatch(/count: 0, sites: \[\]/);
    expect(guard).not.toMatch(/status: 5\d\d/);
  });

  it('is cached briefly, since a stale answer is the failure it exists to prevent', () => {
    expect(code).toMatch(/Cache-Control/);
    expect(code).toMatch(/s-maxage=\d+/);
  });
});
