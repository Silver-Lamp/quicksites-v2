// components/admin/dev/seeder/sections/LegacySection.tsx
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export function LegacySection({
  profileOverwrite, setProfileOverwrite,
  avatar, setAvatar,
  avatarStyle, setAvatarStyle,
  avatarSize, setAvatarSize,
  mealsCount, setMealsCount,
}: any) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <Label>Profile Overwrite</Label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={profileOverwrite} onChange={(e)=>setProfileOverwrite(e.target.checked)} />
            Overwrite existing profile fields
          </label>
        </div>

        <div>
          <Label>Avatar</Label>
          <div className="mt-1 flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={avatar} onChange={(e)=>setAvatar(e.target.checked)} />
              Generate avatar (AI)
            </label>
          </div>
        </div>

        {avatar && (
          <div className="grid grid-cols-2 gap-2 md:col-span-1">
            <div>
              <Label>Avatar Style</Label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-900"
                value={avatarStyle}
                onChange={(e)=>setAvatarStyle(e.target.value)}
              >
                <option value="photo">photo</option>
                <option value="illustration">illustration</option>
              </select>
            </div>
            <div>
              <Label>Avatar Size</Label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-900"
                value={avatarSize}
                onChange={(e)=>setAvatarSize(e.target.value)}
              >
                <option value="256x256">256x256</option>
                <option value="512x512">512x512</option>
                <option value="1024x1024">1024x1024</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <Label>Meals Count</Label>
          <Input
            type="number" min={1} max={24} value={mealsCount}
            onChange={(e)=>setMealsCount(Math.max(1, Math.min(24, parseInt(e.target.value || '1',10))))}
          />
        </div>
        <div className="hidden md:block" />
        <div className="hidden md:block" />
      </div>
    </>
  );
}
