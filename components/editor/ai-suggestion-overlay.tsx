// components/editor/AISuggestionOverlay.tsx
'use client';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';

export function AISuggestionOverlay({ onSelect }: { onSelect: (text: string) => void }) {
  const [loading, setLoading] = useState(false);

  async function fetchSuggestion() {
    setLoading(true);
    const res = await fetch('/api/generate-suggestion');
    const { suggestion } = await res.json();
    setLoading(false);
    onSelect(suggestion);
  }

  return (
    <button
      onClick={fetchSuggestion}
      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-3 py-1 rounded"
      disabled={loading}
    >
      <Sparkles className="w-4 h-4" />
      {loading ? 'Thinking...' : 'Try an AI Suggestion'}
    </button>
  );
}
