/** @jest-environment jsdom */
import * as React from 'react';
import { render, act } from '@testing-library/react';
import { requestBlockAiFocus, useBlockAiFocus } from '../blockAiFocus';

function Panel({ id }: { id: string }) {
  const ref = useBlockAiFocus<HTMLDivElement>(id);
  return <div ref={ref} data-testid={`panel-${id}`}>AI</div>;
}

beforeAll(() => {
  // jsdom doesn't implement scrollIntoView.
  (Element.prototype as any).scrollIntoView = jest.fn();
});
beforeEach(() => (Element.prototype.scrollIntoView as jest.Mock).mockClear());

test('a request made before the editor mounts flashes + scrolls the matching panel', () => {
  requestBlockAiFocus('b1');
  const { getByTestId } = render(<Panel id="b1" />);
  const el = getByTestId('panel-b1');
  expect(el.classList.contains('qs-ai-flash')).toBe(true);
  expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
});

test('a request while the editor is already open flashes the matching panel', () => {
  const { getByTestId } = render(<Panel id="b2" />);
  const el = getByTestId('panel-b2');
  expect(el.classList.contains('qs-ai-flash')).toBe(false);
  act(() => requestBlockAiFocus('b2'));
  expect(el.classList.contains('qs-ai-flash')).toBe(true);
});

test('a request for a different block does not flash this panel', () => {
  const { getByTestId } = render(<Panel id="b3" />);
  act(() => requestBlockAiFocus('someone-else'));
  expect(getByTestId('panel-b3').classList.contains('qs-ai-flash')).toBe(false);
});
