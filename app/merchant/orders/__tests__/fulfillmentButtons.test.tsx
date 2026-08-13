/**
 * @jest-environment jsdom
 */
// The kitchen controls, rendered.
//
// ⚠️ WHY THIS EXISTS RATHER THAN A SCREENSHOT. /merchant/orders is behind auth and a session
// wasn't available, so the page could not be opened to look at it. That is precisely the situation
// that let the site-download button ship inside a file nothing imported — route fine, tests fine,
// button absent from every page. So two things are checked here without a login: the component
// renders real controls, and page.tsx actually mounts it.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import FulfillmentButtons from '../fulfillment-buttons';

const PAGE = join(process.cwd(), 'app/merchant/orders/page.tsx');

describe('the page mounts it', () => {
  const src = readFileSync(PAGE, 'utf8');

  it('imports the control', () => {
    expect(src).toMatch(/import FulfillmentButtons from '\.\/fulfillment-buttons'/);
  });

  // Named explicitly. A generic "some component is rendered" assertion would have passed while the
  // control sat in an unmounted file.
  it('renders it in the table', () => {
    expect(src).toMatch(/<FulfillmentButtons/);
    expect(src).toMatch(/orderId=\{o\.id\}/);
  });

  it('gives it the order’s own status rather than a hardcoded default', () => {
    expect(src).toMatch(/fulfillment_status \?\? DEFAULT_FULFILLMENT/);
  });
});

describe('what a merchant sees', () => {
  it('shows the state and the action for a new order', () => {
    render(<FulfillmentButtons orderId="o1" initial="new" />);
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start preparing' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('offers the way back from preparing', () => {
    render(<FulfillmentButtons orderId="o1" initial="preparing" />);
    expect(screen.getByRole('button', { name: 'Ready for pickup' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  it('never renders a row with no action at all', () => {
    for (const s of ['new', 'preparing', 'ready', 'completed', 'cancelled'] as const) {
      const { unmount } = render(<FulfillmentButtons orderId="o1" initial={s} />);
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
      unmount();
    }
  });
});

describe('pressing a button', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('posts the target status to the order’s own endpoint', async () => {
    const spy = jest.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })) as any;
    global.fetch = spy;
    render(<FulfillmentButtons orderId="order-123" initial="new" />);
    fireEvent.click(screen.getByRole('button', { name: 'Start preparing' }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy.mock.calls[0][0]).toBe('/api/merchant/orders/order-123/fulfillment');
    expect(JSON.parse(spy.mock.calls[0][1].body)).toEqual({ status: 'preparing' });
  });

  // On a counter tablet with bad wifi, a button that does nothing visible gets pressed again.
  it('moves immediately rather than waiting for the server', async () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as any; // never resolves
    render(<FulfillmentButtons orderId="o1" initial="new" />);
    fireEvent.click(screen.getByRole('button', { name: 'Start preparing' }));
    await waitFor(() => expect(screen.getByText('Preparing')).toBeTruthy());
  });

  // ⚠️ The other half of optimistic: the screen must not keep a state the database rejected.
  // A kitchen trusting a stale green badge is worse than one that saw an error.
  it('rolls back and says why when the save fails', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Forbidden' }),
    })) as any;
    render(<FulfillmentButtons orderId="o1" initial="new" />);
    fireEvent.click(screen.getByRole('button', { name: 'Start preparing' }));
    await waitFor(() => expect(screen.getByText('Forbidden')).toBeTruthy());
    expect(screen.getByText('New')).toBeTruthy();
  });

  it('rolls back when the network is unreachable', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('offline');
    }) as any;
    render(<FulfillmentButtons orderId="o1" initial="ready" />);
    fireEvent.click(screen.getByRole('button', { name: 'Picked up' }));
    await waitFor(() => expect(screen.getByText(/Couldn’t reach the server/)).toBeTruthy());
    expect(screen.getByText('Ready for pickup')).toBeTruthy();
  });
});
