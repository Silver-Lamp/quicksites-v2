/**
 * @jest-environment node
 *
 * MOBILE EDITING: LAYERING AND PANNING.
 *
 * ⚠️ Three independent failures on one phone screenshot, all invisible on a desktop:
 *   • the action tray clipped its right-hand half with no way to reach it;
 *   • the Shuffle pill floated over the canvas and over every panel;
 *   • the Site Settings sheet rendered UNDER both of them.
 *
 * None of these is a component bug in isolation. They are a stacking and width contract nobody
 * wrote down, so each fix is pinned here with the rule it follows.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '@/test/stripComments';

const root = process.cwd();
const read = (p: string) => stripComments(readFileSync(join(root, p), 'utf8'));

const BAR = read('components/admin/templates/template-action-toolbar/TemplateActionToolbar.tsx');
const SHUFFLE = read('components/admin/templates/template-action-toolbar/ShuffleMenu.tsx');
const EDITOR = read('components/admin/templates/template-editor-content.tsx');

describe('read real files', () => {
  it('did not strip them away', () => {
    expect(BAR.length).toBeGreaterThan(8000);
    expect(SHUFFLE.length).toBeGreaterThan(800);
    expect(EDITOR.length).toBeGreaterThan(5000);
  });
});

describe('⚠️ panning: the tray must stay reachable at 390px', () => {
  it('scrolls horizontally instead of clipping', () => {
    // ~12 controls do not fit a phone. Clipping loses light/dark, theme, save and publish with no
    // affordance at all; scrolling keeps every one of them a swipe away.
    expect(BAR).toMatch(/overflow-x-auto/);
  });

  it('does not stretch the gaps at narrow widths', () => {
    expect(BAR).toMatch(/justify-start sm:justify-between/);
  });
});

describe('⚠️ layering: a modal covers the chrome, a spotlight respects it', () => {
  it('the Site Settings sheet sits above the tray', () => {
    // At z-[1300] the tray and the Shuffle pill (both max int) drew straight through a
    // full-screen sheet.
    expect(EDITOR).toMatch(/fixed inset-0 z-\[2147483647\] bg-black\/70/);
    expect(EDITOR).not.toMatch(/fixed inset-0 z-\[1300\]/);
  });

  it('the Shuffle pill is off on phones', () => {
    // It is a delight control with a home in the toolbar's Theme panel; on a phone it was simply
    // furniture in the middle of the canvas.
    expect(SHUFFLE).toMatch(/hidden sm:block fixed bottom-24/);
  });

  // ⚠️ The two rules are opposites ON PURPOSE, and that is worth stating so neither gets
  // "corrected" to match the other. The walkthrough POINTS AT the toolbar, so it must not cover
  // it — it treats the tray as a floor. A settings sheet REPLACES the screen, so it must.
  it('the walkthrough still treats the toolbar as a floor, not a rival', () => {
    const TOUR = read('components/onboarding/editor-walkthrough.tsx');
    expect(TOUR).toMatch(/getElementById\('template-action-toolbar'\)/);
    expect(TOUR).toMatch(/const floor =/);
  });
});
