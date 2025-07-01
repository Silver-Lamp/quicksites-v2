'use client';
import { NextSeo } from 'next-seo';
import { usePageSeo } from '@/lib/usePageSeo';
import Image from 'next/image';
import Link from 'next/link';

export default function PressPage() {
  return (
    <>
      <NextSeo
        {...usePageSeo({
          description: 'Press page.',
        })}
      />
      <div className="p-6 max-w-3xl mx-auto text-white">
        <h1 className="text-3xl font-bold mb-4">📣 QuickSites Press Kit</h1>

        <p className="text-zinc-400 mb-6">
          QuickSites is a transparent publishing layer for human-centered presence. Open-source,
          steward-led, and remixable.
        </p>

        <h2 className="text-xl font-semibold mb-2">🎨 Logos & Media</h2>
        <div className="mb-4 space-x-4">
          <a href="/press/quicksites-logo.svg" className="underline text-blue-400" download>
            Download SVG
          </a>
          <a href="/press/quicksites-logo.png" className="underline text-blue-400" download>
            Download PNG
          </a>
        </div>
        <Image
          src="/press/quicksites-logo.png"
          alt="QuickSites Logo"
          width={200}
          height={80}
          className="mb-6 bg-white p-2 rounded"
        />

        <h2 className="text-xl font-semibold mb-2">📸 Screenshots</h2>
        <div className="mb-6">
          <Image
            src="/press/site-preview.png"
            alt="Site Screenshot"
            width={600}
            height={320}
            className="rounded border border-zinc-700"
          />
        </div>

        <h2 className="text-xl font-semibold mb-2">📰 Description</h2>
        <p className="text-zinc-300 mb-6 text-sm">
          QuickSites lets anyone launch a fully transparent site in minutes, remix existing
          templates, and track civic impact via referral chains and remix trees. Built with
          simplicity, shared stewardship, and sunlight.
        </p>

        <h2 className="text-xl font-semibold mb-2">📬 Contact</h2>
        <p className="text-sm text-zinc-400">
          For press inquiries or interviews, email:{' '}
          <code className="text-white">press@quicksites.ai</code>
        </p>
      </div>
    </>
  );
}
