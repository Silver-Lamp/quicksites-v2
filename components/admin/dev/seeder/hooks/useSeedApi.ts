// components/admin/dev/seeder/hooks/useSeedApi.ts
'use client';

import { useState } from 'react';
import type { SeedParams, SeedResult } from '../types';

const SEED_ENDPOINT = '/api/dev/seed';
const SEED_STREAM_ENDPOINT = '/api/dev/seed/stream';

type StreamEvent =
  | { type: 'progress'; percent: number }
  | { type: 'stage'; key: string; status: 'start' | 'done'; [k: string]: any }
  | { type: 'note'; message: string }
  | { type: 'pulse'; t: number }
  | { type: 'result'; mode: 'preview' | 'save'; payload: SeedResult }
  | { type: 'error'; message: string }
  | { type: string; [k: string]: any };

async function postSeed(body: any): Promise<SeedResult> {
  const r = await fetch(SEED_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error || 'Seed failed');
  return d as SeedResult;
}

async function postSeedStream(
  body: any,
  onEvent?: (evt: StreamEvent) => void,
  options?: { signal?: AbortSignal }
): Promise<SeedResult> {
  const r = await fetch(SEED_STREAM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!r.ok) {
    // try to parse error json; fall back to status text
    let msg = r.statusText || 'Seed stream failed';
    try {
      const j = await r.json();
      msg = j?.error || msg;
    } catch {}
    throw new Error(msg);
  }

  const reader = r.body?.getReader();
  if (!reader) throw new Error('No stream reader available');

  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: SeedResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // process complete lines
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let evt: StreamEvent | null = null;
      try {
        evt = JSON.parse(trimmed);
      } catch {
        // ignore malformed line
        continue;
      }
      onEvent?.(evt as StreamEvent);
      if (evt?.type === 'result' && (evt as any).payload) {
        finalResult = (evt as any).payload as SeedResult;
      } else if (evt?.type === 'error') {
        throw new Error((evt as any).message || 'Seed stream error');
      }
    }
  }

  if (!finalResult) throw new Error('Stream completed without a result payload');
  return finalResult;
}

export function useSeedApi() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SeedResult | null>(null);

  async function preview(params: SeedParams) {
    setPending(true); setError(null);
    try {
      const data = await postSeed({ ...params, dryRun: true });
      setResult(data);
      return data;
    } catch (e: any) {
      setError(e.message || 'Preview failed'); throw e;
    } finally {
      setPending(false);
    }
  }

  async function save(params: SeedParams) {
    setPending(true); setError(null);
    try {
      const data = await postSeed({
        ...params,
        dryRun: false,
        // carry over the preview payload so SAVE can reuse assets/content
        previewBrand: result?.merchant?.preview?.brand ?? null,
        previewLogoDataUrl: result?.merchant?.preview?.logo_data_url ?? null,
        previewItems: result?.products?.items ?? [],
        previewTemplate: result?.template?.preview ?? null,
      });
      setResult(data);
      return data;
    } catch (e: any) {
      setError(e.message || 'Save failed'); throw e;
    } finally {
      setPending(false);
    }
  }

  // Streaming variants (NDJSON). Provide an onEvent handler to receive progress/stage updates.
  async function previewStream(params: SeedParams, onEvent?: (evt: StreamEvent) => void, options?: { signal?: AbortSignal }) {
    setPending(true); setError(null);
    try {
      const data = await postSeedStream({ ...params, dryRun: true }, onEvent, options);
      setResult(data);
      return data;
    } catch (e: any) {
      setError(e.message || 'Preview failed'); throw e;
    } finally {
      setPending(false);
    }
  }

  async function saveStream(params: SeedParams, onEvent?: (evt: StreamEvent) => void, options?: { signal?: AbortSignal }) {
    setPending(true); setError(null);
    try {
      const data = await postSeedStream({
        ...params,
        dryRun: false,
        previewBrand: result?.merchant?.preview?.brand ?? null,
        previewLogoDataUrl: result?.merchant?.preview?.logo_data_url ?? null,
        previewItems: result?.products?.items ?? [],
        previewTemplate: result?.template?.preview ?? null,
      }, onEvent, options);
      setResult(data);
      return data;
    } catch (e: any) {
      setError(e.message || 'Save failed'); throw e;
    } finally {
      setPending(false);
    }
  }

  return {
    pending,
    error,
    result,
    setResult,
    preview,
    save,
    // new streaming helpers (optional to use)
    previewStream,
    saveStream,
  };
}
