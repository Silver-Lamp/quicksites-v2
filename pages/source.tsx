export default function SourcePage() {
  return (
    <div className="max-w-2xl mx-auto p-6 text-white">
      <h1 className="text-3xl font-bold mb-4">🧩 Source & Licensing</h1>
      <p className="text-zinc-300 mb-4">
        QuickSites is open infrastructure. You can fork it, remix it, improve it, or run it locally.
      </p>
      <ul className="space-y-3 text-sm text-zinc-400">
        <li>
          🔗{' '}
          <a href="https://github.com/Silver-Lamp/quicksites-v2" className="underline">
            View Source on GitHub
          </a>
        </li>
        <li>⚖️ Licensed under MIT (with steward amendments optional)</li>
        <li>
          📦 Modules include:
          <ul className="ml-4 list-disc space-y-1">
            <li>`/starter` — AI onboarding</li>
            <li>`/transparency` — audit layer</li>
            <li>`/edit/[slug]` — live block editor</li>
            <li>`/claim` — civic registrar</li>
          </ul>
        </li>
      </ul>
      <p className="text-xs text-zinc-600 mt-6">
        If you improve this, let us know. If you fork it, we wish you sunlight.
      </p>
    </div>
  );
}
