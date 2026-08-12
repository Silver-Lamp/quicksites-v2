/**
 * @jest-environment node
 */
import { clearInventedMenu } from '../menuBlocks';


// ── clearInventedMenu ─────────────────────────────────────────────────────────────────────────
// Added after a sweep put 28 real businesses on publicly-reachable pages showing food they do not
// serve. `assembleDraft` only REPLACED the scaffold's placeholder menu when a real one was
// recovered from photos; the ~50% that recovered nothing kept the invented dishes.
describe('clearInventedMenu', () => {
  const invented = () => [
    { name: 'Breakfast', items: [{ name: 'Two Eggs Any Style' }, { name: 'Buttermilk Pancakes' }] },
    { name: 'Lunch', items: [{ name: 'House Burger' }, { name: 'Garden Salad' }] },
  ];

  it('empties a menu that is entirely scaffold placeholders', () => {
    const blocks = [{ type: 'menu', content: { sections: invented() } }];
    expect(clearInventedMenu(blocks)).toBe(true);
    expect(blocks[0].content.sections).toEqual([]);
  });

  // ⚠️ The block that must not be touched. A recovered menu is the whole point of the pipeline.
  it('never touches a real menu', () => {
    const real = [{ name: 'Banh Mi', items: [{ name: 'Banh mi thit nuong' }] }];
    const blocks = [{ type: 'menu', content: { sections: real } }];
    expect(clearInventedMenu(blocks)).toBe(false);
    expect(blocks[0].content.sections).toEqual(real);
  });

  // ⚠️ Deliberate: dropping a real dish to remove a fake one is the wrong trade. A mixed menu
  // wants a human looking at it, not a sweep deciding for them.
  it('leaves a mixed menu alone rather than half-deleting it', () => {
    const mixed = [{ name: 'Menu', items: [{ name: 'House Burger' }, { name: 'Pho Tai' }] }];
    const blocks = [{ type: 'menu', content: { sections: mixed } }];
    expect(clearInventedMenu(blocks)).toBe(false);
    expect(blocks[0].content.sections).toEqual(mixed);
  });

  // Both block shapes — the trap this whole module exists to contain.
  it('clears a props-shaped block too, not just content-shaped', () => {
    const blocks = [{ type: 'menu', props: { sections: invented() } }];
    expect(clearInventedMenu(blocks)).toBe(true);
    expect((blocks[0] as any).props.sections).toEqual([]);
  });

  it('is quiet when there is no menu block at all', () => {
    const blocks = [{ type: 'hero', content: {} }];
    expect(clearInventedMenu(blocks)).toBe(false);
    expect(clearInventedMenu([])).toBe(false);
  });
});
