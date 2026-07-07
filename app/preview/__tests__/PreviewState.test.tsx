import * as React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import PreviewState from '../PreviewState';

// Capture what colorMode / className the renderer receives.
jest.mock('@/components/sites/editor-site-renderer', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="renderer" data-mode={props.colorMode} data-cls={props.className} />
  ),
}));

const renderer = () => screen.getByTestId('renderer');
// The base className carries `dark:` utilities; we care about the standalone `dark`
// class token (added only in dark mode), not the substring.
const hasDarkClass = () => (renderer().getAttribute('data-cls') ?? '').split(/\s+/).includes('dark');

function setup(props: Partial<React.ComponentProps<typeof PreviewState>> = {}) {
  return render(
    <PreviewState
      initialSite={{ id: 't1', color_mode: 'light', data: { pages: [{ slug: 'home', blocks: [] }] } }}
      page="home"
      colorMode="light"
      className="bg-white text-black dark:bg-black dark:text-white"
      {...props}
    />,
  );
}

describe('PreviewState color toggle', () => {
  it('shows the floating toggle on the standalone preview and starts in the template mode', () => {
    setup();
    expect(screen.getByRole('group', { name: /preview color mode/i })).toBeTruthy();
    expect(renderer().getAttribute('data-mode')).toBe('light');
    expect(hasDarkClass()).toBe(false);
  });

  it('flips the rendered color mode (and adds the dark class) when Dark is clicked', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /dark/i }));
    expect(renderer().getAttribute('data-mode')).toBe('dark');
    expect(hasDarkClass()).toBe(true);
  });

  it('hides the toggle when embedded in the editor (editorChrome)', () => {
    setup({ editorChrome: true });
    expect(screen.queryByRole('group', { name: /preview color mode/i })).toBeNull();
  });

  it('follows an editor-driven color change event', () => {
    setup();
    expect(renderer().getAttribute('data-mode')).toBe('light');
    act(() => {
      window.dispatchEvent(new CustomEvent('qs:preview:set-color-mode', { detail: 'dark' }));
    });
    expect(renderer().getAttribute('data-mode')).toBe('dark');
  });
});
