// lib/demos/__tests__/planDemoClips.test.ts
//
// Both rules here were WRONG on the first real run, and neither failure would have failed a build:
// one left the headline player on a stale cut, the other showed the same clip twice. Found by
// reading the rows the script wrote, not by its exit code.

import { planDemoClips } from '@/lib/demos/planDemoClips';

const BASE = 'https://x.supabase.co/storage/v1/object/public/videos';
const dated = (name: string, d = '2026-10-01') => `${BASE}/demos/${d}/${name}.mp4`;
const undated = (name: string) => `${BASE}/demos/${name}.mp4`;

const tour = {
  src: dated('editor-tour'),
  name: 'editor-tour',
  date: '2026-10-01',
  label: 'Editing blocks',
  primary: true,
};
const guest = {
  src: dated('guest-build'),
  name: 'guest-build',
  date: '2026-10-01',
  label: 'Signed-out build',
};

describe('rule 1 — repointing the big player', () => {
  it('fills an empty video_url with the primary take', () => {
    const r = planDemoClips({ currentVideoUrl: null, currentClips: [], uploaded: [tour] });
    expect(r.videoUrl).toBe(dated('editor-tour'));
    // ⚠️ CHANGED DELIBERATELY 2026-10-01, not a regression. The primary used to be excluded
    // from the catalogue because it rendered as a big inline player above the rest. They are
    // now peer cards in one row, so a primary left out would be the one card with no poster
    // and no duration — the single blank box in the row.
    expect(r.clips.map((c) => c.src)).toEqual([dated('editor-tour')]);
  });

  // ⚠️ The first version used `!videoUrl` alone. The editor's player already pointed at the old
  // UNDATED path, so the dated re-record went to demo_clips and the headline stayed stale —
  // silently defeating the entire point of dating the paths.
  it('REPOINTS an existing url when that url is one of ours', () => {
    const r = planDemoClips({
      currentVideoUrl: undated('editor-tour'),
      currentClips: [],
      uploaded: [tour],
    });
    expect(r.videoUrl).toBe(dated('editor-tour'));
  });

  it('never overwrites a hand-set url that is not ours', () => {
    const hand = 'https://www.youtube.com/watch?v=abc123';
    const r = planDemoClips({ currentVideoUrl: hand, currentClips: [], uploaded: [tour] });
    expect(r.videoUrl).toBe(hand);
    // The new take still reaches the page, as an extra clip.
    expect(r.clips.map((c) => c.src)).toContain(dated('editor-tour'));
  });

  it('leaves the player alone when no uploaded take is primary', () => {
    const r = planDemoClips({
      currentVideoUrl: undated('editor-tour'),
      currentClips: [],
      uploaded: [guest],
    });
    expect(r.videoUrl).toBe(undated('editor-tour'));
  });
});

describe('rule 2 — an "earlier take" must really be earlier', () => {
  // ⚠️ THE BUG THIS FILE EXISTS FOR. `demos/editor-tour.mp4` and
  // `demos/2026-10-01/editor-tour.mp4` were byte-identical (845,278 each): the same recording
  // moving to a dated path, not a previous version. Filing it as history shows one clip twice.
  it('does not keep the old url when the same recording just moved to a dated path', () => {
    const r = planDemoClips({
      currentVideoUrl: undated('editor-tour'),
      currentClips: [],
      uploaded: [tour],
    });
    expect(r.videoUrl).toBe(dated('editor-tour'));
    expect(r.clips.map((c) => c.src)).not.toContain(undated('editor-tour'));
    // The dated take is in the catalogue (as a peer card); the undated duplicate is not.
    expect(r.clips.map((c) => c.src)).toEqual([dated('editor-tour')]);
  });

  it('DOES keep a genuinely different earlier take', () => {
    const r = planDemoClips({
      currentVideoUrl: dated('editor-tour', '2026-08-01'),
      currentClips: [],
      uploaded: [{ ...tour, name: 'editor-tour-v2', src: dated('editor-tour-v2') }],
    });
    expect(r.videoUrl).toBe(dated('editor-tour-v2'));
    expect(r.clips.map((c) => c.src)).toContain(dated('editor-tour', '2026-08-01'));
  });
});

