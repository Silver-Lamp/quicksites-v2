/**
 * @jest-environment node
 */
// One URL, two spellings, three components — and every CTA block in the fleet was broken.
//
//   the scaffolds wrote ......... content.link
//   the schema knew only ........ content.href   (and z.object STRIPS unknown keys)
//   the renderer required ....... content.link   (deleted a moment earlier by the schema)
//
// So validation removed the destination and the renderer printed "⚠️ Missing content for CTA
// block". A scan of 2560 live templates found 149 cta blocks carrying `link` and ZERO with a
// real `href` — i.e. every one of them rendered as a red error, on published pages, for months.
//
// Nobody noticed because each piece is individually correct. That is the recurring shape of the
// worst bugs here: not a wrong line, but two copies of one truth that drifted apart.
//
// `href` is canonical — it is the schema's field and the anchor's attribute. These tests hold
// both halves of the fix: new blocks are written correctly, and the 149 already in the database
// heal when read, without a migration.
import { blockContentSchemaMap } from '@/admin/lib/zod/blockSchema';

const parse = (content: unknown) => (blockContentSchemaMap as any).cta.schema.parse(content);

describe('cta schema folds the legacy `link` spelling into `href`', () => {
  it('heals a legacy block that only has `link`', () => {
    const healed = parse({ label: 'Book now', link: 'https://example.com/book' });
    expect(healed.href).toBe('https://example.com/book');
  });

  it('heals the exact shape found in the database', () => {
    // Real row: href defaulted to '/', the true destination stranded in `link`.
    const healed = parse({
      label: 'Record your voice — make this page talk',
      href: '/',
      link: 'https://hivejournal.com/dashboard/lovio/voice-setup',
      style: 'primary',
    });
    // A bare '/' is the schema default, not a destination someone chose — the real link wins.
    expect(healed.href).toBe('https://hivejournal.com/dashboard/lovio/voice-setup');
  });

  it('leaves a genuine href alone', () => {
    const healed = parse({ label: 'Contact', href: '#contact', link: 'https://wrong.example' });
    expect(healed.href).toBe('#contact');
  });

  it('keeps working for a block that only ever had href', () => {
    expect(parse({ label: 'Go', href: '/pricing' }).href).toBe('/pricing');
  });

  it('still requires a label', () => {
    expect(() => parse({ href: '/x' })).toThrow();
  });
});

// The renderer is the other half. It must key off `href`, because that is the field that
// survives validation — requiring `link` is precisely what broke the fleet.
describe('the cta renderer reads the field that survives validation', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(process.cwd(), 'components/admin/templates/render-blocks/cta.tsx'),
    'utf8',
  );

  it('does not gate rendering on `link`', () => {
    // The original guard was `if (!final || !final.label || !final.link)`.
    expect(src).not.toMatch(/!final\.link/);
  });

  it('prefers href and falls back to link', () => {
    expect(src).toMatch(/href\s*\|\|\s*\(final as any\)\?\.link/);
  });
});

// And the writers, so new blocks never re-enter the broken state.
describe('scaffolds write href, not link', () => {
  const read = (p: string) =>
    require('node:fs').readFileSync(require('node:path').join(process.cwd(), p), 'utf8');

  it.each(['lib/builder/industryScaffold.ts', 'lib/seo/localPages.ts'])(
    '%s sets href on cta blocks',
    (file) => {
      const src = read(file);
      // Find every cta block construction and check the assignment that follows it.
      const idxs: number[] = [];
      let i = src.indexOf("createDefaultBlock('cta')");
      while (i >= 0) {
        idxs.push(i);
        i = src.indexOf("createDefaultBlock('cta')", i + 1);
      }
      expect(idxs.length).toBeGreaterThan(0);
      for (const at of idxs) {
        const window = src.slice(at, at + 400);
        expect(window).not.toMatch(/^\s*link:/m);
      }
    },
  );
});
