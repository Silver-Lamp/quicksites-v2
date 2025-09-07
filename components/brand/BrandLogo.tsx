// components/brand/BrandLogo.tsx
'use client';
import Image from 'next/image';
import { useBrand } from '@/app/providers';

export default function BrandLogo({ className = 'h-6 w-auto' }) {
  const { logoUrl, darkLogoUrl, name } = useBrand();
  // optional: choose based on theme
  return <Image src={logoUrl} alt={`${name} logo`} width={120} height={32} className={className} />;
}
