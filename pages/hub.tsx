import Link from 'next/link';

export default function HubPage() {
  return (
    <div className="text-white p-6 max-w-2xl mx-auto text-center">
      <h1 className="text-4xl font-bold mb-4">🌐 Welcome to QuickSites</h1>
      <p className="text-zinc-400 mb-8">Launch your transparent site. Fast. Free. Yours.</p>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <Link href="/starter" className="bg-blue-700 px-4 py-3 rounded">🚀 Get Started</Link>
        <Link href="/template-market" className="bg-zinc-800 px-4 py-3 rounded">🎨 Templates</Link>
        <Link href="/transparency" className="bg-zinc-800 px-4 py-3 rounded">🔍 Transparency</Link>
        <Link href="/timeline" className="bg-zinc-800 px-4 py-3 rounded">📈 Timeline</Link>
        <Link href="/hall-of-fame" className="bg-zinc-800 px-4 py-3 rounded">🏅 Hall of Fame</Link>
        <Link href="/trust" className="bg-zinc-800 px-4 py-3 rounded">🛡 Trust</Link>
      </div>
    </div>
  );
}