describe('narration across a re-publish', () => {
  const narrated = {
    src: dated('guest-build'),
    label: 'x',
    recorded_on: '2026-10-01',
    duration_seconds: 32.76,
    narration: 'https://x/narration.wav',
    narration_lines_recorded: 6,
    narration_lines_total: 6,
  };

  // ⚠️ The upload script rebuilds every clip entry, so without this a re-run silently strips a
  // published narration track — symptom: a speaker icon quietly vanishing from /features.
  it('keeps narration when the clip is unchanged', () => {
    const r = planDemoClips({
      currentVideoUrl: null,
      currentClips: [narrated],
      uploaded: [{ ...guest, durationSeconds: 32.76 }],
    });
    expect(r.clips[0].narration).toBe('https://x/narration.wav');
    expect(r.clips[0].narration_lines_recorded).toBe(6);
  });

  // ⚠️ And drops it on a re-record. A same-day re-record reuses the same dated path, so keeping
  // the track would play a voice over footage it was never timed against — worse than silence
  // and much harder to notice. Duration is the fingerprint; re-records always move it.
  it('drops narration when the duration changed (a different cut)', () => {
    const r = planDemoClips({
      currentVideoUrl: null,
      currentClips: [narrated],
      uploaded: [{ ...guest, durationSeconds: 31.02 }],
    });
    expect(r.clips[0].narration).toBeUndefined();
    expect(r.clips[0].duration_seconds).toBe(31.02);
  });

  it('drops narration when the new upload reports no duration at all', () => {
    const r = planDemoClips({ currentVideoUrl: null, currentClips: [narrated], uploaded: [guest] });
    expect(r.clips[0].narration).toBeUndefined();
  });
});

describe('idempotency and ordering', () => {
  it('re-running with the same uploads changes nothing', () => {
    const first = planDemoClips({ currentVideoUrl: null, currentClips: [], uploaded: [tour, guest] });
    const second = planDemoClips({
      currentVideoUrl: first.videoUrl,
      currentClips: first.clips,
      uploaded: [tour, guest],
    });
    expect(second).toEqual(first);
    // And a third time, since a duplicate usually appears on the run after the one you check.
    expect(
      planDemoClips({ currentVideoUrl: second.videoUrl, currentClips: second.clips, uploaded: [tour, guest] }),
    ).toEqual(first);
  });

  it('a same-day re-record updates in place rather than appending', () => {
    const before = planDemoClips({ currentVideoUrl: null, currentClips: [], uploaded: [tour, guest] });
    const after = planDemoClips({
      currentVideoUrl: before.videoUrl,
      currentClips: before.clips,
      uploaded: [{ ...guest, label: 'Signed-out build (re-cut)' }],
    });
    // tour (the primary) + the re-cut guest clip — the re-cut replaced its own entry rather
    // than appending a second one, which is what this test is about.
    expect(after.clips).toHaveLength(2);
    expect(after.clips.find((c) => c.src === dated('guest-build'))?.label).toBe(
      'Signed-out build (re-cut)',
    );
  });

  it('orders newest first and tolerates an undated entry', () => {
    const r = planDemoClips({
      currentVideoUrl: null,
      currentClips: [{ src: undated('legacy') }, { src: dated('old', '2026-07-01'), recorded_on: '2026-07-01' }],
      uploaded: [guest],
    });
    expect(r.clips.map((c) => c.recorded_on ?? null)).toEqual(['2026-10-01', '2026-07-01', null]);
  });

  it('carries poster, blurb and measured duration onto the clip', () => {
    const r = planDemoClips({
      currentVideoUrl: null,
      currentClips: [],
      uploaded: [{ ...guest, poster: dated('guest-build').replace('.mp4', '.jpg'), blurb: 'A stranger builds one', durationSeconds: 28.8 }],
    });
    const c = r.clips[0];
    expect(c.poster).toContain('.jpg');
    expect(c.blurb).toBe('A stranger builds one');
    expect(c.duration_seconds).toBe(28.8);
  });

  it('omits poster/duration keys entirely when not measured, rather than writing nulls', () => {
    // A null duration would render as a "0:00" pill; an absent one renders no pill.
    const r = planDemoClips({ currentVideoUrl: null, currentClips: [], uploaded: [guest] });
    expect(Object.keys(r.clips[0])).not.toContain('poster');
    expect(Object.keys(r.clips[0])).not.toContain('duration_seconds');
  });

  it('ignores malformed existing entries instead of rendering a dead player', () => {
    const r = planDemoClips({
      currentVideoUrl: null,
      currentClips: [null, { label: 'no src' }, { src: '' }, 'nope'],
      uploaded: [guest],
    });
    expect(r.clips.map((c) => c.src)).toEqual([dated('guest-build')]);
  });

  it('survives demo_clips being a non-array (the column is free-form jsonb)', () => {
    const r = planDemoClips({ currentVideoUrl: null, currentClips: { oops: true }, uploaded: [guest] });
    expect(r.clips).toHaveLength(1);
  });
});
