/**
 * @jest-environment jsdom
 */
// The product GALLERY: a products_grid with no catalog ids but a display-only snapshot (products
// read from the original store) renders the products — in their own currency, with no cart —
// instead of nothing. A ¥ price must never print as a $ price.

import * as React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children }: any) => <a href={href}>{children}</a> }));

import RenderProductsGrid, { formatSnapshotPrice } from '@/components/admin/templates/render-blocks/products-grid';

beforeAll(() => {
  (global as any).fetch = jest.fn(async () => ({ ok: true, json: async () => ({ products: [] }) }));
});

const block: any = {
  _id: 'b1',
  type: 'products_grid',
  content: {
    title: 'Shop',
    columns: 3,
    productIds: [],
    products: [
      { id: 'spu-1', title: '180克男士纯棉圆领短袖T恤', price_cents: 2101, currency: 'CNY', price_from: true, image_url: '', product_url: 'https://jit.hicustom.com/spu?id=1' },
      { id: 'spu-2', title: '三明治棒球帽', price_cents: 2451, currency: 'CNY', image_url: 'https://nimg5.hicustom.com/cap.jpg' },
    ],
  },
};

describe('formatSnapshotPrice', () => {
  it('prints CNY as yuan, never as dollars, and honours from', () => {
    const s = formatSnapshotPrice({ price_cents: 2101, currency: 'CNY', price_from: true });
    expect(s).toMatch(/^from /);
    expect(s).toMatch(/21\.01/);
    expect(s).not.toMatch(/\$21/);
  });
  it('treats JPY as zero-decimal', () => {
    expect(formatSnapshotPrice({ price_cents: 1980, currency: 'JPY' })).toMatch(/1,?980/);
  });
});

describe('products_grid snapshot gallery', () => {
  it('renders the snapshot products with their own-currency prices and no Add to Cart', async () => {
    render(<RenderProductsGrid block={block} />);
    expect(await screen.findByText('180克男士纯棉圆领短袖T恤')).toBeTruthy();
    expect(screen.getByText('三明治棒球帽')).toBeTruthy();
    expect(document.body.textContent).toMatch(/from /);
    expect(document.body.textContent).toMatch(/21\.01/);
    expect(document.body.textContent).not.toMatch(/\$21\.01/);
    expect(screen.queryByText('Add to Cart')).toBeNull();
    expect(document.querySelector('[data-products-grid="snapshot"]')).not.toBeNull();
  });

  it('links a product to its original page when the store gave us one', async () => {
    render(<RenderProductsGrid block={block} />);
    await screen.findByText('180克男士纯棉圆领短袖T恤');
    const a = document.querySelector('a[href="https://jit.hicustom.com/spu?id=1"]');
    expect(a).not.toBeNull();
    expect(a!.getAttribute('rel')).toMatch(/noopener/);
  });

  it('renders nothing in public when there is neither a snapshot nor ids', async () => {
    const { container } = render(<RenderProductsGrid block={{ ...block, content: { ...block.content, products: [] } }} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).toBe('');
  });

  it('does not let a stale snapshot shadow wired catalog ids', async () => {
    (global as any).fetch = jest.fn(async () => ({ ok: true, json: async () => ({ products: [{ id: 'real', title: 'Live item', price_cents: 500 }] }) }));
    render(<RenderProductsGrid block={{ ...block, content: { ...block.content, productIds: ['real'] } }} />);
    expect(await screen.findByText('Live item')).toBeTruthy();
    expect(screen.queryByText('三明治棒球帽')).toBeNull();
  });
});
