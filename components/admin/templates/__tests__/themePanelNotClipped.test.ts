// components/admin/templates/__tests__/themePanelNotClipped.test.ts
//
// The theme panel must not be positioned inside the toolbar's scrolling row.
//
// ⚠️ THE FAILURE THIS CATCHES PRODUCED NO ERROR ANYWHERE AND NO VISIBLE EFFECT. The panel was
// an `absolute bottom-full` sibling of the Theme button, which put it inside the row carrying
// `overflow-x-auto` (so the buttons can scroll on a narrow screen). Per CSS, a non-`visible`
// overflow on ONE axis computes the other to `auto` — so the vertical axis clipped the panel
// to nothing. It mounted, its state toggled, React was perfectly happy, and the operator saw
// NOTHING. Worse, the outside-click catcher is `fixed inset-0`, so the next click landed on an
// invisible full-screen overlay and closed it again: two clicks, no feedback, no trace.
//
// A render test would not catch it either — the panel IS in the tree. Only the relationship
// between the positioning and the scroll container is wrong, which is a property of the source.

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.join(
  process.cwd(),
  'components/admin/templates/template-action-toolbar/TemplateActionToolbar.tsx',
);

describe('the theme panel escapes the scrolling toolbar row', () => {
  const src = fs.readFileSync(FILE, 'utf8');

  it('the toolbar row still scrolls horizontally', () => {
    // If this ever stops being true the clipping risk is gone — but so is the reason for the
    // portal, and someone should delete this test deliberately rather than find it passing
    // for a reason that no longer exists.
    expect(src).toContain('overflow-x-auto');
  });

  it('renders the panel through a portal to document.body', () => {
    expect(src).toMatch(/createPortal\([\s\S]{0,1200}?ThemeShufflePanel[\s\S]{0,600}?document\.body/);
  });

  it('never positions the panel relative to its place in the row', () => {
    // `absolute bottom-full` is the exact shape that was clipped.
    const nearPanel = src.slice(Math.max(0, src.indexOf('<ThemeShufflePanel') - 900), src.indexOf('<ThemeShufflePanel'));
    expect(nearPanel).not.toMatch(/absolute bottom-full/);
  });

  it('anchors to the measured button rect', () => {
    expect(src).toMatch(/themeBtnRef/);
    expect(src).toMatch(/getBoundingClientRect\(\)/);
    expect(src).toMatch(/ref=\{themeBtnRef\}/);
  });

  it('clamps so the panel cannot open off-screen', () => {
    // The row scrolls, so the button can sit hard against the viewport edge.
    expect(src).toMatch(/Math\.min\(r\.left, window\.innerWidth - PANEL_W/);
  });

  it('is reading a file that exists and is non-trivial', () => {
    expect(src.length).toBeGreaterThan(5000);
  });
});
