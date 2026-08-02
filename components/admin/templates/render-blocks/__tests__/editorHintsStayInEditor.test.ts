/**
 * @jest-environment node
 */
// Text written for the OWNER must not be published to their CUSTOMERS.
//
// The live footer of a real business site read:
//
//     Company Info  —                Phone  —
//     Find Us       Map unavailable         No social links yet.
//
// Every line there is a message to the site's owner, addressed to a visitor. "No social links
// yet." tells a prospect the business is half-built. "Map unavailable" tells them our renderer
// failed. The em-dashes announce what we don't know about them. A persona evaluating QuickSites
// through one of our own demo sites named exactly this as a reason not to trust it.
//
// Same rule as a missing backdrop, a dropped invalid block, and an unpainted image: where there
// is nothing true to render, render NOTHING. The hint belongs in the editor, the only place it
// was ever useful.
//
// This is the third instance tonight of one shape — owner-facing text reaching visitors — after
// the scaffold placeholder on a résumé page and the raw-JSON "Invalid block removed" block. It
// earns a standing guard rather than another one-off fix.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ⚠️ TWO DIRECTORIES, BECAUSE BESPOKE CLIENT BLOCKS LIVE SOMEWHERE ELSE. This swept only
// `components/admin/templates/render-blocks` and therefore missed every block written for one
// custom site — e.g. `exterior_agency`, a 556-line whole-page block for a real client, which
// escaped this guard AND the SectionShell colour guard purely by living in another folder.
// A sweep that defines its own scope by directory will always miss the file someone put beside it.
const DIRS = [
  join(process.cwd(), 'components/admin/templates/render-blocks'),
  join(process.cwd(), 'components/sites/render-blocks'),
];
const DIR = DIRS[0];
const footer = readFileSync(join(DIR, 'footer.tsx'), 'utf8');

/** Strip comments so the prose explaining a rule can't satisfy or violate it. */
const code = (src: string) =>
  src
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
    .join('\n');

describe('footer editor hints are gated to the editor', () => {
  const body = code(footer);

  it.each([
    ['No social links yet.', 'tells a prospect the business is half-built'],
    ['Map unavailable', 'tells a visitor our renderer failed'],
    ['No links configured.', 'is a setup instruction, not site content'],
  ])('%s is gated', (phrase) => {
    // The phrase may exist — it just may never render unconditionally.
    const at = body.indexOf(phrase);
    expect(at).toBeGreaterThan(-1);
    // Look back a little: the render must be guarded by the editor-context flag.
    const window = body.slice(Math.max(0, at - 220), at);
    expect(window).toContain('showEditorHints');
  });

  it('defines the gate from a real editor-context signal, not a constant', () => {
    expect(body).toMatch(/const showEditorHints = enableFooterEdit/);
    expect(body).toMatch(/inIframe \|\| inlineHints \|\| previewOnly/);
  });

  it('does not print an em-dash placeholder for a missing phone on a published page', () => {
    // The Phone row must be wrapped in a condition that includes the hint gate.
    const at = body.indexOf('<div className={subText}>Phone</div>');
    expect(at).toBeGreaterThan(-1);
    expect(body.slice(Math.max(0, at - 200), at)).toContain('showEditorHints');
  });
});

// The same class, swept across every renderer: a bare "not configured / unavailable / none yet"
// string that no editor gate protects.
// The sweep found two renderers with NO gate at all. services.tsx was the worse of the two: an
// empty block rendered "⚠️ No services configured. This block prefers `template.data.services`"
// — a red error quoting our own schema at a business's customers. Both now return null in public.
describe('no renderer publishes a setup instruction unconditionally', () => {
  const files = DIRS.flatMap((d) =>
    readdirSync(d)
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => join(d, f)),
  );

  it('scans a real set of files (a sweep matching nothing reports success)', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('covers the bespoke-client renderer directory too, not just the block library', () => {
    expect(files.some((f) => f.includes('components/sites/render-blocks'))).toBe(true);
  });

  it.each(files as string[])('%s', (f) => {
    const body = code(readFileSync(String(f), 'utf8'));
    // Phrases that are unambiguously addressed to the site's owner.
    const owner = /(No \w+ configured\.|not configured\b|Set in Template Identity)/g;

    for (const m of body.matchAll(owner)) {
      // ⚠️ PROXIMITY, NOT PRESENCE. The first version of this asserted only that the FILE
      // contained a gate identifier somewhere. Deleting services.tsx's actual
      // `if (!isEditorContext()) return null` left the unused import behind — so the regex still
      // matched and all 66 tests passed while the hint went straight back to visitors. Verified
      // by making exactly that edit and watching nothing go red.
      //
      // Third time tonight a test asserted a proxy for the thing instead of the thing. The
      // shape is always the same: check something CORRELATED with correctness because it is
      // easier to write than the correctness itself.
      const at = m.index ?? 0;
      const near = body.slice(Math.max(0, at - 400), at);
      expect(near).toMatch(/showEditorHints|isEditorContext\(\)|previewOnly|isEditor\b/);
    }
  });
});

// The gate itself, once, so three renderers cannot drift apart.
describe('isEditorContext fails closed toward PUBLIC', () => {
  const src = readFileSync(join(process.cwd(), 'lib/editor/isEditorContext.ts'), 'utf8');

  it('returns false when there is no window (SSR)', () => {
    // A hint missing from the editor for one render costs an owner nothing. A hint shown to a
    // customer is the bug. So the safe default is "assume public".
    expect(src).toMatch(/typeof window === 'undefined'[\s\S]{0,80}return false/);
  });

  it('honours an explicit previewOnly', () => {
    expect(src).toMatch(/if \(previewOnly\) return true/);
  });

  it('detects both editor shapes — iframe and inline', () => {
    expect(src).toContain('window.parent !== window');
    expect(src).toContain('qs-editor');
  });
});

// ⚠️ THE ONE THAT REACHED A CUSTOMER URL. A published site referencing a block type this build
// does not have rendered "⚠️ No renderer for block type: cloud_savings_agency" — in red, to the
// public, on somebody's business page. Template DATA and renderer CODE deploy on different
// clocks, so this is a recurring situation rather than a hypothetical: a rollback, a staged
// deploy, or publishing ahead of a merge all produce it.
describe('an unrenderable block is silent in public', () => {
  const src = readFileSync(
    join(process.cwd(), 'components/admin/templates/render-block.tsx'),
    'utf8',
  );
  const body = src
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
    .join('\n');

  it('returns null outside the editor', () => {
    const at = body.indexOf('No renderer for block type');
    expect(at).toBeGreaterThan(-1);
    const before = body.slice(Math.max(0, at - 300), at);
    expect(before).toMatch(/if \(!isEditorContext\(\)\) return null/);
  });

  it('still shows the diagnostic to whoever can act on it', () => {
    // Silent in public, loud in the editor — the point is the audience, not the silence.
    expect(body).toContain('No renderer for block type');
  });
});
