'use client';

import { useState } from 'react';

export default function VectorQueryPage({
  onUseBlock,
}: {
  onUseBlock?: (text: string, mode?: 'insert' | 'replace', index?: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [industry, setIndustry] = useState('');
  const [tone, setTone] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rewritingIndex, setRewritingIndex] = useState<number | null>(null);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch('/api/blocks/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, type, industry, tone, topK: 5 }),
      });

      if (!res.ok) throw new Error('Failed to search vector DB');
      const data = await res.json();
      setResults(data.matches || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function rewriteBlock(originalText: string, index: number) {
    setRewritingIndex(index);

    try {
      const res = await fetch('/api/blocks/rag/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: query,
          originalText,
          blockType: type,
          industry,
          tone,
        }),
      });

      if (!res.ok) throw new Error('Rewrite failed');

      const data = await res.json();
      if (data.rewritten) {
        if (onUseBlock) onUseBlock(data.rewritten);
        else navigator.clipboard.writeText(data.rewritten);
        alert('Rewritten block ready and copied!');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRewritingIndex(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">🧠 Vector Query + RAG Rewriter</h1>

      <div className="space-y-4">
        <input
          className="w-full border rounded px-3 py-2 bg-white/5"
          placeholder="Type a query..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select className="bg-white/5 border rounded px-2 py-1" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All Types</option>
            <option value="hero">hero</option>
            <option value="cta">cta</option>
            <option value="services">services</option>
          </select>

          <select className="bg-white/5 border rounded px-2 py-1" value={industry} onChange={(e) => setIndustry(e.target.value)}>
            <option value="">All Industries</option>
            <option value="towing">towing</option>
            <option value="bakery">bakery</option>
          </select>

          <select className="bg-white/5 border rounded px-2 py-1" value={tone} onChange={(e) => setTone(e.target.value)}>
            <option value="">All Tones</option>
            <option value="confident">confident</option>
            <option value="urgent">urgent</option>
            <option value="neutral">neutral</option>
          </select>
        </div>

        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={handleSearch}
          disabled={loading || !query}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>

        {error && <p className="text-red-500 mt-2">Error: {error}</p>}

        {results.length > 0 && (
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-semibold">Top Matches</h2>
            {results.map((text, idx) => (
              <div key={idx} className="bg-white/5 p-3 rounded border text-sm space-y-2">
                <p>{text}</p>
                <div className="flex gap-2">
                  <button
                    className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                    onClick={() => {
                      if (onUseBlock) onUseBlock(text);
                      else {
                        navigator.clipboard.writeText(text);
                        alert('Copied to clipboard');
                      }
                    }}
                  >
                    {onUseBlock ? 'Use this block' : 'Copy to clipboard'}
                  </button>

                  <button
                    className="text-sm bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700"
                    onClick={() => rewriteBlock(text, idx)}
                    disabled={rewritingIndex === idx}
                  >
                    {rewritingIndex === idx ? 'Rewriting...' : 'Rewrite with GPT'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
