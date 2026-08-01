/**
 * @jest-environment jsdom
 */
// Two overlays, one body. The naive save/restore each shell used independently is correct for a
// single owner and wrong for two:
//
//   modal opens   → saves prev = ''      → sets overflow 'hidden'
//   drawer opens  → saves prev = 'hidden' → sets overflow 'hidden'
//   modal closes  → restores ''           (unlocked, while the drawer is still open!)
//   drawer closes → restores 'hidden'     (LOCKED, with nothing on screen)
//
// The page is now scroll-locked with no overlay visible and nothing to click. A reload is the
// only way out, and the user cannot tell why. It needs two overlays AND an out-of-order unmount,
// which is exactly why it survives review — every component is individually correct, and the bug
// lives in the space between them.
import { lockBodyScroll, __lockDepth } from '../bodyScrollLock';

describe('bodyScrollLock refcounts', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    // Drain any depth left by a previous test.
    while (__lockDepth() > 0) lockBodyScroll()(), lockBodyScroll()();
  });

  it('locks on the first owner', () => {
    const release = lockBodyScroll();
    expect(document.body.style.overflow).toBe('hidden');
    release();
    expect(document.body.style.overflow).toBe('');
  });

  it('stays locked while a second owner holds it', () => {
    const a = lockBodyScroll();
    const b = lockBodyScroll();
    a();
    // A is gone but B still needs the lock.
    expect(document.body.style.overflow).toBe('hidden');
    b();
    expect(document.body.style.overflow).toBe('');
  });

  // ⚠️ THE REGRESSION. Out-of-order release is what the old code got wrong.
  it('unlocks correctly when owners release out of order', () => {
    const outer = lockBodyScroll();
    const inner = lockBodyScroll();
    outer();
    inner();
    expect(document.body.style.overflow).toBe('');
  });

  it('restores whatever was there before, not a hard-coded empty', () => {
    document.body.style.overflow = 'scroll';
    const release = lockBodyScroll();
    expect(document.body.style.overflow).toBe('hidden');
    release();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('ignores a double release rather than unlocking early', () => {
    // React StrictMode can invoke a cleanup twice; an extra decrement would drop the count
    // below the number of real owners and unlock while an overlay is still open.
    const a = lockBodyScroll();
    const b = lockBodyScroll();
    a();
    a();
    expect(document.body.style.overflow).toBe('hidden');
    b();
    expect(document.body.style.overflow).toBe('');
  });

  it('never leaves the depth negative', () => {
    const release = lockBodyScroll();
    release();
    release();
    expect(__lockDepth()).toBe(0);
  });
});

// The shells must actually use it — a helper nothing calls fixes nothing.
describe('the overlay shells use the shared lock', () => {
  const { readFileSync } = require('node:fs');
  const { join } = require('node:path');

  it.each(['components/ui/modal-shell.tsx', 'components/ui/drawer-shell.tsx'])('%s', (f: string) => {
    const src = readFileSync(join(process.cwd(), f), 'utf8');
    expect(src).toContain('lockBodyScroll');
    // And no longer hand-rolls its own save/restore.
    expect(src).not.toMatch(/const prevOverflow = body\.style\.overflow/);
  });
});
