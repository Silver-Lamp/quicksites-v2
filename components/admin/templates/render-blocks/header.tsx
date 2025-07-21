'use client';

import type { Block } from '@/types/blocks';
import Image from 'next/image';
import Link from 'next/link';

type Props = {
  block: Extract<Block, { type: 'header' }>;
};

export default function PageHeader({ block }: Props) {
  const { logoUrl, navItems } = block.content;

  return (
    <header className="bg-black text-white">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
        {logoUrl && (
          <Link href="/" className="flex items-center">
            <Image src={logoUrl} alt="Site Logo" width={50} height={50} className="h-10 w-auto" />
          </Link>
        )}
        <nav className="flex gap-8 text-sm font-medium">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:text-yellow-400 transition-colors duration-200"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
