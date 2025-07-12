// GlowConfigurator.tsx — v2.2: fix edge crash from stale glow=null in map
'use client';

import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import BackgroundGlow from './background-glow';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export type GlowConfig = {
  size: 'sm' | 'md' | 'lg' | 'xl';
  intensity: number;
  colors: string[];
};

export type SiteTheme = {
  glow: GlowConfig | GlowConfig[];
  accentColor?: string;
  fontFamily?: string;
  borderRadius?: string;
  buttonStyle?: 'solid' | 'outline' | 'ghost';
};

type Props = {
  defaultGlowConfig: GlowConfig | GlowConfig[];
  siteSlug?: string;
};

const presetOptions: GlowConfig[] = [
  { size: 'xl', intensity: 0.2, colors: ['from-purple-600', 'via-blue-500', 'to-pink-500'] },
  { size: 'xl', intensity: 0.2, colors: ['from-indigo-600', 'via-blue-400', 'to-fuchsia-500'] },
  { size: 'xl', intensity: 0.2, colors: ['from-teal-500', 'via-cyan-400', 'to-lime-400'] },
  { size: 'xl', intensity: 0.2, colors: ['from-orange-500', 'via-red-500', 'to-pink-500'] },
];

const sizeMap = {
  sm: 'w-[80%] h-[80%]',
  md: 'w-[100%] h-[100%]',
  lg: 'w-[120%] h-[120%]',
  xl: 'w-[140%] h-[140%]',
};

