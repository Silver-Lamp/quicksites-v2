// lib/demos/__tests__/narration.test.ts

import {
  clipKey,
  parseClipKey,
  parseManifest,
  planNarration,
  lineAt,
  type NarrationManifest,
} from '@/lib/demos/narration';

const manifest: NarrationManifest = {
  clip: 'finished-site',
  recordedOn: '2026-10-01',
  durationSeconds: 19.9,
  lines: [
    { index: 0, say: 'A real site built with QuickSites.', startMs: 0, endMs: 5200 },
    { index: 1, say: 'Scroll through it.', startMs: 5200, endMs: 10200 },
    { index: 2, say: 'A different shape, same builder.', startMs: 10200, endMs: 19900 },
  ],
};

describe('clipKey', () => {
  // ⚠️ Takes are scoped to a RECORDING, not a clip name: re-recording shifts every cue, so a
  // take keyed on "finished-site" alone would play over footage it was never timed against.
  it('round-trips clip and date', () => {
    expect(clipKey('finished-site', '2026-10-01')).toBe('finished-site@2026-10-01');
    expect(parseClipKey('finished-site@2026-10-01')).toEqual({
      clip: 'finished-site',
      recordedOn: '2026-10-01',
    });
  });

  it('rejects malformed keys rather than guessing', () => {
    expect(parseClipKey('finished-site')).toBeNull();
    expect(parseClipKey('@2026-10-01')).toBeNull();
    expect(parseClipKey('finished-site@')).toBeNull();
  });
});

describe('parseManifest', () => {
  it('accepts a real manifest and sorts by cue', () => {
    const m = parseManifest({ ...manifest, lines: [...manifest.lines].reverse() });
    expect(m?.lines.map((l) => l.startMs)).toEqual([0, 5200, 10200]);
  });

  it('returns null rather than throwing on junk', () => {
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest({ clip: 'x' })).toBeNull();
    expect(parseManifest({ ...manifest, lines: [{ say: 'x', startMs: 'soon', endMs: 1 }] })).toBeNull();
    // endMs before startMs is a corrupt cue, not a zero-length one.
    expect(parseManifest({ ...manifest, lines: [{ say: 'x', startMs: 500, endMs: 100 }] })).toBeNull();
  });
});

describe('planNarration', () => {
  const take = (i: number, ms: number) => ({ lineIndex: i, url: `https://x/${i}.webm`, durationMs: ms });

  it('places each take at its line cue', () => {
    const plan = planNarration(manifest, [take(0, 3000), take(1, 2000), take(2, 4000)]);
    expect(plan.placed.map((p) => p.startMs)).toEqual([0, 5200, 10200]);
    expect(plan.complete).toBe(true);
    expect(plan.missing).toEqual([]);
  });

  // ⚠️ A missing take is SILENCE. Never TTS: the track is presented as the owner's voice, and
  // patching a gap with a machine voice is the mislabelling the audio-honesty standard forbids.
  it('reports unrecorded lines instead of filling them', () => {
    const plan = planNarration(manifest, [take(0, 3000)]);
    expect(plan.complete).toBe(false);
    expect(plan.missing.map((l) => l.index)).toEqual([1, 2]);
    expect(plan.placed).toHaveLength(1);
  });

  // ⚠️ Overrun is reported, not trimmed — cutting a sentence to fit removes words the person said.
  it('reports a take that runs into the next cue', () => {
    const plan = planNarration(manifest, [take(0, 7000), take(1, 1000), take(2, 1000)]);
    expect(plan.placed[0].overrunMs).toBe(1800); // 7000 - 5200
    expect(plan.placed[1].overrunMs).toBe(0);
  });

  it('extends the track when the last take overruns the video', () => {
    const plan = planNarration(manifest, [take(2, 12000)]); // 10200 + 12000 = 22200 > 19900
    expect(plan.totalMs).toBe(22200);
  });

  it('covers the whole video even when narration ends early', () => {
    const plan = planNarration(manifest, [take(0, 500)]);
    expect(plan.totalMs).toBe(19900);
  });

  it('is not complete when there are no lines at all', () => {
    expect(planNarration({ ...manifest, lines: [] }, []).complete).toBe(false);
  });

  it('ignores a take whose url is empty', () => {
    const plan = planNarration(manifest, [{ lineIndex: 0, url: '', durationMs: 1000 }]);
    expect(plan.placed).toHaveLength(0);
    expect(plan.missing.map((l) => l.index)).toEqual([0, 1, 2]);
  });
});

describe('lineAt (the teleprompter)', () => {
  it('shows the line whose cue has passed', () => {
    expect(lineAt(manifest, 0)?.index).toBe(0);
    expect(lineAt(manifest, 5199)?.index).toBe(0);
    expect(lineAt(manifest, 5200)?.index).toBe(1);
    expect(lineAt(manifest, 19000)?.index).toBe(2);
  });

  it('returns null before the first cue', () => {
    expect(lineAt({ ...manifest, lines: [{ index: 0, say: 'x', startMs: 500, endMs: 900 }] }, 100))
      .toBeNull();
  });
});
