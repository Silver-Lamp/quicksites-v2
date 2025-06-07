import Link from 'next/link';
import Image from 'next/image';

export default function LaunchPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto text-white text-center">
      <h1 className="text-4xl font-bold mb-4">🌐 The Web is Yours Again</h1>
      <p className="text-zinc-400 mb-6 text-lg">
        Launch a transparent site in minutes. Remix templates. Steward your signal.
      </p>

      <div className="flex justify-center mb-6">
        <Image
          src="/press/quicksites-logo.png"
          alt="QuickSites Logo"
          width={180}
          height={60}
          className="rounded bg-white p-2"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <Link href="/template-market" className="bg-blue-700 hover:bg-blue-800 px-6 py-3 rounded text-sm font-medium">
          🎨 Explore Templates
        </Link>
        <Link href="/early-access" className="bg-zinc-800 hover:bg-zinc-700 px-6 py-3 rounded text-sm font-medium">
          🔐 Get Early Access
        </Link>
        <Link href="/manifesto" className="bg-zinc-800 hover:bg-zinc-700 px-6 py-3 rounded text-sm font-medium">
          📜 Join the Movement
        </Link>
      </div>

      <div className="text-xs text-zinc-500">
        Built with . : . Steward-led, open-source, human-first.
      </div>
    </div>
  );
}
