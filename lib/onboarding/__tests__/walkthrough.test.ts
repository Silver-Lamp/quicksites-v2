/**
 * @jest-environment node
 *
 * THE FIRST-RUN WALKTHROUGH.
 *
 * ⚠️ A tour is uniquely prone to rotting invisibly. The page keeps working; the thing it points
 * at has simply moved or been renamed, and the only symptom is a tooltip attached to nothing —
 * which no type checker and no unit test notices. So the anchors are asserted against the source
 * that renders them.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '@/test/stripComments';
import {
  WALKTHROUGH_PREF_KEY,
  WALKTHROUGH_STEPS,
  markSeen,
  markUnseen,
  shouldRunWalkthrough,
} from '@/lib/onboarding/walkthrough';

const root = process.cwd();
const read = (p: string) => stripComments(readFileSync(join(root, p), 'utf8'));

describe('when it runs', () => {
  it('runs for someone with no preferences yet', () => {
    expect(shouldRunWalkthrough({})).toBe(true);
  });

  it('does not run once seen', () => {
    expect(shouldRunWalkthrough(markSeen({}))).toBe(false);
  });

  // ⚠️ The asymmetry that decides this: never showing it costs a nicety; showing it AGAIN to a
  // returning customer every time a fetch fails is the product nagging them.
  it('does NOT run when preferences could not be read', () => {
    expect(shouldRunWalkthrough(null)).toBe(false);
    expect(shouldRunWalkthrough(undefined)).toBe(false);
  });

  it('runs again after a replay clears the flag', () => {
    const seen = markSeen({});
    expect(shouldRunWalkthrough(markUnseen(seen))).toBe(true);
  });

  it('records WHEN, not just that', () => {
    const p = markSeen({}, new Date('2026-09-26T12:00:00Z'));
    expect(p[WALKTHROUGH_PREF_KEY]).toBe('2026-09-26T12:00:00.000Z');
  });
});

describe('⚠️ every step points at something that exists', () => {
  const SOURCES = [
    'components/admin/admin-chrome.tsx',
    'components/admin/templates/template-action-toolbar/TemplateActionToolbar.tsx',
    'components/editor/live-editor/LiveEditorPreviewFrame.tsx',
  ].map(read).join('\n');

  it('read real files', () => {
    expect(SOURCES.length).toBeGreaterThan(20000);
  });

  it.each(WALKTHROUGH_STEPS.map((s) => [s.id, s.anchor]))(
    'step %s has a data-tour="%s" anchor in the editor source',
    (_id, anchor) => {
      expect(SOURCES).toContain(`data-tour="${anchor}"`);
    },
  );

  it('has no duplicate step ids or anchors', () => {
    const ids = WALKTHROUGH_STEPS.map((s) => s.id);
    const anchors = WALKTHROUGH_STEPS.map((s) => s.anchor);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it('stays short', () => {
    // These people typed a business name ninety seconds ago. The goal is their first real edit,
    // not a tour of the product.
    expect(WALKTHROUGH_STEPS.length).toBeLessThanOrEqual(6);
  });
});

describe('⚠️ the wiring', () => {
  const HOST = read('components/onboarding/walkthrough-host.tsx');
  const TOUR = read('components/onboarding/editor-walkthrough.tsx');
  const CHROME = read('components/admin/admin-chrome.tsx');
  const CARD = read('components/onboarding/walkthrough-replay-card.tsx');
  const ROUTE = read('app/api/me/ui-prefs/route.ts');

  it('is mounted in the SIGNED-IN chrome, not the guest one', () => {
    // A guest's session dies with them, so a "seen" flag against it is a row nobody reads again —
    // and "when they log back in" is the one case a guest never reaches. My first pass put it in
    // GuestChrome, which is precisely backwards.
    const guestChrome = CHROME.indexOf('function GuestChrome');
    const fullChrome = CHROME.indexOf('function FullAdminChrome');
    const mount = CHROME.indexOf('<WalkthroughHost />');
    expect(mount).toBeGreaterThan(fullChrome);
    expect(fullChrome).toBeGreaterThan(guestChrome);
  });

  it('records seen on ANY exit, not only on finishing', () => {
    // Someone who skips or presses Escape has told us they do not want it.
    expect(HOST).toMatch(/handleDone[\s\S]{0,400}method: 'PUT'/);
  });

  it('cannot trap anyone', () => {
    expect(TOUR).toMatch(/Escape/);
    expect(TOUR).toMatch(/>\s*Skip\s*</);
  });

  it('skips a step whose anchor is not on the page', () => {
    expect(TOUR).toMatch(/WALKTHROUGH_STEPS\.filter\(/);
  });

  it('the replay card clears the key with null, which is what the allowlist copies through', () => {
    // Omitting the key would leave the old value in place and the button would appear to work.
    expect(CARD).toMatch(/\[WALKTHROUGH_PREF_KEY\]: null/);
  });

  it('the route allowlists keys rather than storing a free-form blob', () => {
    expect(ROUTE).toMatch(/KNOWN_KEYS/);
    expect(ROUTE).toMatch(/requireUser\(\)/);
  });

  it('returns {} for a user with no row, so a first-timer still sees it', () => {
    expect(ROUTE).toMatch(/prefs: data\?\.prefs \?\? \{\}/);
  });
});
