/** @jest-environment jsdom */
//
// The refcount is the whole point. Two multi-second waits overlap on the guest build path —
// the full-screen BrandLoader during creation, then the ~20s autogen bar once the editor
// opens. If each cleared the flag on unmount, the first to finish would announce the document
// ready while the second was still generating, which is the exact bug this file exists to
// prevent, only harder to see.
import { markDocumentBusy } from '../documentBusy';

const busy = () => document.body.getAttribute('aria-busy');

describe('documentBusy', () => {
  afterEach(() => document.body.removeAttribute('aria-busy'));

  it('flags and clears for a single holder', () => {
    const release = markDocumentBusy();
    expect(busy()).toBe('true');
    release();
    expect(busy()).toBeNull();
  });

  it('stays busy until the LAST overlapping holder releases', () => {
    const a = markDocumentBusy();
    const b = markDocumentBusy();
    a();
    expect(busy()).toBe('true'); // b is still generating
    b();
    expect(busy()).toBeNull();
  });

  it('ignores a double release rather than clearing someone else’s hold', () => {
    const a = markDocumentBusy();
    const b = markDocumentBusy();
    a();
    a(); // buggy caller, or a StrictMode double-invoke
    expect(busy()).toBe('true'); // b must not have been dropped
    b();
    expect(busy()).toBeNull();
  });

  it('survives release ordering', () => {
    const a = markDocumentBusy();
    const b = markDocumentBusy();
    b();
    expect(busy()).toBe('true');
    a();
    expect(busy()).toBeNull();
  });
});
