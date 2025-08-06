'use client';

import type { Block } from '@/types/blocks';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

type Props = {
  block: Block;
  previewOnly?: boolean;
  colorMode?: 'light' | 'dark';
};

export default function PageHeader({
  block,
  previewOnly = false,
  colorMode = 'dark', // default to dark if not passed
}: Props) {
  const { logo_url, nav_items } = block.content as unknown as {
    logo_url: string;
    nav_items: {
      label: string;
      href: string;
      appearance: string;
    }[];
  };
  const [menuOpen, setMenuOpen] = useState(false);

  const isLight = colorMode === 'light';
  const textColor = isLight ? 'text-gray-900' : 'text-white';
  const hoverColor = isLight ? 'hover:text-blue-600' : 'hover:text-yellow-400';
  const bgColor = isLight ? 'bg-white' : 'bg-neutral-950';

  return (
    <header className={`w-full ${bgColor} ${textColor}`}>
      <div className="w-full mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
        {/* Logo */}
        {logo_url && (
          <Link href="/" className="flex items-center">
            <Image
              src={logo_url}
              alt="Site Logo"
              width={60}
              height={60}
              className="h-[60px] w-auto rounded"
              priority
            />
          </Link>
        )}

        {/* Desktop nav */}
        <nav className={`hidden md:flex gap-8 text-sm font-medium`}>
          {nav_items.map((item: { href: string; label: string; appearance: string }) => (
            <Link
              key={item.href}
              href={item.href}
              className={`transition-colors duration-200 ${textColor} ${hoverColor} ${item.appearance}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Hamburger icon (mobile) */}
        {!previewOnly ? (
          <button
            className={`md:hidden ${textColor}`}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        ) : (
          <div className={`md:hidden ${textColor} opacity-50`}>
            <Menu size={24} />
          </div>
        )}
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && !previewOnly && (
        <div className={`${bgColor} px-4 pb-4 space-y-2 text-sm font-medium`}>
          {nav_items.map((item: { href: string; label: string; appearance: string }) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block transition-colors duration-200 ${textColor} ${hoverColor} ${item.appearance}`}
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
