'use client';

import type { Block } from '@/types/blocks';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

type Props = {
  block: Extract<Block, { type: 'header' }>;
  previewOnly?: boolean;
};

export default function PageHeader({ block, previewOnly = false }: Props) {
  const { logoUrl, navItems } = block.content;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="w-full text-white">
      <div className="w-full mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
        {/* Logo */}
        {logoUrl && (
          <Link href="/" className="flex items-center">
            <Image
              src={logoUrl}
              alt="Site Logo"
              width={60}
              height={60}
              className="h-[60px] w-auto rounded"
              priority
            />
          </Link>
        )}

        {/* Desktop nav */}
        <nav className="hidden md:flex gap-8 text-sm font-medium">
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

        {/* Hamburger icon (mobile) */}
        {!previewOnly ? (
          <button
            className="md:hidden text-white"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        ) : (
          <div className="md:hidden text-white opacity-50">
            <Menu size={24} />
          </div>
        )}
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && !previewOnly && (
        <div className="md:hidden bg-neutral-950 px-4 pb-4 space-y-2 text-sm font-medium">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block hover:text-yellow-400 transition-colors duration-200"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
