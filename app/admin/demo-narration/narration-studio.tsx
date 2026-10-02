'use client';

// app/admin/demo-narration/narration-studio.tsx
//
// Read the script one line at a time against the footage, then play it back in place or mix it
// down to a single soundtrack.
//
// ⚠️ THE MIX HAPPENS IN THE BROWSER, and that is a constraint rather than a preference: ffmpeg
// exists in this repo only inside `scripts/`, never in `app/` or `lib/`, so there is no ffmpeg
// binary on Vercel. `OfflineAudioContext` places each take at its exact cue and renders one WAV
// — sample-accurate, no server, nothing to install.
//
// ⚠️ AN UNRECORDED LINE IS SILENCE. There is deliberately no "fill the gaps with TTS" button:
// the track is presented as the owner's own voice, and a machine voice inside it is the exact
// mislabelling crosstalk/contracts/audio-honesty-standard.md exists to prevent. Gaps are shown.

import * as React from 'react';
import {
  clipKey as makeClipKey,
  parseManifest,
  planNarration,
  lineAt,
  type NarrationManifest,
  type NarrationTake,
} from '@/lib/demos/narration';

type Source = 'recorded' | 'tts';
type StudioTake = NarrationTake & { source: Source; voiceBasis: 'self' | 'narrator' | null };

/**
 * What we are allowed to call a synthesised set.
 *
 * ⚠️ ONLY `self` MAY BE CALLED THE OWNER'S VOICE. HJ reports which voice actually spoke; an
 * absent basis is unknown, and unknown must never be rendered optimistically. This is the same
 * rule as every other audio surface in the mesh (crosstalk/contracts/audio-honesty-standard.md).
 */
function voiceLabel(basis: 'self' | 'narrator' | null | undefined): string {
  if (basis === 'self') return 'your consented voice clone';
  if (basis === 'narrator') return 'the house narrator — NOT your voice';
  return 'voice unknown — HiveJournal did not report which voice spoke';
}

export type StudioClip = {
  src: string;
  poster: string | null;
  label: string;
  recordedOn: string | null;
  manifestUrl: string | null;
  durationSeconds: number | null;
  feature: string;
};

const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

