/**
 * @jest-environment jsdom
 */
// The SecondSet block must not claim a shop uses a pilot it has never heard of.
//
// ⚠️ WHAT IT USED TO SAY, UNCONDITIONALLY, ON EVERY AUTO-SHOP DRAFT:
//   "🔧 Powered by SecondSet — Our techs document the actual problem … so you approve the repair
//    before we start."
// First person, present tense, on pages we auto-build for shops that have never heard of SecondSet
// and could not use it if they wanted to (the pilot is behind SECONDSET_ENABLED, nobody enrolled).
// Same class as the scaffold FAQ asserting a stranger was "fully licensed and insured" (#787) —
// worse, because a driver could pick this shop expecting to approve photos before work.
import { render, screen } from '@testing-library/react';
import ServiceTransparency from '../service-transparency';

describe('a shop that has NOT enrolled (the default)', () => {
  it('says eligible, not powered by', () => {
    render(<ServiceTransparency content={{} as any} businessName="La Tranca Auto Repair" />);
    expect(screen.getByText(/Eligible for the SecondSet pilot/)).toBeTruthy();
    expect(screen.queryByText(/Powered by SecondSet/)).toBeNull();
  });

  it('never speaks in the shop’s first person', () => {
    const { container } = render(<ServiceTransparency content={{} as any} businessName="La Tranca Auto Repair" />);
    const t = container.textContent ?? '';
    expect(t).not.toContain('Our techs');
    expect(t).not.toContain('before we start');
  });

  it('names the shop and says plainly it is not switched on', () => {
    const { container } = render(<ServiceTransparency content={{} as any} businessName="La Tranca Auto Repair" />);
    const t = container.textContent ?? '';
    expect(t).toContain('La Tranca Auto Repair is eligible to join');
    expect(t).toContain('isn’t switched on yet');
  });

  // The user's other constraint: it must not read as an obligation.
  it('says it is optional', () => {
    const { container } = render(<ServiceTransparency content={{} as any} />);
    expect(container.textContent ?? '').toContain('optional');
  });

  it('labels the steps as hypothetical, not current practice', () => {
    render(<ServiceTransparency content={{} as any} />);
    expect(screen.getByText(/How it would work/i)).toBeTruthy();
  });

  it('offers the explainer so the badge is not a mystery', () => {
    const { container } = render(<ServiceTransparency content={{} as any} />);
    expect(container.querySelector('a[href="/secondset"]')).toBeTruthy();
  });

  it('falls back to "This shop" rather than an empty gap', () => {
    const { container } = render(<ServiceTransparency content={{} as any} />);
    expect(container.textContent ?? '').toContain('This shop is eligible to join');
  });
});

describe('a shop that HAS enrolled', () => {
  it('may speak in the first person — it is theirs to say', () => {
    const { container } = render(<ServiceTransparency content={{ enrolled: true } as any} />);
    expect(screen.getByText(/Powered by SecondSet/)).toBeTruthy();
    expect(container.textContent ?? '').toContain('Our techs');
    expect(screen.queryByText(/How it would work/i)).toBeNull();
  });
});

describe('the default is the safe one', () => {
  // ⚠️ Forgetting the flag must produce the INVITATION, never the claim.
  it.each([undefined, {}, { enrolled: false }, { enrolled: 'yes' }, { enrolled: 1 }])(
    'content %p is treated as not enrolled',
    (content) => {
      const { container, unmount } = render(<ServiceTransparency content={content as any} />);
      expect(container.textContent ?? '').not.toContain('Our techs');
      unmount();
    },
  );
});

describe('naming the shop', () => {
  // ⚠️ data.meta.business_name is the field actually populated on a listing-import draft — verified
  // against a live row. The top-level business_name is not carried into the render object, so a
  // fallback chain that only checks it silently produces the generic "This shop".
  it('reads the name from the template the renderer already passes', () => {
    const { container } = render(
      <ServiceTransparency
        content={{} as any}
        template={{ data: { meta: { business_name: 'La Tranca Auto Repair' } } } as any}
      />,
    );
    expect(container.textContent ?? '').toContain('La Tranca Auto Repair is eligible to join');
  });

  it('prefers an explicit prop over the template', () => {
    const { container } = render(
      <ServiceTransparency
        content={{} as any}
        businessName="Felix Auto Repair"
        template={{ data: { meta: { business_name: 'Wrong Shop' } } } as any}
      />,
    );
    expect(container.textContent ?? '').toContain('Felix Auto Repair is eligible');
  });
});
