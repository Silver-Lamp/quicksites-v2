import { useEffect, useState } from 'react';

type BrandingProfile = {
  id: string;
  name: string;
  theme: 'light' | 'dark';
  brand: 'green' | 'blue' | 'red';
  accent_color?: string;
  logo_url?: string;
};

const THEMES = {
  dark: {
    background: '#1e293b',
    foreground: 'white',
    border: '#334155'
  },
  light: {
    background: '#f1f5f9',
    foreground: '#0f172a',
    border: '#cbd5e1'
  }
};

export default function BrandingPreview({ profile }: { profile: BrandingProfile | null }) {
  if (!profile) return null;

  const theme = THEMES[profile.theme] || THEMES.dark;

  return (
    <div
      className="rounded border p-4 mt-2"
      style={{
        backgroundColor: theme.background,
        color: theme.foreground,
        borderColor: theme.border
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{profile.name}</h3>
        {profile.logo_url && (
          <img src={profile.logo_url} alt="Logo" className="h-8 w-8 rounded-full" />
        )}
      </div>
      <p className="text-sm mt-1">
        Theme: <strong>{profile.theme}</strong> &nbsp;|&nbsp; Brand: <strong>{profile.brand}</strong>
      </p>
      {profile.accent_color && (
        <div className="mt-2">
          <span className="text-xs">Accent:</span>
          <div
            className="inline-block ml-2 w-4 h-4 rounded-full border"
            style={{ backgroundColor: profile.accent_color }}
          ></div>
        </div>
      )}
    </div>
  );
}