export default function GlowConfigurator({ defaultGlowConfig, siteSlug = 'default' }: Props) {
  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [glowLayers, setGlowLayers] = useState<GlowConfig[] | null>(null);
  const [copied, setCopied] = useState(false);
  const LOCAL_KEY = `glow-config::${siteSlug}`;

  useEffect(() => {
    const fallback = Array.isArray(defaultGlowConfig)
      ? defaultGlowConfig
      : [defaultGlowConfig];
  
    let resolved = false;
  
    const fetchAndSeedConfig = async () => {
      try {
        // 🚫 Skip during SSR
        if (typeof window === 'undefined') {
          console.warn('[GlowConfigurator] Skipping config fetch during SSR');
          return;
        }
  
        // ✅ Wrap getUser to safely catch auth error
        let user = null;
        try {
          const result = await supabase.auth.getUser();
          user = result.data.user;
          if (result.error) console.warn('[GlowConfigurator] Auth warning:', result.error.message);
        } catch (err: any) {
          console.warn('[GlowConfigurator] Auth getUser failed:', err.message);
        }
  
        if (user) {
          setUserId(user.id);
          const { data, error } = await supabase
            .from('user_site_settings')
            .select('glow_config')
            .eq('user_id', user.id)
            .eq('site_slug', siteSlug)
            .single();
  
          if (error) console.error('[GlowConfigurator] DB fetch error:', error);
          if (data?.glow_config) {
            const parsed = Array.isArray(data.glow_config)
              ? data.glow_config
              : [data.glow_config];
            setGlowLayers(parsed);
            resolved = true;
          } else {
            console.log('[GlowConfigurator] No glow_config found for user — seeding with fallback');
            await supabase
              .from('user_site_settings')
              .upsert({
                user_id: user.id,
                site_slug: siteSlug,
                glow_config: fallback,
              });
            setGlowLayers(fallback);
            resolved = true;
          }
        }
  
        if (!resolved) {
          if (typeof window !== 'undefined') {
            const local = localStorage.getItem(LOCAL_KEY);
            if (local) {
              try {
                const parsed = JSON.parse(local);
                setGlowLayers(Array.isArray(parsed) ? parsed : [parsed]);
                resolved = true;
              } catch (err) {
                console.error('[GlowConfigurator] localStorage parse error:', err);
              }
            }
          }
  
          if (!resolved) {
            console.log('[GlowConfigurator] Using fallback default glow config');
            setGlowLayers(fallback);
            resolved = true;
          }
        }
      } catch (err) {
        console.error('[GlowConfigurator] Unexpected failure:', err);
        setGlowLayers(fallback);
      }
    };
  
    fetchAndSeedConfig();
  
    const timeoutId = setTimeout(() => {
      if (!resolved && !glowLayers) {
        console.warn('[GlowConfigurator] Timeout fallback triggered');
        setGlowLayers(fallback);
      }
    }, 5000);
  
    return () => clearTimeout(timeoutId);
  }, [siteSlug]);
  
  
  

  useEffect(() => {
    if (!glowLayers) return;
    const data = JSON.stringify(glowLayers);
    if (userId) {
      supabase
        .from('user_site_settings')
        .upsert({ user_id: userId, site_slug: siteSlug, glow_config: glowLayers });
    } else {
      localStorage.setItem(LOCAL_KEY, data);
    }
  }, [glowLayers, userId, siteSlug]);

  const copyToClipboard = async () => {
    if (!glowLayers) return;
    const tailwindString = glowLayers
      .filter(Boolean)
      .map((glow) => [
        sizeMap[glow.size],
        'absolute -top-1/2 left-1/2 rounded-full blur-3xl animate-pulse-slow',
        `bg-gradient-to-tr ${glow.colors.join(' ')}`,
      ].join(' ')).join('\n');
    try {
      await navigator.clipboard.writeText(tailwindString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard error', err);
    }
  };

  const updateLayer = (index: number, newLayer: GlowConfig) => {
    if (!glowLayers) return;
    const newLayers = [...glowLayers];
    newLayers[index] = newLayer;
    setGlowLayers(newLayers);
  };

  const addLayer = () => {
    setGlowLayers((prev) => prev ? [...prev, presetOptions[0]] : [presetOptions[0]]);
  };

  const removeLayer = (index: number) => {
    if (!glowLayers || glowLayers.length <= 1) return;
    const newLayers = glowLayers.filter((_, i) => i !== index);
    setGlowLayers(newLayers);
  };

  if (!glowLayers || glowLayers.some((g) => g == null)) {
    // return <div className="absolute top-4 right-4 z-50 text-white text-xs">Loading glow config...</div>;
    return null;
  }

  return (
    <>
      {glowLayers.map((glow, i) => (
        <BackgroundGlow key={i} {...glow} />
      ))}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute top-4 right-4 z-50 p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full shadow-md border border-zinc-600"
      >
        <SlidersHorizontal className="w-5 h-5 text-white" />
      </button>

      {isOpen && (
        <div className="absolute top-16 right-4 z-50 bg-zinc-900/90 border border-zinc-700 rounded-lg p-4 text-sm text-white shadow-xl space-y-6 w-[320px] max-h-[90vh] overflow-y-auto backdrop-blur">
          {glowLayers.map((glow, i) => glow && (
            <div key={i} className="space-y-2 border-b border-zinc-700 pb-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Layer {i + 1}</h3>
                {glowLayers.length > 1 && (
                  <button onClick={() => removeLayer(i)} className="text-red-500 text-xs">Remove</button>
                )}
              </div>

              <div>
                <label className="block mb-1">Size</label>
                <select
                  className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1"
                  value={glow.size}
                  onChange={(e) => updateLayer(i, { ...glow, size: e.target.value as any })}
                >
                  {['sm', 'md', 'lg', 'xl'].map((val) => (
                    <option key={val} value={val}>{val.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1">Intensity ({glow.intensity.toFixed(2)})</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={glow.intensity}
                  onChange={(e) => updateLayer(i, { ...glow, intensity: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block mb-1">Palette</label>
                <div className="grid grid-cols-4 gap-2">
                  {presetOptions.map((opt, j) => (
                    <div
                      key={j}
                      className="h-6 rounded cursor-pointer border border-zinc-700"
                      style={{
                        backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))`,
                      }}
                      onClick={() => updateLayer(i, { ...glow, colors: opt.colors })}
                      title={`Preset ${j + 1}`}
                    >
                      <div className={`h-full w-full rounded bg-gradient-to-r ${opt.colors.join(' ')}`}></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addLayer}
            className="w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded text-white text-xs"
          >
            ➕ Add Glow Layer
          </button>

          <div>
            <button
              onClick={copyToClipboard}
              className="mt-4 w-full px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700 transition text-white text-sm font-medium"
            >
              {copied ? '✅ Copied!' : 'Copy Tailwind Classes'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
