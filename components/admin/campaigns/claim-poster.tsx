// app/admin/campaigns/claim-poster.tsx
import Image from 'next/image';
import QRCode from 'react-qr-code';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { normalizeImageSrc } from '@/lib/normalizeImageSrc';

export type ClaimPosterProps = {
  domain: string;
  offerEndsAt: string;
  leadA: {
    name: string;
    logoUrl?: string;
  };
  leadB: {
    name: string;
    logoUrl?: string;
  };
  qrUrl: string;
  imageSrc: string;
  arcOffsetY?: number;
  logoOffsetY?: number;
  arcRadius?: number;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  campaignId?: string;
  expired?: boolean;
};

export default function ClaimPoster({
  domain,
  offerEndsAt,
  leadA,
  leadB,
  qrUrl,
  imageSrc,
  arcOffsetY = 0,
  logoOffsetY = 0,
  arcRadius = 100,
  onEditStart,
  onEditEnd,
  campaignId,
  expired,
}: ClaimPosterProps) {
  const [editing, setEditing] = useState(false);
  const [settings, setSettings] = useState({ arcOffsetY, logoOffsetY, arcRadius });
  const [original, setOriginal] = useState({ arcOffsetY, logoOffsetY, arcRadius });
  const [resolvedSrc, setResolvedSrc] = useState('/logo-placeholder.png');

  useEffect(() => {
    normalizeImageSrc(imageSrc).then(setResolvedSrc);
  }, [imageSrc]);

  const arcPath = `M50,${80 + settings.arcOffsetY} A${settings.arcRadius},${settings.arcRadius} 0 0 1 250,${80 + settings.arcOffsetY}`;
  const timeLeft = formatDistanceToNowStrict(parseISO(offerEndsAt), {
    unit: 'day',
    roundingMethod: 'floor',
  });

  const handleCancel = () => {
    setSettings(original);
    setEditing(false);
    onEditEnd?.();
  };

  const handleSave = async () => {
    setOriginal(settings);
    setEditing(false);
    onEditEnd?.();

    if (campaignId) {
      const { error } = await supabase
        .from('campaigns')
        .update({
          arc_offset_y: settings.arcOffsetY,
          logo_offset_y: settings.logoOffsetY,
          arc_radius: settings.arcRadius,
        })
        .eq('id', campaignId);

      if (error) {
        console.error('Failed to save poster settings:', error);
        toast.error('Failed to save poster settings.');
      } else {
        toast.success('Poster settings saved.');
      }
    } else {
      toast.error('No campaign ID provided.');
    }
  };

  const toggleEdit = () => {
    setEditing(!editing);
    if (!editing) {
      onEditStart?.();
    } else {
      onEditEnd?.();
    }
  };

  return (
    <div
      className="bg-[#080a03] text-white p-6 rounded-lg w-full max-w-md mx-auto text-center font-semibold shadow-lg border border-zinc-700"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-xs text-zinc-300 uppercase mb-2 tracking-wide">Towing Website SEO</div>

      <div className="mb-6" style={{ transform: `translateY(${settings.arcOffsetY}px)`, height: `${settings.arcRadius}px` }}>
        <svg width="100%" height="230" viewBox="0 0 300 150">
          <path id="arcPath" d={arcPath} fill="transparent" />
          <text fill="white" fontSize="14" fontWeight="600" textAnchor="middle">
            <textPath href="#arcPath" startOffset="50%">
              {domain.toUpperCase()}
            </textPath>
          </text>
        </svg>
      </div>

      <div className="w-28 h-20 mx-auto mb-4" style={{ transform: `translateY(${settings.logoOffsetY}px)` }}>
        <Image src={resolvedSrc} alt="Tow Truck Logo" width={112} height={80} className="object-contain w-full h-full" />
      </div>

      <div className="flex justify-center items-center my-4 gap-4">
        <LeadCard name={leadA.name} logoUrl={leadA.logoUrl} />
        <div className="text-sm text-zinc-500">or</div>
        <LeadCard name={leadB.name} logoUrl={leadB.logoUrl} />
      </div>

      <div className="w-24 h-24 mx-auto mb-2 bg-white p-2 rounded shadow-md">
        <QRCode value={qrUrl} size={96} />
      </div>

      <div className="text-xs text-zinc-300">Scan to claim it first</div>
      {!expired && (
        <>
          <div className="mt-3 text-yellow-400 text-sm tracking-wider">72-HOUR OFFERING</div>
          <div className="text-xs text-zinc-400">(Time left: {timeLeft})</div>
        </>
      )}
      {expired ? (
        <div className="mt-3 text-red-400 text-sm tracking-wider">EXPIRED</div>
      ) : (
        <div className="mt-3 text-yellow-400 text-sm tracking-wider">72-HOUR OFFERING</div>
      )}

      <div className="mt-4">
        <button onClick={toggleEdit} className="text-xs underline text-blue-400 hover:text-blue-300">
          {editing ? 'Close Settings' : 'Poster Settings'}
        </button>
      </div>

      {editing && (
        <div className="mt-4 space-y-3 text-left text-sm">
          <div>
            <label className="block mb-1">Arc Offset Y: {settings.arcOffsetY}px</label>
            <input
              type="range"
              min={-40}
              max={80}
              value={settings.arcOffsetY}
              onChange={(e) => setSettings({ ...settings, arcOffsetY: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <label className="block mb-1">Logo Offset Y: {settings.logoOffsetY}px</label>
            <input
              type="range"
              min={-40}
              max={80}
              value={settings.logoOffsetY}
              onChange={(e) => setSettings({ ...settings, logoOffsetY: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <label className="block mb-1">Arc Radius: {settings.arcRadius}px</label>
            <input
              type="range"
              min={50}
              max={200}
              value={settings.arcRadius}
              onChange={(e) => setSettings({ ...settings, arcRadius: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <button onClick={handleCancel} className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600">
              Cancel
            </button>
            <button onClick={handleSave} className="text-xs px-2 py-1 rounded bg-green-600 hover:bg-green-500">
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LeadCard({ name, logoUrl }: { name: string; logoUrl?: string }) {
  return (
    <div className="w-28 h-20 flex items-center justify-center bg-zinc-800 rounded border border-zinc-600 p-2">
      {logoUrl ? (
        <Image src={logoUrl} alt={name} width={100} height={60} className="object-contain" />
      ) : (
        <span className="text-sm text-white text-center leading-tight">{name}</span>
      )}
    </div>
  );
}
