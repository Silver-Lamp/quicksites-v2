/**
 * @jest-environment jsdom
 */
// One service must not render as a numbered list.
//
// ⚠️ THE PAGE THAT PROMPTED THIS. A listing import derives services from Google categories, which
// for most non-food businesses is exactly one. Every auto-shop draft rendered:
//
//     Our Services
//     01   Car Repair
//
// …on a business named "La Tranca Auto Repair". The "01" promises an "02" that never comes. It
// reads as a rendering bug, and the first thing an owner sees is a page that looks half-built.
//
// The CONTENT is deliberately untouched: a lone "Transmission Shop" is more specific than "auto
// repair" and is worth showing. This is presentation only.
import { render, screen } from '@testing-library/react';
import ServicesBlock from '../services';

const tpl = (services: string[]) => ({ data: { services } });

function renderBlock(services: string[], variant?: string) {
  return render(
    <ServicesBlock
      block={{ type: 'services', content: variant ? { variant } : {} } as any}
      template={tpl(services) as any}
    />,
  );
}

describe('a single service', () => {
  it.each(['cards', 'rows'])('drops the ordinal in the %s variant', (variant) => {
    const { container, unmount } = renderBlock(['Car Repair'], variant);
    expect(screen.getByText('Car Repair')).toBeTruthy();
    // ⚠️ NO \b HERE. The DOM text is "Our Services01Brake Shop" — "s" and "0" are both word
    // characters, so \b never matches between them. A boundary-anchored regex reported "no
    // ordinals" for output that plainly had them, and I nearly "fixed" working code because of it.
    expect(container.textContent ?? '').not.toContain('01');
    unmount();
  });

  it('still shows the service itself — content is not suppressed', () => {
    renderBlock(['Transmission Shop']);
    expect(screen.getByText('Transmission Shop')).toBeTruthy();
  });
});

describe('two or more services', () => {
  it.each(['cards', 'rows'])('keeps the numbering in the %s variant', (variant) => {
    const { container, unmount } = renderBlock(['Brake Shop', 'Oil Change', 'Tires'], variant);
    expect(container.textContent ?? '').toContain('01');
    expect(container.textContent ?? '').toContain('02');
    unmount();
  });
});

describe('none', () => {
  // Existing rule, asserted so the single-item change cannot disturb it: an empty services block
  // renders nothing in public — same as a missing backdrop or an unrecovered menu.
  it('renders nothing in public', () => {
    const { container } = renderBlock([]);
    expect(container.textContent?.trim()).toBe('');
  });
});
