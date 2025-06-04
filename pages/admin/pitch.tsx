// pages/pitch.tsx
import Head from 'next/head';
import Link from 'next/link';

export default function PitchLandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 to-gray-950 text-white py-20 px-6">
      <Head>
        <title>Zod Playground – From Schema to Site</title>
      </Head>
      <div className="max-w-3xl mx-auto space-y-10">
        <h1 className="text-4xl font-bold">🧪 Zod Playground</h1>
        <p className="text-lg text-gray-300">
          Go from schema to live site in seconds. No build step, zero config.
        </p>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-400">🚀 Features</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-300">
            <li><strong>Visual Editor</strong>: Edit any Zod schema and preview live</li>
            <li><strong>Deploy & Share</strong>: Render sites with ?params or ?schema_id</li>
            <li><strong>Short Links</strong>: Supabase-powered schema IDs</li>
            <li><strong>Local Presets</strong>: Save & export schemas as ZIP</li>
            <li><strong>Version History</strong>: Sync and review prior schemas</li>
            <li><strong>Slack/Supabase</strong>: Optional workflows and persistence</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-purple-300">🧠 Ideal For</h2>
          <ul className="list-disc pl-5 text-sm text-gray-400">
            <li>Frontend devs prototyping API contracts</li>
            <li>Form builders & schema-first UI platforms</li>
            <li>AI tools needing structured I/O</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-green-400">🔗 Try It Now</h2>
          <Link
            href="/admin/zod-playground?schema=%7B%22type%22%3A%22object%22%2C%22properties%22%3A%7B%22email%22%3A%7B%22type%22%3A%22string%22%2C%22format%22%3A%22email%22%7D%2C%22name%22%3A%7B%22type%22%3A%22string%22%7D%7D%7D"
            className="inline-block bg-green-600 hover:bg-green-700 px-6 py-2 rounded text-white text-lg"
          >
            Launch Playground →
          </Link>
        </div>

        <div className="pt-10 border-t border-zinc-700 text-xs text-gray-500">
          Built with 🧠 Zod, 💾 Supabase, and 💡 imagination.
        </div>
      </div>
    </div>
  );
}