/** Interleaved 16-bit PCM WAV. The one format every editor and browser opens without argument. */
function toWav(buffer: AudioBuffer): Blob {
  const chans = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytes = 44 + frames * chans * 2;
  const view = new DataView(new ArrayBuffer(bytes));
  const str = (off: number, s: string) => [...s].forEach((c, i) => view.setUint8(off + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  view.setUint32(4, bytes - 8, true);
  str(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, chans, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * chans * 2, true);
  view.setUint16(32, chans * 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, frames * chans * 2, true);
  const data = Array.from({ length: chans }, (_, c) => buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < chans; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(off, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Record, then publish. ⚠️ BOTH halves, chained with `&&`: recording alone writes an mp4 and a
 * manifest to `demo-videos/` and changes nothing anyone can see, so a command that stopped there
 * would look like it had worked while the studio still said "no cue manifest".
 */
export function reRecordCommand(clip: string): string {
  return `npx tsx scripts/record-demo.mts ${clip} && npx tsx scripts/upload-demo-videos.mts --apply`;
}

/**
 * The exact commands to re-record a clip, copyable.
 *
 * ⚠️ IT TELLS YOU WHERE THE WORK HAPPENS RATHER THAN PRETENDING TO DO IT. Recording needs ffmpeg
 * and a full Chromium with `recordVideo`; this app runs on Vercel, which has neither, and a
 * guest build takes ~90s of real waiting. A button that enqueued a job would need a machine of
 * the owner's actually running `npm run render:worker` — `render_workers` is empty and one job
 * has ever run — so it would be a button that silently does nothing.
 *
 * ⚠️ The command is rendered as selectable text as well as copied, because `navigator.clipboard`
 * is unavailable on an insecure origin and can be denied by permission policy. A copy button
 * whose only failure mode is "nothing happened" is worse than no button.
 */
function ReRecordCommand({ clip }: { clip: string }) {
  const [copied, setCopied] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const cmd = reRecordCommand(clip);

  async function copy() {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setFailed(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Re-record on your machine
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded border border-border px-2 py-1 text-xs text-foreground hover:border-sky-500/50"
        >
          {copied ? 'Copied' : 'Copy command'}
        </button>
      </div>
      <code className="mt-2 block select-all whitespace-pre-wrap break-all rounded bg-muted px-2 py-1.5 font-mono text-[11px] leading-relaxed text-foreground">
        {cmd}
      </code>
      {failed ? (
        <p className="mt-1 text-[11px] text-amber-300">
          Clipboard blocked by the browser — select the text above instead.
        </p>
      ) : null}
      <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
        <li>
          Re-recording changes the clip&rsquo;s length, so its poster timestamp has to be
          re-picked — see <span className="font-mono">docs/DEMO_VIDEOS.md</span>.
        </li>
        {clip === 'guest-build' ? (
          <li className="text-amber-300">
            This one builds a real site on production and leaves an anonymous draft behind, which
            counts in the guest-build funnel.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

export default function NarrationStudio({ clips }: { clips: StudioClip[] }) {
  const [selected, setSelected] = React.useState<StudioClip | null>(clips[0] ?? null);
  const [manifest, setManifest] = React.useState<NarrationManifest | null>(null);
  const [manifestError, setManifestError] = React.useState<string | null>(null);
  const [allTakes, setAllTakes] = React.useState<StudioTake[]>([]);
  const [source, setSource] = React.useState<Source>('recorded');
  const [recording, setRecording] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [positionMs, setPositionMs] = React.useState(0);
  const [status, setStatus] = React.useState<string | null>(null);
  const [published, setPublished] = React.useState<string | null>(null);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const startedAtRef = React.useRef(0);
  const scheduledRef = React.useRef<HTMLAudioElement[]>([]);

  const key = selected?.recordedOn ? makeClipKey(clipName(selected.src), selected.recordedOn) : null;

  function clipName(src: string) {
    return (src.split('/').pop() ?? '').replace(/\.(mp4|webm|ogg)$/i, '');
  }

  // Load the manifest + existing takes whenever the clip changes.
  React.useEffect(() => {
    setManifest(null);
    setManifestError(null);
    setAllTakes([]);
    if (!selected) return;
    if (!selected.manifestUrl) {
      setManifestError(
        'No cue manifest for this recording. The per-line timings exist only inside the recorder ' +
          'and cannot be recovered from the video, so this clip has to be re-recorded before its ' +
          'narration can be placed.',
      );
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(selected.manifestUrl!, { cache: 'no-store' });
        const m = parseManifest(await res.json());
        if (cancelled) return;
        if (!m) setManifestError('The manifest for this clip is malformed.');
        else setManifest(m);
      } catch (e: any) {
        if (!cancelled) setManifestError(`Could not read the manifest: ${e?.message ?? e}`);
      }
      if (key) {
        const r = await fetch(`/api/admin/demo-narration?clipKey=${encodeURIComponent(key)}`);
        const j = await r.json().catch(() => ({}));
        if (!cancelled && j?.ok) setAllTakes(j.takes);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, key]);

  const takes = allTakes.filter((t) => t.source === source);
  const otherCount = allTakes.filter((t) => t.source !== source).length;
  const ttsBases = new Set(allTakes.filter((t) => t.source === 'tts').map((t) => t.voiceBasis));
  const ttsBasis = ttsBases.size === 1 ? [...ttsBases][0] : null;
  const plan = manifest ? planNarration(manifest, takes) : null;
  const current = manifest ? lineAt(manifest, positionMs) : null;

  async function startRecording(lineIndex: number) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        const durationMs = Math.max(1, Math.round(performance.now() - startedAtRef.current));
        await saveTake(lineIndex, blob, durationMs);
      };
      startedAtRef.current = performance.now();
      rec.start();
      recorderRef.current = rec;
      setRecording(lineIndex);
      setStatus(null);
    } catch (e: any) {
      setStatus(`Microphone unavailable: ${e?.message ?? e}`);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(null);
  }

  async function saveTake(lineIndex: number, blob: Blob, durationMs: number) {
    if (!key || !manifest) return;
    setBusy(`Saving line ${lineIndex + 1}…`);
    const body = new FormData();
    body.set('clipKey', key);
    body.set('lineIndex', String(lineIndex));
    body.set('durationMs', String(durationMs));
    body.set('said', manifest.lines.find((l) => l.index === lineIndex)?.say ?? '');
    body.set('audio', blob, `line-${lineIndex}.webm`);
    const res = await fetch('/api/admin/demo-narration', { method: 'POST', body });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok || !j?.ok) {
      setStatus(j?.error ?? 'Save failed.');
      return;
    }
    setAllTakes((prev) => [
      ...prev.filter((t) => !(t.lineIndex === lineIndex && t.source === 'recorded')),
      { lineIndex, url: j.url, durationMs: j.durationMs, source: 'recorded', voiceBasis: null },
    ]);
    setStatus(null);
  }

  async function deleteTake(lineIndex: number) {
    if (!key) return;
    setBusy(`Removing line ${lineIndex + 1}…`);
    await fetch(
      `/api/admin/demo-narration?clipKey=${encodeURIComponent(key)}&lineIndex=${lineIndex}&source=${source}`,
      { method: 'DELETE' },
    );
    setAllTakes((prev) => prev.filter((t) => !(t.lineIndex === lineIndex && t.source === source)));
    setBusy(null);
  }

  /** Play the video and fire each take at its cue. */
  function playWithNarration() {
    const v = videoRef.current;
    if (!v || !plan) return;
    stopScheduled();
    v.currentTime = 0;
    void v.play();
    scheduledRef.current = plan.placed.map((p) => {
      const a = new Audio(p.url);
      window.setTimeout(() => {
        if (!v.paused) void a.play().catch(() => {});
      }, p.startMs);
      return a;
    });
  }

  function stopScheduled() {
    scheduledRef.current.forEach((a) => {
      a.pause();
      a.currentTime = 0;
    });
    scheduledRef.current = [];
  }

  /**
   * Render the mix once; Download and Publish both use it.
   *
   * ⚠️ 24 kHz mono, not 48. A 48 kHz stereo WAV of a 33s clip is ~6 MB sitting in front of a
   * visitor who tapped a speaker icon; 24 kHz mono is ~1.5 MB and speech is indistinguishable.
   * The page loads it only on toggle, but "only on demand" is not a licence to ship 6 MB.
   */
  async function renderSoundtrack(): Promise<Blob | null> {
    if (!plan || plan.placed.length === 0) return null;
    const sampleRate = 24000;
    const decode = new AudioContext();
    const decoded = await Promise.all(
      plan.placed.map(async (p) => ({
        p,
        buf: await decode.decodeAudioData(await (await fetch(p.url)).arrayBuffer()),
      })),
    );
    await decode.close();

    // ⚠️ Length comes from the PLAN, not from the takes: a track that stops after the last
    // spoken word desyncs the instant anything plays it against the video.
    const frames = Math.ceil((plan.totalMs / 1000) * sampleRate);
    const offline = new OfflineAudioContext(1, frames, sampleRate);
    for (const { p, buf } of decoded) {
      const node = offline.createBufferSource();
      node.buffer = buf;
      node.connect(offline.destination);
      node.start(p.startMs / 1000);
    }
    const rendered = await offline.startRendering();

    // ⚠️ PULL THE PEAK BACK ONLY IF IT CLIPS. Summing takes can push samples to full scale —
    // the first real mix measured max_volume -0.0 dB, which is distortion, not loudness. This
    // is not a creative change to someone's voice: a sample above 1.0 is wrong, and scaling to
    // a -1 dBFS ceiling is the difference between hearing the recording and hearing the clip.
    // Measured, so a quiet mix is left exactly as recorded.
    const ch = rendered.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < ch.length; i++) {
      const v = Math.abs(ch[i]);
      if (v > peak) peak = v;
    }
    const CEILING = 0.891; // -1 dBFS
    if (peak > CEILING) {
      const g = CEILING / peak;
      for (let i = 0; i < ch.length; i++) ch[i] *= g;
    }

    return toWav(rendered);
  }

  async function buildSoundtrack() {
    setBusy('Mixing soundtrack…');
    try {
      const blob = await renderSoundtrack();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${clipName(selected!.src)}-${selected!.recordedOn}-narration.wav`;
      a.click();
      URL.revokeObjectURL(url);
      // ⚠️ NO PLACEHOLDER FILENAMES. This used to print
      // `ffmpeg -i clip.mp4 -i narration.wav …`; the owner pasted it verbatim and got
      // "No such file or directory". A command shown to a person must name real files, or be a
      // script that finds them — same mistake as the upload command that never loaded env.
      const n = clipName(selected!.src);
      setStatus(
        (plan!.complete ? 'Soundtrack downloaded.' : `Downloaded with ${plan!.missing.length} line(s) silent.`) +
          ` To burn it into a copy of the video: npx tsx scripts/mux-narration.mts ${n}` +
          ' (publish first — it reads the published track).',
      );
    } catch (e: any) {
      setStatus(`Mix failed: ${e?.message ?? e}`);
    }
    setBusy(null);
  }

  /** Ask HiveJournal to read every line in the owner's consented clone. */
  async function generateTts() {
    if (!key || !selected?.manifestUrl) return;
    const embedId = window.prompt(
      'HiveJournal embed id to synthesise with (the one whose voice clone is yours):',
    );
    if (!embedId) return;
    setBusy('Synthesising every line…');
    try {
      const res = await fetch('/api/admin/demo-narration/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipKey: key, manifestUrl: selected.manifestUrl, embedId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setStatus(
          j?.code === 'not_configured'
            ? 'Partner audio is not configured here.'
            : j?.error ?? 'Synthesis failed.',
        );
      } else {
        setStatus(
          `Synthesised ${j.generated} line(s)` +
            (j.failed ? `, ${j.failed} failed` : '') +
            ` — ${voiceLabel(j.voiceBasis)}.`,
        );
        const r = await fetch(`/api/admin/demo-narration?clipKey=${encodeURIComponent(key)}`);
        const g = await r.json().catch(() => ({}));
        if (g?.ok) setAllTakes(g.takes);
        setSource('tts');
      }
    } catch (e: any) {
      setStatus(`Synthesis failed: ${e?.message ?? e}`);
    }
    setBusy(null);
  }

  /** Publish the mix so visitors can toggle it on /features. */
  async function publishSoundtrack() {
    if (!plan || !key || !manifest || !selected) return;
    setBusy('Mixing and publishing…');
    try {
      const blob = await renderSoundtrack();
      if (!blob) return;
      const body = new FormData();
      body.set('clipKey', key);
      body.set('clipSrc', selected.src);
      body.set('durationMs', String(plan.totalMs));
      body.set('linesRecorded', String(plan.placed.length));
      body.set('linesTotal', String(manifest.lines.length));
      body.set('source', source);
      if (source === 'tts' && ttsBasis) body.set('voiceBasis', ttsBasis);
      body.set('audio', blob, 'narration.wav');
      const res = await fetch('/api/admin/demo-narration/publish', { method: 'POST', body });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setStatus(j?.error ?? 'Publish failed.');
      } else {
        setPublished(j.url);
        setStatus(
          plan.complete
            ? 'Published. Visitors can now toggle narration on /features.'
            : `Published with ${plan.missing.length} line(s) silent — /features says how many were read.`,
        );
      }
    } catch (e: any) {
      setStatus(`Publish failed: ${e?.message ?? e}`);
    }
    setBusy(null);
  }

  if (clips.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold text-foreground">Demo narration</h1>
        <p className="mt-3 text-muted-foreground">
          No demo clips are attached to any feature yet. Record one with{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npx tsx scripts/record-demo.mts</code>.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold text-foreground">Demo narration</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Read each line against the footage. Takes are saved per line, so you can re-read one
        without starting over.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {clips.map((c) => (
          <button
            key={c.src}
            type="button"
            onClick={() => {
              stopScheduled();
              setSelected(c);
              setPositionMs(0);
            }}
            className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
              selected?.src === c.src
                ? 'border-sky-500/60 bg-sky-500/10 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-zinc-600'
            }`}
          >
            <span className="block font-medium">{c.label}</span>
            <span className="block text-[11px] opacity-70">
              {c.feature}
              {c.recordedOn ? ` · ${c.recordedOn}` : ''}
            </span>
          </button>
        ))}
      </div>

      {selected ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <video
              ref={videoRef}
              src={selected.src}
              poster={selected.poster ?? undefined}
              controls
              playsInline
              onTimeUpdate={(e) => setPositionMs(e.currentTarget.currentTime * 1000)}
              onPause={stopScheduled}
              className="w-full rounded-lg border border-border bg-black"
            />

            {/* Teleprompter: the line that belongs to where the playhead is now. */}
            <div className="mt-3 min-h-[76px] rounded-lg border border-border bg-card p-4">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Now reading
              </div>
              <p className="mt-1 text-lg leading-snug text-foreground">
                {current?.say ?? <span className="text-muted-foreground">—</span>}
              </p>
            </div>

            {/* Which version is being previewed, mixed and published. */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex overflow-hidden rounded-lg border border-border">
                {(['recorded', 'tts'] as const).map((sv) => (
                  <button
                    key={sv}
                    type="button"
                    onClick={() => setSource(sv)}
                    className={`px-3 py-1.5 text-xs font-medium transition ${
                      source === sv
                        ? 'bg-sky-600 text-white'
                        : 'bg-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {sv === 'recorded' ? 'You, reading' : 'Cloned voice'}
                    <span className="ml-1.5 opacity-70">
                      {allTakes.filter((t) => t.source === sv).length}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={generateTts}
                disabled={!manifest || !!busy}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground disabled:opacity-40"
              >
                Synthesise all lines
              </button>
              {otherCount > 0 ? (
                <span className="text-[11px] text-muted-foreground">
                  {otherCount} take(s) in the other version
                </span>
              ) : null}
            </div>

            {/* ⚠️ The honesty line. Only `self` may be described as the owner's voice; an
                unreported basis renders as unknown, never optimistically. */}
            {source === 'tts' && allTakes.some((t) => t.source === 'tts') ? (
              <p
                className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
                  ttsBasis === 'self'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                }`}
              >
                Synthesised — {voiceLabel(ttsBasis)}.
                {ttsBasis !== 'self'
                  ? ' Do not publish this as your own voice.'
                  : ''}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={playWithNarration}
                disabled={!plan || plan.placed.length === 0}
                className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Play with narration
              </button>
              <button
                type="button"
                onClick={publishSoundtrack}
                disabled={!plan || plan.placed.length === 0 || !!busy}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Publish to /features
              </button>
              <button
                type="button"
                onClick={buildSoundtrack}
                disabled={!plan || plan.placed.length === 0 || !!busy}
                className="rounded-lg border border-border px-3 py-2 text-sm text-foreground disabled:opacity-40"
              >
                Download WAV
              </button>
            </div>

            {busy ? <p className="mt-2 text-xs text-sky-300">{busy}</p> : null}
            {status ? <p className="mt-2 text-xs text-amber-200">{status}</p> : null}
            {published ? (
              <p className="mt-1 text-xs text-emerald-300">
                Live:{' '}
                <a href={published} target="_blank" rel="noreferrer" className="underline">
                  narration track
                </a>{' '}
                — open /features and toggle the speaker on this clip.
              </p>
            ) : null}
          </div>

          <div>
            {manifestError ? (
              <>
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                  {manifestError}
                </p>
                <ReRecordCommand clip={clipName(selected.src)} />
              </>
            ) : !manifest ? (
              <p className="text-xs text-muted-foreground">Loading cues…</p>
            ) : (
              <ol className="space-y-2">
                {manifest.lines.map((line) => {
                  const take = takes.find((t) => t.lineIndex === line.index);
                  const placed = plan?.placed.find((p) => p.lineIndex === line.index);
                  const isRec = recording === line.index;
                  return (
                    <li
                      key={line.index}
                      className={`rounded-lg border p-3 ${
                        current?.index === line.index
                          ? 'border-sky-500/60 bg-sky-500/10'
                          : 'border-border bg-card'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {fmt(line.startMs)}
                        </span>
                        {take ? (
                          <span className="text-[11px] tabular-nums text-emerald-300">
                            {(take.durationMs / 1000).toFixed(1)}s
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">not recorded</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm leading-snug text-foreground">{line.say}</p>

                      {placed && placed.overrunMs > 0 ? (
                        <p className="mt-1 text-[11px] text-amber-300">
                          Runs {(placed.overrunMs / 1000).toFixed(1)}s past the next cue — read it
                          shorter, or let it overlap on purpose.
                        </p>
                      ) : null}

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (isRec) stopRecording();
                            else {
                              const v = videoRef.current;
                              if (v) v.currentTime = line.startMs / 1000;
                              void startRecording(line.index);
                            }
                          }}
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            isRec ? 'bg-red-600 text-white' : 'bg-zinc-700 text-zinc-100'
                          }`}
                        >
                          {isRec ? '■ Stop' : take ? 'Re-record' : '● Record'}
                        </button>
                        {take ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void new Audio(take.url).play()}
                              className="rounded border border-border px-2 py-1 text-xs text-foreground"
                            >
                              Play
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteTake(line.index)}
                              className="rounded border border-border px-2 py-1 text-xs text-muted-foreground"
                            >
                              Delete
                            </button>
                          </>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {plan && !plan.complete ? (
              <p className="mt-3 text-[11px] text-muted-foreground">
                {plan.missing.length} line(s) unrecorded — they stay silent in the mix. Nothing
                here substitutes a synthetic voice for yours.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
