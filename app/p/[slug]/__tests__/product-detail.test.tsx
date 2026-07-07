import * as React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ProductDetail from '../product-detail';

// Stub the heavy cart child; expose a hook to fire the variant-image callback so we
// can test that a selected variant's image overrides the browsed gallery image.
jest.mock('../add-to-cart', () => ({
  __esModule: true,
  default: ({ onActiveImage }: { onActiveImage?: (u: string | null) => void }) => (
    <button type="button" onClick={() => onActiveImage?.('https://cdn.shopify.com/variant.png')}>
      pick-variant-image
    </button>
  ),
}));

const IMAGES = [
  'https://cdn.shopify.com/1.png',
  'https://cdn.shopify.com/2.png',
  'https://cdn.shopify.com/3.png',
];

function renderDetail(images: string[]) {
  return render(
    <ProductDetail
      id="cat_1"
      title="Who Calls the Shots?"
      description="A card game."
      productType="product"
      priceCents={2999}
      fromPrice={2999}
      hasVariants={false}
      mainImage={images[0] ?? null}
      images={images}
      variants={[]}
      axes={[]}
      itemStock={null}
      merchantId="merch_1"
    />,
  );
}

const mainImg = () => screen.getByAltText('Who Calls the Shots?') as HTMLImageElement;

describe('ProductDetail gallery', () => {
  it('shows a thumbnail per image and leads with the first', () => {
    renderDetail(IMAGES);
    const strip = screen.getByRole('list', { name: /product images/i });
    expect(within(strip).getAllByRole('listitem')).toHaveLength(3);
    expect(mainImg().src).toBe('https://cdn.shopify.com/1.png');
  });

  it('swaps the main image when a thumbnail is clicked', () => {
    renderDetail(IMAGES);
    fireEvent.click(screen.getByLabelText('View image 3'));
    expect(mainImg().src).toBe('https://cdn.shopify.com/3.png');
  });

  it('renders no thumbnail strip for a single image', () => {
    renderDetail([IMAGES[0]]);
    expect(screen.queryByRole('list', { name: /product images/i })).toBeNull();
    expect(mainImg().src).toBe('https://cdn.shopify.com/1.png');
  });

  it('lets a selected variant image win, and a thumbnail click takes it back', () => {
    renderDetail(IMAGES);
    fireEvent.click(screen.getByText('pick-variant-image'));
    expect(mainImg().src).toBe('https://cdn.shopify.com/variant.png');
    fireEvent.click(screen.getByLabelText('View image 2'));
    expect(mainImg().src).toBe('https://cdn.shopify.com/2.png');
  });
});
