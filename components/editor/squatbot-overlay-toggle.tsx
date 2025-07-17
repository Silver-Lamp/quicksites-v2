// components/editor/SquatbotOverlayToggle.tsx
'use client';
import { useState } from 'react';
import { Wand2 } from 'lucide-react';

export function SquatbotOverlayToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="fixed bottom-6 right-6 z-50 bg-purple-600 hover:bg-purple-700 text-white rounded-full p-3 shadow-lg"
      title="Toggle Squatbot Editing Mode"
    >
      <Wand2 className="w-6 h-6" />
    </button>
  );
}
