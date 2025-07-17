'use client';

import type { Block } from '@/types/blocks';
import Link from 'next/link';
import SectionShell from '@/components/ui/section-shell';

type FooterBlock = Extract<Block, { type: 'footer' }>;

type Props = {
  block?: FooterBlock;
  content?: FooterBlock['content'];
  compact?: boolean;
};

export default function FooterRender({ block, content, compact = false }: Props) {
  const final = content || block?.content;

  if (!final) {
    return (
      <div className="text-red-500 italic text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
        ⚠️ Missing footer block content.
      </div>
    );
  }

  const {
    businessName = 'Business',
    address = '123 Main St',
    cityState = 'Your City, ST',
    phone = '(555) 555-5555',
    links = [],
  } = final;

  if (compact) {
    return (
      <SectionShell compact className="bg-neutral-900 text-white text-xs rounded" textAlign="left">
        <p className="font-semibold">{businessName}</p>
        <p className="text-gray-400">{cityState}</p>
      </SectionShell>
    );
  }

  return (
    <footer className="bg-black text-white px-6 py-10 text-sm mt-10">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-8">
        <div>
          <h4 className="font-bold uppercase mb-3">Quick Links</h4>
          <ul className="space-y-1">
            {links.map((link, i) => (
              <li key={i}>
                <Link href={link.href} className="text-yellow-400 hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-bold uppercase mb-3">Company Info</h4>
          <p className="text-white font-semibold">{businessName}</p>
          <p>
            {address}
            <br />
            {cityState}
          </p>
          <p className="mt-1">{phone}</p>
        </div>
      </div>
      <div className="text-center mt-8 text-xs text-gray-400">
        © 2025 {businessName}. Fast, Reliable, Local Service 24/7.
      </div>
    </footer>
  );
}
