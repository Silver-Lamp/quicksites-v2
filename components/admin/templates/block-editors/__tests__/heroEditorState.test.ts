import { shouldReloadLocal } from '../heroEditorState';

/**
 * The reported bug, as a test: an operator picks a hero image, an autosave round-trip hands the
 * editor a new `template` object, and the image is gone before Save is pressed.
 */
describe('shouldReloadLocal — the hero-image stomp', () => {
  it('does NOT reload when the same block arrives with a new object identity', () => {
    // This is the whole bug. `initialLocal` was recomputed because `template` changed; the block
    // is the same one the operator is editing, so their in-flight work must survive.
    expect(shouldReloadLocal('block-abc', 'block-abc')).toBe(false);
  });

  it('DOES reload when the operator opens a different block', () => {
    expect(shouldReloadLocal('block-abc', 'block-xyz')).toBe(true);
  });

  it('treats null and empty as the same identity, so a missing id does not reload every render', () => {
    expect(shouldReloadLocal(null, undefined)).toBe(false);
    expect(shouldReloadLocal('', null)).toBe(false);
  });

  it('reloads when a block gains an id it did not have', () => {
    expect(shouldReloadLocal(null, 'block-abc')).toBe(true);
  });
});

/**
 * The end-to-end shape, simulated: what the OLD effect did to an in-flight edit versus the new one.
 * Kept because the unit above tests a predicate, and this tests the consequence people care about.
 */
describe('an in-flight hero image survives an autosave round-trip', () => {
  const blockContent = { headline: 'WS Asphalt Paving', layout_mode: 'inline' };
  const pickImage = (local: any) => ({
    ...local,
    image_url: 'https://example.com/hero.png',
    heroImage: 'https://example.com/hero.png',
    layout_mode: 'background',
  });

  it('OLD behaviour discarded it (regression guard — this is what shipped)', () => {
    let local: any = pickImage({ ...blockContent });
    local = { ...blockContent }; // setLocal(initialLocal), unconditionally
    expect(local.image_url).toBeUndefined();
  });

  it('NEW behaviour keeps it, because the block identity did not change', () => {
    const key = 'block-abc';
    let local: any = pickImage({ ...blockContent });
    if (shouldReloadLocal(key, key)) local = { ...blockContent };
    expect(local.image_url).toBe('https://example.com/hero.png');
    expect(local.layout_mode).toBe('background');
  });
});
