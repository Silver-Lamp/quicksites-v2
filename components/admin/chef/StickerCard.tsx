// components/admin/chef/StickerCard.tsx
'use client';


import StickerDesigner from '@/components/admin/chef/sticker-designer';


export default function StickerCard({
merchantId,
merchantName,
}: {
merchantId: string;
merchantName: string;
}) {
return (
<div className="rounded-2xl border p-4">
<h2 className="text-base font-semibold mb-2">Stickers</h2>
<StickerDesigner merchantId={merchantId} merchantName={merchantName} />
</div>
);
}