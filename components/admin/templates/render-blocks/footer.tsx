'use client';

import type { FooterBlock } from '@/types/blocks';
import Link from 'next/link';

export default function FooterBlock({ content }: { content: FooterBlock }) {
  return (
    <footer className="bg-black text-white px-6 py-10 text-sm mt-10">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-8">
        <div>
          <h4 className="font-bold uppercase mb-3">Quick Links</h4>
          <ul className="space-y-1">
            {content.content.links.map((link, i) => (
              <li key={i}>
                <Link href={link.href} className="text-yellow-400 hover:underline">{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-bold uppercase mb-3">Company Info</h4>
          <p className="text-white font-semibold">{content.content.businessName}</p>
          <p>{content.content.address}<br />{content.content.cityState}</p>
          <p className="mt-1">{content.content.phone}</p>
        </div>
      </div>
      <div className="text-center mt-8 text-xs text-gray-400">
        © 2025 {content.content.businessName}. Fast, Reliable, Local Service 24/7.
      </div>
    </footer>
  );
}
