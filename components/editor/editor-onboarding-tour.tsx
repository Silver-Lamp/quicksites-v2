// components/editor/EditorOnboardingTour.tsx
'use client';
import { useEffect, useState } from 'react';

export function EditorOnboardingTour({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem('seen_onboarding');
    if (seen) onComplete();
  }, []);

  const steps = [
    { label: 'Click the ✏️ icon to edit a block.', id: 'edit-step' },
    { label: 'Use ➕ to add new content blocks.', id: 'add-step' },
    { label: 'Toggle preview mode with 🪄 Squatbot.', id: 'toggle-step' },
  ];

  if (step >= steps.length) {
    localStorage.setItem('seen_onboarding', 'true');
    onComplete();
    return null;
  }

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-white/90 text-black px-4 py-2 rounded shadow-xl max-w-sm text-sm">
      <p>{steps[step].label}</p>
      <div className="text-right mt-2">
        <button onClick={() => setStep((s) => s + 1)} className="text-xs underline text-blue-600">
          Next
        </button>
      </div>
    </div>
  );
}
