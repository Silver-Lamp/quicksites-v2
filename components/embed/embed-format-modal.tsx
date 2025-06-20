import { useState } from 'react';

export function EmbedFormatModal({ slug }: { slug: string }) {
  const [format, setFormat] = useState('html');
  const [embedCode, setEmbedCode] = useState('');

  const fetchEmbed = async (f: string) => {
    setFormat(f);
    const text = await fetch(`/api/embed/${slug}?format=${f}`).then((res) => res.text());
    setEmbedCode(text);
  };

  return (
    <>
      <div className="bg-zinc-800 p-4 rounded text-sm text-white space-y-3">
        <p className="font-semibold">📎 Copy Embed Code</p>
        <div className="flex gap-2">
          {['html', 'markdown', 'iframe'].map((f) => (
            <button
              key={f}
              onClick={() => fetchEmbed(f)}
              className={`px-2 py-1 rounded ${format === f ? 'bg-blue-600' : 'bg-zinc-700'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <textarea
          value={embedCode}
          readOnly
          className="w-full h-32 bg-zinc-900 text-green-400 p-2 rounded font-mono"
        />
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(embedCode);
            alert('✅ Copied!');
          }}
          className="text-xs text-blue-400 underline"
        >
          Copy to clipboard
        </button>
      </div>
    </>
  );
}
