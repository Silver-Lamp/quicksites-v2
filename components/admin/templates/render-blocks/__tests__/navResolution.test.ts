/**
 * @jest-environment node
 */
// 83 of 98 LIVE sites — 85% — shipped header links to pages that do not exist.
//
// The scaffold seeds `/services` and `/contact` regardless of whether those pages were ever
// created, and almost no site creates them: the services list and the contact form are BLOCKS on
// the single index page, not separate routes. So the two most prominent links in the header of
// most sites we host went nowhere — and, because an unknown tenant path returns 200 with 404
// content, those dead links were indexable too.
//
// Found while polishing one custom site and actually looking at the header rather than the
// numbers. Asserted against the source because the resolution runs inside a React component.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(
  join(process.cwd(), 'components/admin/templates/render-blocks/header.tsx'),
  'utf8',
);
const code = src
  .split('\n')
  .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
  .join('\n');

describe('nav links resolve against what the site actually has', () => {
  it('a real page at that path is left alone', () => {
    expect(code).toMatch(/if \(pagePaths\.has\(href\)\) return \[item\]/);
  });

  // The destination usually EXISTS — as a block. Hiding the link would lose a working
  // destination; rewriting it gives the visitor what they wanted.
  it('rewrites to an in-page anchor when a matching block exists', () => {
    expect(code).toMatch(/wanted\.some\(\(t\) => blockTypes\.has\(t\)\)/);
    expect(code).toMatch(/href: `\/#\$\{href\.slice\(1\)\}`/);
  });

  it('drops the item when neither a page nor a block exists', () => {
    // A link to nothing is worse than one fewer link.
    expect(code).toMatch(/return \[\];/);
  });

  it('leaves external links, anchors and tel/mailto alone', () => {
    expect(code).toMatch(/if \(!href\.startsWith\('\/'\) \|\| href\.startsWith\('\/#'\)\) return \[item\]/);
  });

  it('maps the paths the scaffold actually seeds', () => {
    // /services and /contact are the two that were broken on 85% of live sites.
    expect(code).toMatch(/'\/services': \['services'\]/);
    expect(code).toMatch(/'\/contact': \['contact_form'\]/);
  });

  it('runs on every render rather than needing a data migration', () => {
    // Renderer-side on purpose: it repairs already-published sites on deploy, with nothing for
    // an owner to re-save. A migration would have fixed 83 rows and missed the 84th.
    expect(code).toMatch(/resolveNav\(base\.nav, template\)/);
  });

  it('reads both block arrays, because they are two copies of one truth', () => {
    // A site whose blocks live in `blocks` and not `content_blocks` would otherwise look empty
    // and have its entire nav dropped.
    expect(code).toMatch(/content_blocks \?\? \[\]\), \.\.\.\(p\?\.blocks \?\? \[\]\)/);
  });
});
