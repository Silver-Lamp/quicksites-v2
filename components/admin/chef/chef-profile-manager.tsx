// components/admin/chef/chef-profile-manager.tsx
'use client';

import * as React from 'react';
import { createClient as createBrowserClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader } from 'lucide-react';
import { generateRandomChefProfile } from '@/admin/lib/randomChefProfile';

type Chef = {
  id: string;
  name?: string | null;
  location?: string | null;
  bio?: string | null;
  profile_image_url?: string | null;
  kitchen_video_url?: string | null;
  certifications?: string[] | null;
};

async function uploadToProfilesBucket(file: File) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const path = `profiles/${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage.from('public').upload(path, file, {
    upsert: false,
    cacheControl: '3600',
    contentType: file.type,
  });
  if (error) throw error;
  return supabase.storage.from('public').getPublicUrl(path).data.publicUrl;
}

export default function ChefProfileManager() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [busy, setBusy] = React.useState(false); // for randomize / AI avatar
  const [err, setErr] = React.useState<string | null>(null);
  const [chef, setChef] = React.useState<Chef | null>(null);

  const [name, setName] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [bio, setBio] = React.useState('');
  const [profileUrl, setProfileUrl] = React.useState('');
  const [videoUrl, setVideoUrl] = React.useState('');
  const [certsText, setCertsText] = React.useState('');

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch('/api/chef/profile', { cache: 'no-store' });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || 'Load failed');
        setChef(d.chef);
        setName(d.chef?.name ?? '');
        setLocation(d.chef?.location ?? '');
        setBio(d.chef?.bio ?? '');
        setProfileUrl(d.chef?.profile_image_url ?? '');
        setVideoUrl(d.chef?.kitchen_video_url ?? '');
        setCertsText((d.chef?.certifications ?? []).join('\n'));
      } catch (e: any) {
        setErr(e.message || 'Load failed');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        name: name.trim(),
        location: location.trim(),
        bio,
        profile_image_url: profileUrl.trim() || '',
        kitchen_video_url: videoUrl.trim() || '',
        certifications: certsText.split('\n').map((s) => s.trim()).filter(Boolean),
      };
      const r = await fetch('/api/chef/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Save failed');
      setChef(d.chef);
    } catch (e: any) {
      setErr(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // --- New: randomize fields
  function randomizeFields() {
    setErr(null);
    const rnd = generateRandomChefProfile();
    setName(rnd.name);
    setLocation(rnd.location);
    setBio(rnd.bio);
    setVideoUrl(rnd.youtube_url);
    setCertsText(rnd.certifications_multiline);
  }

  // --- New: generate avatar via API -> sets profile image URL (uploaded public URL or data URL)
  async function generateAvatar() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/chef/profile/generate-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Don't include size. Aspect is implied by the route (avatar => 1024x1024).
        body: JSON.stringify({
          displayName: name,
          cuisine: 'Italian',
          vibe: 'Casual',
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Avatar generation failed');
  
      // Accept any of the known shapes, prefer the hardened route's { url }
      const url = d.url || d.imageUrl || d.dataUrl;
      if (!url) throw new Error('No image URL returned');
  
      setProfileUrl(url);
    } catch (e: any) {
      setErr(e.message || 'Avatar generation failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {err && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={randomizeFields}
          disabled={loading || saving || busy}
          title="Fill name, location, bio, video URL, and certifications"
        >
          {busy ? <><Loader className="mr-2 h-4 w-4 animate-spin" />Working…</> : 'Fill Random Info'}
        </Button>
        <Button onClick={generateAvatar} disabled={loading || saving || busy}>
          {busy ? <><Loader className="mr-2 h-4 w-4 animate-spin" />Generating…</> : 'Generate Avatar (AI)'}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chef Jane Doe" />
          </div>
          <div>
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, ST" />
          </div>
          <div>
            <Label>Profile Image URL</Label>
            <Input value={profileUrl} onChange={(e) => setProfileUrl(e.target.value)} placeholder="https://…" />
            <div className="mt-2 flex items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const url = await uploadToProfilesBucket(f);
                      setProfileUrl(url);
                    } catch (e: any) {
                      setErr(e.message || 'Upload failed');
                    }
                  }}
                />
                Upload
              </label>
              <Button size="sm" variant="outline" onClick={generateAvatar} disabled={busy}>
                {busy ? <><Loader className="mr-2 h-3 w-3 animate-spin" />AI…</> : 'AI Avatar'}
              </Button>
            </div>
          </div>
          <div>
            <Label>Kitchen Video (YouTube)</Label>
            <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" />
            <p className="mt-1 text-xs text-muted-foreground">A regular YouTube URL is fine; it’s normalized on save.</p>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl border p-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={profileUrl || 'https://placehold.co/120x120'}
              alt=""
              className="h-16 w-16 rounded-full object-cover border"
            />
            <div>
              <div className="text-base font-semibold">{name || '(Your name)'}</div>
              <div className="text-xs text-muted-foreground">{location || 'Add a location'}</div>
            </div>
          </div>
          {bio && <p className="mt-3 text-sm">{bio}</p>}
        </div>
      </div>

      <div>
        <Label>Bio</Label>
        <textarea
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-background"
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell customers about yourself…"
        />
      </div>

      <div>
        <Label>Certifications (one per line)</Label>
        <textarea
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-background"
          rows={3}
          value={certsText}
          onChange={(e) => setCertsText(e.target.value)}
          placeholder="Food Handler Card&#10;Allergen Certificate"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={loading || saving}>{saving ? 'Saving…' : 'Save Profile'}</Button>
        {chef?.kitchen_video_url && (
          <a
            className="text-xs text-muted-foreground underline"
            href={chef.kitchen_video_url}
            target="_blank"
            rel="noreferrer"
          >
            Preview video
          </a>
        )}
      </div>
    </div>
  );
}
