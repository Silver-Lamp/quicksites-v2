// components/editor/ThemePresetsDropdown.tsx
'use client';

const PRESETS = {
  towing: {
    font: "'Roboto Slab', serif",
    primaryColor: '#7c3aed',
    borderRadius: '0.375rem',
  },
  bakery: {
    font: "'Pacifico', cursive",
    primaryColor: '#eab308',
    borderRadius: '1rem',
  },
  agency: {
    font: "'Inter', sans-serif",
    primaryColor: '#0ea5e9',
    borderRadius: '0.25rem',
  },
};

export function ThemePresetsDropdown({
  onSelect,
}: {
  onSelect: (preset: { font: string; primaryColor: string; borderRadius: string }) => void;
}) {
  return (
    <div className="text-sm space-y-1">
      <label className="text-white/70">Load Preset</label>
      <select
        onChange={(e) => {
          const preset = PRESETS[e.target.value as keyof typeof PRESETS];
          if (preset) onSelect(preset);
        }}
        className="w-full p-1 rounded text-black"
      >
        <option value="">Select a preset</option>
        {Object.keys(PRESETS).map((key) => (
          <option key={key} value={key}>
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}
