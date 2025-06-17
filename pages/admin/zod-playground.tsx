// pages/admin/zod-playground.tsx
'use client';

import { useState, useEffect } from 'react';
import { z, ZodSchema } from 'zod';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import QueryParamEditor from '@/components/admin/QueryParamEditor';
import { defaultSchema } from '@/admin/lib/defaultSchema';
import { jsonSchemaToZod } from '@/admin/utils/jsonSchemaToZod';
import { zodToJsonSchema } from '@/admin/utils/zodToJsonSchema';
import VisualSchema from '@/components/admin/VisualSchema';
import { createClient } from '@supabase/supabase-js';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { logEmbedView } from '@/admin/lib/logEmbedView';

const SitePreview = dynamic(() => import('@/components/admin/SitePreview'), {
  ssr: false,
});
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ZodPlaygroundPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useCurrentUser();
  const [schema, setSchema] = useState<ZodSchema>(defaultSchema);
  const [error, setError] = useState<string | null>(null);
  const [jsonExport, setJsonExport] = useState<string | null>(null);
  const [shortLink, setShortLink] = useState<string | null>(null);
  const [slackUsername, setSlackUsername] = useState('');

  const isEmbed =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('embed') === '1';

  const loadSchemaFromQueryParam = () => {
    const encoded = params.get('schema');
    if (!encoded) return;
    try {
      const decoded = decodeURIComponent(encoded);
      const parsed = JSON.parse(decoded);
      const zodified = jsonSchemaToZod(parsed);
      setSchema(zodified);
      setJsonExport(decoded);
    } catch (err: any) {
      setError('Invalid schema from query param: ' + err.message);
    }
  };

  useEffect(() => {
    const schemaId = params.get('schema_id');
    if (schemaId) {
      supabase
        .from('schema_links')
        .select('*')
        .eq('id', schemaId)
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            router.push('/admin/links?error=schema_id_not_found');
            return;
          }
          try {
            const parsed = JSON.parse(data.json);
            const zodified = jsonSchemaToZod(parsed);
            setSchema(zodified);
            setJsonExport(data.json);
            if (isEmbed) logEmbedView(schemaId);
          } catch (err: any) {
            setError('Failed to parse schema from ID: ' + err.message);
          }
        });
      return;
    }

    loadSchemaFromQueryParam();
  }, [params]);

  const exportJsonSchema = () => {
    try {
      const json = zodToJsonSchema(schema);
      const stringified = JSON.stringify(json, null, 2);
      setJsonExport(stringified);

      const blob = new Blob([stringified], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'schema.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Failed to export schema: ' + err.message);
    }
  };

  const handleCreateShortLink = async () => {
    if (!user || !jsonExport) return;
    const { data, error } = await supabase
      .from('schema_links')
      .insert({
        user_id: user.id,
        json: jsonExport,
        slack_username: slackUsername,
      })
      .select()
      .single();

    if (error) return alert('Failed to create short link');
    setShortLink(
      `${window.location.origin}/admin/zod-playground?schema_id=${data.id}`
    );
  };

  const handleDeploy = (payload: Record<string, any>) => {
    const encoded = encodeURIComponent(JSON.stringify(payload));
    router.push(`/launch?params=${encoded}`);
  };

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
      <h1 className="text-3xl font-bold">🧪 Zod Playground</h1>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <QueryParamEditor schema={schema} slug={''} />

      {!isEmbed && (
        <div className="space-y-2">
          <button
            onClick={exportJsonSchema}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Export JSON Schema
          </button>
          {jsonExport && (
            <textarea
              className="w-full h-64 mt-2 p-2 border rounded bg-gray-100 font-mono text-sm"
              value={jsonExport}
              onChange={(e) => setJsonExport(e.target.value)}
            />
          )}
          <button
            onClick={() => {
              try {
                if (!jsonExport) return;
                const parsed = JSON.parse(jsonExport);
                const zodified = jsonSchemaToZod(parsed);
                setSchema(zodified);
                setError(null);
              } catch (err: any) {
                setError('Failed to apply edited schema: ' + err.message);
              }
            }}
            className="bg-purple-600 text-white px-4 py-2 rounded"
          >
            Apply Edited Schema
          </button>
        </div>
      )}

      <div className="space-y-2">
        <label className="font-semibold">🧱 Schema Visualizer</label>
        <VisualSchema schema={schema} onDeployClick={handleDeploy} />
      </div>

      {!isEmbed && (
        <div className="space-y-2 border-t pt-4">
          <label className="font-semibold">🔗 Shareable Playground Link</label>
          <div className="flex gap-2">
            <input
              value={
                shortLink ||
                `${window.location.origin}/admin/zod-playground?schema=${encodeURIComponent(jsonExport || '')}`
              }
              readOnly
              className="w-full text-sm border px-2 py-1 rounded"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  shortLink ||
                    `${window.location.origin}/admin/zod-playground?schema=${encodeURIComponent(jsonExport || '')}`
                );
                alert('Link copied to clipboard!');
              }}
              className="bg-blue-700 text-white px-3 py-1 rounded"
            >
              Copy Link
            </button>

            <label className="text-sm text-gray-400">
              Slack Username (optional)
            </label>
            <input
              value={slackUsername}
              onChange={(e) => setSlackUsername(e.target.value)}
              placeholder="e.g. jon.doe"
              className="text-sm border px-2 py-1 rounded w-full mb-2"
            />

            <button
              onClick={handleCreateShortLink}
              className="bg-zinc-800 text-white px-3 py-1 rounded"
            >
              Create Short Link
            </button>
          </div>
        </div>
      )}

      {!isEmbed && <SitePreview />}
    </div>
  );
}
