// components/admin/dev/seeder/sections/MerchantsProductsSection.tsx
'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { SubHeaderBar } from '../ui/HeaderBar';
import { MerchantProfileSection } from './MerchantProfileSection';

type ProductType = 'meal'|'physical'|'digital'|'service'|'mixed';

type Props = {
  // products
  productsCount: number;
  setProductsCount: (n: number) => void;

  productsProductType: ProductType;
  setProductsProductType: (t: ProductType) => void;

  productsGenerateImages: boolean;
  setProductsGenerateImages: (v: boolean) => void;

  productsImageStyle: 'photo' | 'illustration';
  setProductsImageStyle: (v: 'photo' | 'illustration') => void;

  productsImageSize: '256x256' | '512x512' | '1024x1024';
  setProductsImageSize: (v: '256x256' | '512x512' | '1024x1024') => void;

  // NEW (optional) – images per product
  productsImagesPerItem?: number;
  setProductsImagesPerItem?: (n: number) => void;

  // merchant profile (advanced)
  merchantProfileOpen: boolean;
  setMerchantProfileOpen: (v: boolean) => void;

  merchantOverwrite: boolean;
  setMerchantOverwrite: (v: boolean) => void;

  merchantLogo: boolean;
  setMerchantLogo: (v: boolean) => void;

  merchantLogoStyle: 'photo' | 'illustration';
  setMerchantLogoStyle: (v: 'photo' | 'illustration') => void;

  merchantLogoSize: '256x256' | '512x512' | '1024x1024';
  setMerchantLogoSize: (v: '256x256' | '512x512' | '1024x1024') => void;
};

export function MerchantsProductsSection({
  productsCount, setProductsCount,
  productsProductType, setProductsProductType,
  productsGenerateImages, setProductsGenerateImages,
  productsImageStyle, setProductsImageStyle,
  productsImageSize, setProductsImageSize,
  productsImagesPerItem, setProductsImagesPerItem,
  merchantProfileOpen, setMerchantProfileOpen,
  merchantOverwrite, setMerchantOverwrite,
  merchantLogo, setMerchantLogo,
  merchantLogoStyle, setMerchantLogoStyle,
  merchantLogoSize, setMerchantLogoSize,
}: Props) {
  // Local fallback so this component works even if the parent hasn't added the new state yet.
  const [localImagesPerItem, setLocalImagesPerItem] = React.useState<number>(
    typeof productsImagesPerItem === 'number' ? productsImagesPerItem : 1
  );

  const handleImagesPerItem = (raw: string) => {
    const n = Math.max(0, Math.min(6, parseInt(raw || '1', 10)));
    if (setProductsImagesPerItem) setProductsImagesPerItem(n);
    setLocalImagesPerItem(n);
  };

  const effectiveImagesPerItem =
    typeof productsImagesPerItem === 'number' ? productsImagesPerItem : localImagesPerItem;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <Label>Products Count</Label>
          <Input
            type="number"
            min={1}
            max={48}
            value={productsCount}
            onChange={(e) =>
              setProductsCount(Math.max(1, Math.min(48, parseInt(e.target.value || '1', 10))))}
          />
        </div>
        <div>
          <Label>Default Product Type</Label>
          <select
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-900"
            value={productsProductType}
            onChange={(e) => setProductsProductType(e.target.value as ProductType)}
          >
            <option value="meal">meal</option>
            <option value="physical">physical</option>
            <option value="digital">digital</option>
            <option value="service">service</option>
            <option value="mixed">mixed</option>
          </select>
        </div>
        <div className="hidden md:block" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={productsGenerateImages}
              onChange={(e) => setProductsGenerateImages(e.target.checked)}
            />
            Product photos (AI)
          </label>
        </div>

        {productsGenerateImages && (
          <>
            <div>
              <Label>Product Image Style</Label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-900"
                value={productsImageStyle}
                onChange={(e) => setProductsImageStyle(e.target.value as 'photo' | 'illustration')}
              >
                <option value="photo">photo</option>
                <option value="illustration">illustration</option>
              </select>
            </div>

            <div>
              <Label>Product Image Size</Label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-900"
                value={productsImageSize}
                onChange={(e) =>
                  setProductsImageSize(e.target.value as '256x256' | '512x512' | '1024x1024')}
              >
                <option value="256x256">256x256</option>
                <option value="512x512">512x512</option>
                <option value="1024x1024">1024x1024</option>
              </select>
            </div>

            {/* NEW: Images per product */}
            <div className="md:col-span-1">
              <Label>Images per product</Label>
              <Input
                className="mt-1"
                type="number"
                min={0}
                max={6}
                value={effectiveImagesPerItem}
                onChange={(e) => handleImagesPerItem(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                0 = no images. This also feeds the cost estimator when enabled.
              </p>
            </div>
          </>
        )}
      </div>

      <Collapsible
        open={merchantProfileOpen}
        onOpenChange={setMerchantProfileOpen}
        className="rounded-md border"
      >
        <SubHeaderBar title="Merchant Profile (advanced)" open={merchantProfileOpen} />
        <CollapsibleContent className="px-3 pb-3 pt-1">
          <MerchantProfileSection
            merchantOverwrite={merchantOverwrite}
            setMerchantOverwrite={setMerchantOverwrite}
            merchantLogo={merchantLogo}
            setMerchantLogo={setMerchantLogo}
            merchantLogoStyle={merchantLogoStyle}
            setMerchantLogoStyle={setMerchantLogoStyle}
            merchantLogoSize={merchantLogoSize}
            setMerchantLogoSize={setMerchantLogoSize}
          />
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
