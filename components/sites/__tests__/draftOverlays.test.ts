/**
 * @jest-environment node
 */
// Mobile chrome on an unclaimed draft. Reported from a phone on
// torero-s-cocina-mexicana-cantina-renton: the top notice covered the site header, the bottom
// carried four fixed layers at once, and the contact form asked a required question with no true
// answer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const watermark = readFileSync(join(process.cwd(), 'components/sites/preview-watermark.tsx'), 'utf8');
const claimBar = readFileSync(join(process.cwd(), 'components/sites/menu-claim-bar.tsx'), 'utf8');
const contact = readFileSync(
  join(process.cwd(), 'components/admin/templates/render-blocks/contact-form.tsx'),
  'utf8',
);

describe('the preview notice does not cover the site header', () => {
  // ⚠️ It is a banner, not a control — no reason to follow the scroll, and as `fixed top-0` it sat
  // permanently on the business's own name and nav, on the page we ask their owner to judge.
  it('renders the top ribbon in flow rather than fixed', () => {
    expect(watermark).not.toMatch(/fixed inset-x-0 top-0/);
    expect(watermark).toMatch(/relative z-\[2147483646\][^"]*flex justify-center/);
  });
});

describe('the bottom of a phone is not four fixed layers', () => {
  it('lets the claim bar suppress our attribution badge', () => {
    expect(watermark).toMatch(/hideCornerBadge/);
    expect(watermark).toMatch(/\{!hideCornerBadge && \(/);
  });
});

describe('the claim button is reachable on a phone', () => {
  // The primary action was a sliver against the right edge once the copy squeezed the row — on the
  // device these owners will open it on, since a text message is the whole delivery mechanism.
  it('stacks below sm and makes the button full-width there', () => {
    expect(claimBar).toMatch(/flex-col items-stretch[\s\S]{0,240}sm:flex-row/);
    expect(claimBar).toMatch(/flex-1 rounded-full bg-amber-400[\s\S]{0,120}sm:flex-none/);
  });
});

describe("the \"I'm Interested In\" picker", () => {
  // ⚠️ REQUIRED, and filled with Google Places CATEGORY labels — "Mexican restaurant", "Burrito
  // restaurant", "Restaurant" — so a hungry person had to choose a nonsense answer before the form
  // would send. All 127 listing-import drafts were in that state, and it is the only contact path.
  it('is hidden on restaurants and person sites', () => {
    expect(contact).toMatch(/hideServicePicker/);
    expect(contact).toMatch(/industryKey === 'restaurant' \|\| isPersonTemplate/);
  });

  it('is never a required field', () => {
    const at = contact.indexOf('name="service"');
    expect(at).toBeGreaterThan(-1);
    // ⚠️ Strip comments first. The first version of this matched the bare word `required` and
    // failed on the COMMENT explaining why the attribute was removed — a check firing on correct
    // code, which is the failure mode that trains people to ignore test output.
    const attrs = contact.slice(at, at + 500).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(attrs).not.toMatch(/\brequired\b/);
  });
});

describe('the bottom bars form one stack instead of sharing a pixel', () => {
  const orderBar = readFileSync(
    join(process.cwd(), 'components/admin/templates/render-blocks/order-bar.tsx'),
    'utf8',
  );
  const hearThis = readFileSync(join(process.cwd(), 'components/hear-this-page.tsx'), 'utf8');

  // ⚠️ All three were positioned against the viewport with no knowledge of each other: claim bar
  // and order bar both `bottom-0`, launcher at `bottom-4`. Highest z-index won; the rest were
  // underneath it, including the order bar's Call and View Menu actions.
  it('the claim bar publishes its measured height', () => {
    expect(claimBar).toMatch(/useFixedBottomVar<HTMLDivElement>\('--qs-claimbar-h'\)/);
    expect(claimBar).toMatch(/ref=\{barRef\}/);
  });

  it('the order bar sits above the claim bar and publishes its own height', () => {
    expect(orderBar).toMatch(/bottom: 'var\(--qs-claimbar-h, 0px\)'/);
    expect(orderBar).toMatch(/useFixedBottomVar<HTMLDivElement>\('--qs-orderbar-h'\)/);
    expect(orderBar).not.toMatch(/fixed inset-x-0 bottom-0/);
  });

  it('the audio launcher clears both', () => {
    expect(hearThis).toMatch(/--qs-claimbar-h[\s\S]{0,40}--qs-orderbar-h/);
    expect(hearThis).not.toMatch(/fixed bottom-4 left-4/);
  });

  // ⚠️ A hard-coded offset would be right for one combination of copy and wrong the moment it
  // changes — correct in the screenshot that prompted it, broken silently everywhere else.
  it('measures rather than assuming a height', () => {
    const hook = readFileSync(join(process.cwd(), 'lib/ui/useFixedBottomVar.ts'), 'utf8');
    expect(hook).toMatch(/ResizeObserver/);
    expect(hook).toMatch(/removeProperty/); // a stale var leaves the stack floating over a gap
  });
});
