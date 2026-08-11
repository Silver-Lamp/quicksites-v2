/**
 * @jest-environment node
 */
// The owner-facing export. Its whole job is to make "it's yours, take it anywhere" checkable
// rather than promised, so the properties that matter are about ownership and honesty, not output
// formatting.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const route = readFileSync(
  join(process.cwd(), 'app/api/sites/[id]/export/route.ts'),
  'utf8',
);
const launcher = readFileSync(join(process.cwd(), 'components/hear-this-page.tsx'), 'utf8');

describe('the export is owner-only', () => {
  // ⚠️ It walks away with the whole rendered site. "It's yours" is exactly the sentence that makes
  // checking whose it is non-negotiable.
  it('requires a signed-in user and matches owner_id', () => {
    expect(route).toMatch(/requireUser\(\)/);
    expect(route).toMatch(/owner_id !== gate\.user\.id/);
    expect(route).toMatch(/403/);
  });
});

describe('the page removes our chrome, the exporter does not guess at it', () => {
  it('asks the page with ?qs_export=1 rather than parsing our controls out', () => {
    expect(route).toMatch(/\?qs_export=1/);
    expect(launcher).toMatch(/qs_export/);
  });
});

describe('failures are named, not swallowed', () => {
  // ⚠️ A hole in a file you were told is complete is worse than a hole you were told about — the
  // same rule as the Verbatim parser reporting what a résumé did not yield.
  it('lists assets it could not embed inside the exported file', () => {
    expect(route).toMatch(/could not be embedded/);
    expect(route).toMatch(/failed\.join/);
  });

  it('says which step failed when the site itself cannot be read', () => {
    expect(route).toMatch(/Could not read \$\{pageUrl\}/);
    // "Export failed" on the button whose job is to prove we are not holding their site hostage
    // would be the worst possible message.
    expect(route).not.toMatch(/'Export failed'/);
  });
});

describe('it cannot be used to pull an unbounded payload', () => {
  it('caps per-asset and total bytes', () => {
    expect(route).toMatch(/MAX_ASSET_BYTES/);
    expect(route).toMatch(/MAX_TOTAL_BYTES/);
  });
});

describe('what leaves is theirs, not ours', () => {
  it('drops our scripts and the stylesheet links it inlined', () => {
    expect(route).toMatch(/\$\('script'\)\.remove\(\)/);
    expect(route).toMatch(/\$\('link\[rel="stylesheet"\]'\)\.remove\(\)/);
  });
});

describe('it fetches the page that is actually theirs', () => {
  // ⚠️ The first version built `<slug>.quicksites.ai` for every site. A listing-import draft lives
  // on delivered.menu; on the quicksites subdomain it serves OUR 404 — which returns 200. The
  // export would have wrapped that and handed a restaurant owner our error page as the artefact
  // proving they own their site.
  it('uses the menu host for listing-import drafts', () => {
    expect(route).toMatch(/menuSiteUrl\(slug\)/);
    expect(route).toMatch(/claimSource === 'listing_import'/);
  });

  it('prefers a custom domain over either', () => {
    const at = route.indexOf('const pageUrl');
    expect(route.slice(at, at + 260)).toMatch(/custom_domain[\s\S]*\?/);
  });

  // ⚠️ A 200 is not proof we fetched the right thing.
  it('refuses to hand over a page that does not carry the business name', () => {
    expect(route).toMatch(/does not look like your site/);
    expect(route).toMatch(/Refusing to hand you a file that is not yours/);
  });
});

describe('the button does not demand an irreversible act to test a safety feature', () => {
  const panel = readFileSync(
    join(process.cwd(), 'components/admin/templates/panels/take-it-with-you-panel.tsx'),
    'utf8',
  );

  // Gating on `published` asked an owner to publish a real business's page in order to check that
  // they could leave. Sandon declined, correctly.
  it('is not disabled on an unpublished draft', () => {
    expect(panel).toMatch(/disabled=\{busy\}/);
    expect(panel).not.toMatch(/disabled=\{busy \|\| !published\}/);
  });
});
