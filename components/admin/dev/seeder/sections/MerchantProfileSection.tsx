// components/admin/dev/seeder/sections/MerchantProfileSection.tsx
'use client';

import { Label } from '@/components/ui/label';

export function MerchantProfileSection({
  merchantOverwrite, setMerchantOverwrite,
  merchantLogo, setMerchantLogo,
  merchantLogoStyle, setMerchantLogoStyle,
  merchantLogoSize, setMerchantLogoSize,
}: {
  merchantOverwrite: boolean; setMerchantOverwrite: (v: boolean)=>void;
  merchantLogo: boolean; setMerchantLogo: (v: boolean)=>void;
  merchantLogoStyle: 'photo'|'illustration'; setMerchantLogoStyle: (v:'photo'|'illustration')=>void;
  merchantLogoSize: '256x256'|'512x512'|'1024x1024'; setMerchantLogoSize:(v:any)=>void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-1">
        <Label>Profile Overwrite</Label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={merchantOverwrite} onChange={(e)=>setMerchantOverwrite(e.target.checked)} />
          Overwrite existing merchant fields
        </label>
      </div>

      <div>
        <Label>Logo (AI)</Label>
        <div className="mt-1 flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={merchantLogo} onChange={(e)=>setMerchantLogo(e.target.checked)} />
            Generate merchant logo
          </label>
        </div>
      </div>

      {merchantLogo && (
        <div className="grid grid-cols-2 gap-2 md:col-span-1">
          <div>
            <Label>Logo Style</Label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-900"
              value={merchantLogoStyle}
              onChange={(e)=>setMerchantLogoStyle(e.target.value as any)}
            >
              <option value="photo">photo</option>
              <option value="illustration">illustration</option>
            </select>
          </div>
          <div>
            <Label>Logo Size</Label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-900"
              value={merchantLogoSize}
              onChange={(e)=>setMerchantLogoSize(e.target.value as any)}
            >
              <option value="256x256">256x256</option>
              <option value="512x512">512x512</option>
              <option value="1024x1024">1024x1024</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
