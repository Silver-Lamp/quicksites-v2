'use client';

import QueryParamEditor from '@/components/admin/query-param-editor';
import VisualSchema from '@/components/admin/visual-schema';
import SitePreview from '@/components/admin/site-preview';
import { useZodPlaygroundState } from '@/hooks/useZodPlaygroundState';

export default function ZodPlaygroundPage() {
  const {
    schema,
    setSchema,
    error,
    setError,
    jsonExport,
    setJsonExport,
    shortLink,
    slackUsername,
    setSlackUsername,
    exportJsonSchema,
    handleCreateShortLink,
    handleDeploy,
    isEmbed,
  } = useZodPlaygroundState();

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
      <h1 className="text-3xl font-bold">🧪 Zod Playground</h1>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <QueryParamEditor schema={schema} slug="" />

      {!isEmbed && (
        <>
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
                  setSchema(parsed);
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

          <div className="space-y-2">
            <label className="font-semibold">🧱 Schema Visualizer</label>
            <VisualSchema schema={schema} onDeployClick={handleDeploy} />
          </div>

          <div className="space-y-2 border-t pt-4">
            <label className="font-semibold">🔗 Shareable Playground Link</label>
            <div className="flex gap-2 flex-wrap">
              <input
                value={
                  shortLink ||
                  `${window.location.origin}/admin/zod-playground?schema=${encodeURIComponent(
                    jsonExport || ''
                  )}`
                }
                readOnly
                className="flex-1 text-sm border px-2 py-1 rounded"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    shortLink ||
                      `${window.location.origin}/admin/zod-playground?schema=${encodeURIComponent(
                        jsonExport || ''
                      )}`
                  );
                  alert('Link copied to clipboard!');
                }}
                className="bg-blue-700 text-white px-3 py-1 rounded"
              >
                Copy Link
              </button>
            </div>

            <div className="mt-2">
              <label className="text-sm text-gray-400 block mb-1">
                Slack Username (optional)
              </label>
              <input
                value={slackUsername}
                onChange={(e) => setSlackUsername(e.target.value)}
                placeholder="e.g. jon.doe"
                className="text-sm border px-2 py-1 rounded w-full"
              />

              <button
                onClick={handleCreateShortLink}
                className="mt-2 bg-zinc-800 text-white px-3 py-1 rounded"
              >
                Create Short Link
              </button>
            </div>
          </div>

          <SitePreview />
        </>
      )}
    </div>
  );
}
