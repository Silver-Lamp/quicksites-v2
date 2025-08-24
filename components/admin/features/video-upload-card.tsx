'use client';

import * as React from 'react';
import { createClient as createBrowserClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, Copy } from 'lucide-react';

type Props = {
  bucket?: string; // default: 'videos'
  onUploaded?: (publicUrl: string) => void;
};

export default function VideoUploadCard({ bucket = 'videos', onUploaded }: Props) {
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [url, setUrl] = React.useState<string>('');

  const supabase = React.useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    const key = `${crypto.randomUUID()}-${file.name.replace(/\s+/g, '_')}`;
    const { error } = await supabase.storage.from(bucket).upload(key, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'video/mp4',
    });
    if (error) {
      console.error(error);
      alert(error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(key);
    const publicUrl = data.publicUrl;
    setUrl(publicUrl);
    setUploading(false);
    onUploaded?.(publicUrl);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload feature demo video</CardTitle>
        <CardDescription>MP4/WebM/Ogg supported. We’ll return a public URL to paste into your Features page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="video">Choose file</Label>
          <Input
            id="video"
            type="file"
            accept="video/mp4,video/webm,video/ogg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Upload
          </Button>
          {url && (
            <>
              <Input readOnly value={url} className="font-mono" />
              <Button
                type="button"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(url)}
                title="Copy URL"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
        {url && (
          <div className="aspect-video rounded-lg overflow-hidden border">
            <video className="h-full w-full" src={url} controls preload="metadata" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
