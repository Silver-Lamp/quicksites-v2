'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function PortfolioAdmin() {
  const { slug: orgSlug } = useParams<{ slug: string }>();
  const [slug, setSlug] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [blurb, setBlurb] = React.useState('');
  const [category, setCategory] = React.useState('Web');
  const [mediaType, setMediaType] = React.useState<'video'|'image'|'link'|'gallery'>('video');
  const [videoUrl, setVideoUrl] = React.useState('');
  const [imageUrl, setImageUrl] = React.useState('');
  const [thumbUrl, setThumbUrl] = React.useState('');
  const [siteUrl, setSiteUrl] = React.useState('');
  const [externalUrl, setExternalUrl] = React.useState('');
  const [tags, setTags] = React.useState('');
  const [badge, setBadge] = React.useState('');
  const [featured, setFeatured] = React.useState(false);

  async function save() {
    const payload = {
      title, blurb, category,
      media_type: mediaType,
      video_url: videoUrl || null,
      image_url: imageUrl || null,
      thumb_url: thumbUrl || null,
      site_url: siteUrl || null,
      external_url: externalUrl || null,
      tags,
      badge,
      featured
    };
    const res = await fetch(`/api/orgs/${orgSlug}/portfolio/upsert`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, payload })
    });
    const j = await res.json();
    if (!res.ok) alert(j.error || 'Save failed');
    else alert('Saved');
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-3">
      <h1 className="text-xl font-semibold">Portfolio Uploader</h1>
      <div className="grid gap-3">
        <div>
          <label className="text-sm">Slug</label>
          <Input value={slug} onChange={(e)=>setSlug(e.target.value)} placeholder="my-project" />
        </div>
        <div>
          <label className="text-sm">Title</label>
          <Input value={title} onChange={(e)=>setTitle(e.target.value)} />
        </div>
        <div>
          <label className="text-sm">Blurb</label>
          <Textarea value={blurb} onChange={(e)=>setBlurb(e.target.value)} rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm">Category</label>
            <Input value={category} onChange={(e)=>setCategory(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Media Type</label>
            <Select value={mediaType} onValueChange={(v)=>setMediaType(v as any)}>
              <SelectTrigger><SelectValue placeholder="Choose"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="link">Link</SelectItem>
                <SelectItem value="gallery">Gallery</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {mediaType === 'video' && (
          <div>
            <label className="text-sm">Video URL</label>
            <Input value={videoUrl} onChange={(e)=>setVideoUrl(e.target.value)} placeholder="https://youtu.be/..." />
          </div>
        )}
        {mediaType === 'image' && (
          <>
            <div>
              <label className="text-sm">Image URL</label>
              <Input value={imageUrl} onChange={(e)=>setImageUrl(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Thumb URL (optional)</label>
              <Input value={thumbUrl} onChange={(e)=>setThumbUrl(e.target.value)} />
            </div>
          </>
        )}
        {mediaType === 'link' && (
          <>
            <div>
              <label className="text-sm">Site URL</label>
              <Input value={siteUrl} onChange={(e)=>setSiteUrl(e.target.value)} placeholder="https://clientsite.com" />
            </div>
            <div>
              <label className="text-sm">External URL</label>
              <Input value={externalUrl} onChange={(e)=>setExternalUrl(e.target.value)} placeholder="https://dribbble.com/..." />
            </div>
          </>
        )}

        <div>
          <label className="text-sm">Tags (comma separated)</label>
          <Input value={tags} onChange={(e)=>setTags(e.target.value)} placeholder="nextjs, supabase, ai" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm">Badge</label>
            <Input value={badge} onChange={(e)=>setBadge(e.target.value)} placeholder="Case Study" />
          </div>
          <div className="flex items-end gap-2">
            <input id="featured" type="checkbox" checked={featured} onChange={(e)=>setFeatured(e.target.checked)} />
            <label htmlFor="featured" className="text-sm">Featured</label>
          </div>
        </div>

        <div className="pt-2">
          <Button onClick={save}>Save</Button>
        </div>
      </div>
    </div>
  );
}
