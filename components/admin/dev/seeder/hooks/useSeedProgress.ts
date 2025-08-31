// components/admin/dev/seeder/hooks/useSeedProgress.ts
'use client';
import { useRef, useState } from 'react';

type StageMsg   = { type:'stage'; key:string; status:'start'|'done' };
type Progress   = { type:'progress'; percent:number };
type Note       = { type:'note'; message:string };
type Pulse      = { type:'pulse'; t:number };
type Result     = { type:'result'; mode:'preview'|'save'; payload:any };
type ErrorMsg   = { type:'error'; message:string; details?:string };
type StreamMsg  = StageMsg | Progress | Note | Pulse | Result | ErrorMsg;

export function useSeedProgress() {
  const [percent, setPercent] = useState(0);
  const [active,  setActive]  = useState<string | null>(null);
  const [done,    setDone]    = useState<Record<string, boolean>>({});
  const [notes,   setNotes]   = useState<string[]>([]);
  const [result,  setResult]  = useState<any>(null);
  const [error,   setError]   = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const lastTickRef   = useRef<number>(Date.now());
  const stallTimerRef = useRef<any>(null);

  function touch() {
    lastTickRef.current = Date.now();
  }
  function armStallTimer() {
    clearTimeout(stallTimerRef.current);
    stallTimerRef.current = setTimeout(() => {
      if (Date.now() - lastTickRef.current > 30000) {
        setError('Operation stalled (no updates for 30s). You can retry or Save again.');
        controllerRef.current?.abort();
      }
    }, 31000);
  }

  async function start(mode: 'preview'|'save', payload: any) {
    setPercent(0); setActive(null); setDone({}); setNotes([]); setResult(null); setError(null);
    controllerRef.current?.abort(); controllerRef.current = new AbortController();
    touch(); armStallTimer();

    const res = await fetch('/api/dev/seed/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controllerRef.current.signal,
      body: JSON.stringify({ ...payload, mode }),
    });

    if (!res.ok || !res.body) {
      setError(`Stream failed (${res.status})`);
      clearTimeout(stallTimerRef.current);
      return;
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n'); buffer = parts.pop() || '';
        for (const line of parts) {
          if (!line.trim()) continue;
          let msg: StreamMsg; try { msg = JSON.parse(line); } catch { continue; }

          if (msg.type === 'pulse') { touch(); armStallTimer(); continue; }
          if (msg.type === 'progress') { setPercent(msg.percent); touch(); armStallTimer(); continue; }
          if (msg.type === 'stage') {
            if (msg.status === 'start') setActive(msg.key);
            if (msg.status === 'done')  setDone(s=>({ ...s, [msg.key]: true }));
            touch(); armStallTimer(); continue;
          }
          if (msg.type === 'note') {
            setNotes(n => [...n.slice(-10), msg.message]); touch(); armStallTimer(); continue;
          }
          if (msg.type === 'error') {
            setError(msg.message || 'Server error'); touch(); break;
          }
          if (msg.type === 'result') {
            setResult(msg.payload); setPercent(100); touch(); continue;
          }
        }
      }
    } catch (e:any) {
      if (!error) setError(e?.message || 'Connection aborted');
    } finally {
      clearTimeout(stallTimerRef.current);
    }
  }

  function cancel() {
    controllerRef.current?.abort();
    setError('Canceled by user');
  }

  return { percent, active, done, notes, result, error, start, cancel };
}
