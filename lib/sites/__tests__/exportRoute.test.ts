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

describe('who may export', () => {
  // ⚠️ It walks away with the whole rendered site, so a real owner's site stays owner-only.
  it('requires a signed-in user and checks ownership', () => {
    expect(route).toMatch(/requireUser\(\)/);
    expect(route).toMatch(/isOwner/);
    expect(route).toMatch(/403/);
  });

  // ⚠️ Strict owner-only refused EVERYBODY on the 127 listing-import drafts: `owner_id` is null on
  // all of them, so `null !== you` locked out even the admin who built the site — the only people
  // who can use the feature before a business claims it.
  it('lets an operator export an unclaimed draft that has no owner yet', () => {
    expect(route).toMatch(/isUnclaimedOperatorDraft/);
    expect(route).toMatch(/getAdminUser\(\)/);
    expect(route).toMatch(/claimSrc === 'listing_import' \|\| claimSrc === 'operator_draft'/);
  });

  // A claimed site is somebody's. Admin access to it is a different act with a different
  // justification, and this route is not where that gets decided.
  it('does not extend the operator path to a site someone owns', () => {
    expect(route).toMatch(/!ownerId && \(claimSrc/);
    expect(route).toMatch(/isUnclaimedOperatorDraft \? await getAdminUser\(\) : null/);
  });

  it('says which of the two refusals it is', () => {
    expect(route).toMatch(/This draft has no owner yet/);
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
  // export would have wrapped that and handed a restaurant owner our error page as the artifact
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

describe('the file actually works offline', () => {
  // ⚠️ Found by opening the downloaded file, not by any test: it had ZERO inlined images and
  // reported no failures. Every fetch succeeded and every substitution missed, because the route
  // absolutised each src to fetch it and then replaced the ABSOLUTE string — which appears nowhere
  // in a document that writes `/api/public/place-photo?ref=…`. A clean success producing a page
  // with the restaurant's photo missing.
  it('substitutes the reference as written, not the URL it fetched', () => {
    expect(route).toMatch(/map\[ref\] = got\.uri/);
    expect(route).toMatch(/new URL\(ref, pageUrl\)/);
  });

  it('collects relative references too, not only absolute ones', () => {
    // The old CSS regex required `https?:`, so every `/_next/static/media/…` background was
    // never even attempted.
    expect(route).toMatch(/url\\\(\(\["'\]\?\)\(\[\^"'\)\]\+\)/);
    expect(route).not.toMatch(/https\?:\[\^"'\)\]\+/);
  });

  it('turns the embedded map into a link rather than leaving a dead grey box', () => {
    expect(route).toMatch(/iframe\[src\*="maps\./);
    expect(route).toMatch(/Open the map/);
  });

  // ⚠️ The banner promises "needs no internet connection". Anything still outstanding is said next
  // to that promise rather than discovered by the owner on a plane.
  it('amends the banner when something could not be embedded', () => {
    expect(route).toMatch(/mapsReplaced \|\| failed\.length/);
    expect(route).toMatch(/a live map cannot work offline/);
  });

  it('drops preloads, which point at chunks the file no longer has', () => {
    expect(route).toMatch(/link\[rel="preload"\]/);
  });
});

describe('our chrome does not survive into their file', () => {
  // ⚠️ `?qs_export=1` reads `window.location`, and this route fetches SERVER-RENDERED HTML — so the
  // opt-out never ran. The exported file carried the audio launcher and a full-screen `Loading…`
  // splash at z-9999 that nothing could dismiss, because we strip the scripts that would have
  // hidden it. The owner opened their site and got a dark overlay, permanently.
  it('removes elements we marked as ours', () => {
    expect(route).toMatch(/\[data-qs-chrome\]/);
    expect(route).toMatch(/\$\('\[data-qs-chrome\]'\)\.remove\(\)/);
  });

  it('also removes the loading splash by its own long-standing attribute', () => {
    expect(route).toMatch(/loading-splash/);
  });

  it('marks the overlays at their source rather than matching on class names', () => {
    for (const f of [
      'components/ui/LoadingSplash.tsx',
      'components/hear-this-page.tsx',
      'components/sites/menu-claim-bar.tsx',
      'components/sites/preview-watermark.tsx',
    ]) {
      expect(readFileSync(join(process.cwd(), f), 'utf8')).toMatch(/data-qs-chrome/);
    }
  });
});
