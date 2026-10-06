/**
 * @jest-environment node
 */
// components/admin/__tests__/sidebarScroll.test.ts
//
// The admin sidebar must keep its scroll position across a navigation, and its search box must
// stay reachable. Found on production 2026-10-05: clicking a Platform Inbox child threw the
// sidebar from scrollTop 2426 to 0 on the SAME mounted <aside>, because route-driven selection
// took the FIRST prefix-matching row (a short early one like the dashboard) and scrolled it into
// view. Source guards, because the defect is which row an effect picks and whether it scrolls —
// nothing a render test observes.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raw = readFileSync(join(process.cwd(), 'components/admin/AppHeader/AdminNavSections.tsx'), 'utf8');
const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

describe('route-driven selection in the admin sidebar', () => {
  it('picks the MOST SPECIFIC matching href, not the first prefix match', () => {
    expect(code).toMatch(/h\.length > bestLen/);
    expect(code).not.toMatch(/focusRows\.findIndex\(\s*\(r\) => r\.href && pathname\?\.startsWith/);
  });

  it('does not scroll the sidebar on a route change — only an arrow-key move scrolls', () => {
    // The scroll effect is gated on a ref that only the keyboard handler sets true.
    expect(code).toMatch(/if \(!scrollOnSelectRef\.current\) return;/);
    const keyboardSets = code.match(/scrollOnSelectRef\.current = true/g) ?? [];
    expect(keyboardSets.length).toBe(2); // ArrowDown + ArrowUp
    // The pathname effect explicitly clears it before selecting.
    const pathEffect = code.slice(code.indexOf('let best = -1'), code.indexOf('}, [pathname, focusRows]);'));
    expect(pathEffect).toMatch(/scrollOnSelectRef\.current = false/);
  });

  it('opening a folder never scrolls the sidebar to the top — only keeps the tapped row in view', () => {
    // The second half of the same complaint: expanding "Platform Inbox" jumped to the top because
    // toggleMenu called a scroll-to-top helper on open.
    expect(code).not.toMatch(/scrollSidebarToTop/);
    expect(code).not.toMatch(/scrollTo\(\{ top: 0/);
    const toggle = code.slice(code.indexOf('const toggleMenu = '), code.indexOf('const handleNavigateStart'));
    expect(toggle).toMatch(/el\.scrollIntoView\(\{ block: 'nearest' \}\)/);
  });

  it('keeps the quick-find search pinned to the top of the scroll container', () => {
    const search = code.slice(code.indexOf('Find a feature…') - 1200, code.indexOf('Find a feature…'));
    expect(search).toMatch(/sticky top-0/);
    expect(search).toMatch(/z-20/);
  });
});
