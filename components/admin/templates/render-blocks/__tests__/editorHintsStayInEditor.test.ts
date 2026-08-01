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

const DIR = join(process.cwd(), 'components/admin/templates/render-blocks');
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
  const files = readdirSync(DIR).filter((f) => f.endsWith('.tsx'));

  it('scans a real set of files (a sweep matching nothing reports success)', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files as string[])('%s', (f) => {
    const body = code(readFileSync(join(DIR, String(f)), 'utf8'));
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
