// components/editor/ThemeEditorPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import { saveIndustryTheme } from '@/lib/db/themeService';
import { ThemePreviewArea } from './theme-preview-area';
import { ThemePresetsDropdown } from './theme-presets-dropdown';

export function ThemeEditorPanel({ industry }: { industry: string }) {
  const [font, setFont] = useState("'Inter', sans-serif");
  const [primaryColor, setPrimaryColor] = useState('#0ea5e9');
  const [borderRadius, setBorderRadius] = useState('0.25rem');
  const [status, setStatus] = useState('');

  const handleSave = async () => {
    setStatus('Saving...');
    const error = await saveIndustryTheme(industry, {
      font,
      primary_color: primaryColor,
      border_radius: borderRadius,
    });
    setStatus(error ? 'Error saving theme' : 'Saved!');
  };

  return (
    <div className="fixed right-4 top-20 z-50 w-80 bg-neutral-900 text-white border border-white/10 p-4 rounded shadow-lg space-y-4">
      <h3 className="text-lg font-semibold">Theme Editor</h3>

      <div className="space-y-2 text-sm">
        <label className="block">
          <span className="text-white/70">Font Family</span>
          <select
            value={font}
            onChange={(e) => setFont(e.target.value)}
            className="w-full p-1 mt-1 rounded text-black"
          >
            <option value="'Inter', sans-serif">Inter</option>
            <option value="'Roboto Slab', serif">Roboto Slab</option>
            <option value="'Pacifico', cursive">Pacifico</option>
            <option value="'Fira Code', monospace">Fira Code</option>
          </select>
        </label>

        <label className="block">
          <span className="text-white/70">Primary Color</span>
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="mt-1 w-full h-8 border rounded"
          />
        </label>

        <label className="block">
          <span className="text-white/70">Border Radius</span>
          <input
            type="text"
            value={borderRadius}
            onChange={(e) => setBorderRadius(e.target.value)}
            placeholder="e.g. 0.25rem"
            className="mt-1 w-full p-1 text-black rounded"
          />
        </label>
      </div>

      <button
        onClick={handleSave}
        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm"
      >
        Save Theme
      </button>

      {status && <p className="text-xs text-green-400 pt-1">{status}</p>}

      <ThemePresetsDropdown
        onSelect={(preset) => {
          setFont(preset.font);
          setPrimaryColor(preset.primaryColor);
          setBorderRadius(preset.borderRadius);
        }}
      />

      <ThemePreviewArea font={font} primaryColor={primaryColor} borderRadius={borderRadius} />

    </div>
  );
}
