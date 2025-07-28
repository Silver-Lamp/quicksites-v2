// app/admin/hooks/useZodPlaygroundState.ts
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ZodTypeAny } from 'zod';
import { defaultSchema } from '@/admin/lib/defaultSchema';
import { jsonSchemaToZod } from '@/admin/utils/jsonSchemaToZod';
import { zodToJsonSchema } from '@/admin/utils/zodToJsonSchema';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { logEmbedView } from '@/admin/lib/logEmbedView';

export function useZodPlaygroundState() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useCurrentUser();

  // was: ts-expect-error TS2589: deep type inference
  const [schema, setSchema] = useState<ZodTypeAny>(defaultSchema);
  const [error, setError] = useState<string | null>(null);
  const [jsonExport, setJsonExport] = useState<string | null>(null);
  const [shortLink, setShortLink] = useState<string | null>(null);
  const [slackUsername, setSlackUsername] = useState('');

  const isEmbed =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('embed') === '1';

  const loadSchemaFromQueryParam = () => {
    const encoded = params?.get('schema');
    if (!encoded) return;

    try {
      const decoded = decodeURIComponent(encoded);
      const parsed = JSON.parse(decoded);
      const zodified = jsonSchemaToZod(parsed);
      // was: @ts-expect-error TS2589: deep type inference
      setSchema(zodified);
      setJsonExport(decoded);
    } catch (err: any) {
      setError('Invalid schema from query param: ' + err.message);
    }
  };

  useEffect(() => {
    const schemaId = params?.get('schema_id');
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
      // was: @ts-expect-error TS2589: deep type inference
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
    setShortLink(`${window.location.origin}/admin/zod-playground?schema_id=${data.id}`);
  };

  const handleDeploy = (payload: Record<string, any>) => {
    const encoded = encodeURIComponent(JSON.stringify(payload));
    router.push(`/launch?params=${encoded}`);
  };

  return {
    schema,
    setSchema,
    error,
    setError,
    jsonExport,
    setJsonExport,
    shortLink,
    setShortLink,
    slackUsername,
    setSlackUsername,
    exportJsonSchema,
    handleCreateShortLink,
    handleDeploy,
    isEmbed,
  };
}
