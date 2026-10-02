// scripts/record-demo.mts
//
// RECORD A REAL SCREEN WALKTHROUGH OF THE PRODUCT, AUTOMATICALLY.
//
//   npx tsx scripts/record-demo.mts --list
//   npx tsx scripts/record-demo.mts guest-build
//   npx tsx scripts/record-demo.mts guest-build --local --keep-webm
//
// Asked for twice on the 2026-09-30 call: *"when it actually moves and walks through like you
// were just doing, so you can actually see."*
//
// ⚠️ THIS IS DELIBERATELY NOT HIVEJOURNAL'S APPROACH, AND THE DIFFERENCE IS THE WHOLE POINT.
// `apps/backend/src/services/demo-video.ts` over there renders one caption card per step and
// muxes house narration over it — a narrated slideshow. Its own header says why: *"true
// recordVideo needs xvfb + full Chromium."* That is true of their runtime, not of ours.
// QuickSites already runs Playwright 1.54 for e2e, and Playwright records real video in
// headless Chromium with no xvfb at all. A slideshow of stills is not what was asked for.
//
// ⚠️ PLAYWRIGHT DRAWS NO MOUSE CURSOR. Out of the box the video shows menus opening and fields
// filling with nothing visibly causing it — which reads as a glitchy screen capture rather than
// a person using software. `installCursor()` injects one and moves it with every action. It is
// not decoration; without it the recording is actively confusing to watch.
//
// ⚠️ IT RECORDS AGAINST PRODUCTION BY DEFAULT, and that is the honest choice: a demo of a
// staging build is a demo of something nobody can sign up for. The cost is that a guest-build
// scenario leaves a real anonymous draft row behind, same as any visitor. `--local` points at
// localhost:3000 instead.
import { chromium, type Page } from 'playwright';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const PROD = 'https://www.quicksites.ai';
const LOCAL = 'http://localhost:3000';
const OUT_DIR = path.resolve('demo-videos');

/** 720p. Bigger looks better and takes longer to upload; this is the size people watch at. */
const VIEWPORT = { width: 1280, height: 720 };

type Step = {
  say: string;
  run: (p: Page) => Promise<void>;
  /**
   * Speed this step up in post.
   *
   * ⚠️ Added because the guest build takes ~55 SECONDS on production, so 45s of an 80s
   * recording was a loading spinner. That is honest footage and unwatchable as a demo. The
   * wait is compressed rather than cut, so a viewer still sees that building takes real time —
   * trimming it to a jump cut would imply it is instant.
   */
  timelapse?: boolean;
};
type Scenario = { name: string; title: string; steps: (base: string) => Step[] };

// ── pacing ───────────────────────────────────────────────────────────────────────────────────
//
// ⚠️ A test races; a demo has to be followable. Playwright fills a field in milliseconds, which
// on video looks like the form filling itself. These waits are the single biggest difference
// between a recording someone watches and one they scrub past.
const BEAT = 900;
const READ = 2200;
const beat = (p: Page, ms = BEAT) => p.waitForTimeout(ms);

/**
 * A visible cursor, because Playwright does not draw one.
 *
 * ⚠️ INJECTED AFTER EACH NAVIGATION, NOT VIA `addInitScript`. The first version used an init
 * script appending to `document.documentElement`, and the element was GONE by the time the page
 * finished loading — a probe reported `exists after load: false`. An init script runs while the
 * document is still being parsed, so anything attached to `documentElement` is discarded when
 * the parser builds the real tree. Re-injecting after load is boring and works.
 *
 * Idempotent, so calling it on every step costs nothing.
 */
async function injectCursor(p: Page): Promise<void> {
  await p.evaluate(() => {
    if (document.getElementById('__demo_cursor')) return;
    const el = document.createElement('div');
    el.id = '__demo_cursor';
    el.style.cssText = [
      'position:fixed', 'z-index:2147483647', 'top:0', 'left:0',
      'width:24px', 'height:24px', 'border-radius:50%',
      'background:rgba(56,189,248,.30)', 'border:2.5px solid #38bdf8',
      'box-shadow:0 0 14px rgba(56,189,248,.9)',
      'pointer-events:none', 'transform:translate(-100px,-100px)',
    ].join(';');
    (document.body ?? document.documentElement).appendChild(el);
    window.addEventListener(
      'mousemove',
      (e) => {
        el.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%,-50%)`;
      },
      { passive: true },
    );
  }).catch(() => {});
}

/**
 * Move the visible cursor to an element, then act.
 *
 * ⚠️ `page.click()` and `page.mouse.wheel()` do NOT emit `mousemove`, so without an explicit
 * move the pointer never appears and fields fill themselves on camera. Moving first also makes
 * the motion legible: the dot travels to the control before it is used, the way a hand would.
 */
async function moveTo(p: Page, selector: string): Promise<void> {
  await injectCursor(p);
  const box = await p.locator(selector).first().boundingBox().catch(() => null);
  if (!box) return;
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 });
  await beat(p, 320);
}

/** Park the cursor on screen after a navigation, before anything else happens. */
async function showCursor(p: Page) {
  await injectCursor(p);
  await p.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2, { steps: 12 });
  await beat(p, 240);
}

/** Type at human speed so the viewer can read what is being entered. */
async function typeSlowly(p: Page, selector: string, text: string) {
  await moveTo(p, selector);
  await p.click(selector);
  await p.type(selector, text, { delay: 85 });
}


/**
 * Click the first control that matches any of these names, and say so when none match.
 *
 * ⚠️ Silence on a miss is the trap. The first version of the build step tried four labels and
 * swallowed every failure, so a copy change would have produced a clean exit code and a video
 * of nothing happening. A demo recorder that cannot find its button must SAY so — the warning
 * is the difference between "re-record it" and "ship a video of a frozen page".
 */
async function clickAny(p: Page, names: RegExp[], what: string): Promise<boolean> {
  await injectCursor(p);
  for (const name of names) {
    const b = p.getByRole('button', { name }).first();
    if (!(await b.count().then((n) => n > 0).catch(() => false))) continue;
    const box = await b.boundingBox().catch(() => null);
    if (box) await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
    await beat(p, 300);
    await b.click().catch(() => {});
    return true;
  }
  console.warn(`     ⚠️ no control matched for "${what}" — the recording will show nothing here`);
  return false;
}

// ── scenarios ────────────────────────────────────────────────────────────────────────────────
//
// Data, not code paths: adding a walkthrough is one entry here. Each step carries the line a
// narrator would read, so the same list can drive captions or a voiceover later without the
// steps being rewritten.
const SCENARIOS: Scenario[] = [
  {
    name: 'guest-build',
    title: 'Building a site from nothing, as a first-time visitor',
    steps: (base) => [
      {
        say: 'Start at the homepage — no account, nothing installed.',
        run: async (p) => { await p.goto(base, { waitUntil: 'networkidle' }); await showCursor(p); await beat(p, READ); },
      },
      {
        say: 'Go straight to the builder.',
        run: async (p) => { await p.goto(`${base}/build`, { waitUntil: 'networkidle' }); await showCursor(p); await beat(p, READ); },
      },
      {
        say: 'Type the business name.',
        run: async (p) => {
          const input = p.locator('input[type="text"]').first();
          await input.waitFor({ state: 'visible', timeout: 15_000 });
          await typeSlowly(p, 'input[type="text"]', "Wildflower Candle Co.");
          await beat(p);
        },
      },
      {
        say: 'Pick an industry and let it build.',
        timelapse: true,
        run: async (p) => {
          // ⚠️ Several labels have shipped for this button. Try them in order rather than
          // pinning one, so a copy change degrades to "no click" instead of a crashed recording.
          for (const name of [/build my site/i, /start building/i, /create/i, /continue/i]) {
            const b = p.getByRole('button', { name }).first();
            if (await b.count().then((n) => n > 0).catch(() => false)) {
              const box = await b.boundingBox().catch(() => null);
              if (box) await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 });
              await beat(p, 320);
              await b.click().catch(() => {});
              break;
            }
          }
          // ⚠️ WAIT FOR THE EDITOR, NEVER A FIXED TIMEOUT. The first run used `beat(p, 4000)`
          // and the recording ended while the page still read "Building your site …" — so the
          // narration promised "the editor opens on a working site" over footage that never
          // showed it. A demo whose voiceover describes something off-camera is worse than no
          // demo. The build does real work (scaffold + hero image, ~20s+), so this waits on the
          // URL the editor actually lands at.
          await p
            .waitForURL(/\/admin\/templates\//, { timeout: 120_000 })
            .catch(() => console.warn('     ⚠️ editor URL never appeared — build may have failed'));
          await p.waitForLoadState('networkidle').catch(() => {});
          await beat(p, 2000);
        },
      },
      {
        say: 'The editor opens on a working site — not a blank page.',
        run: async (p) => { await beat(p, READ * 2); },
      },
      {
        say: 'Scroll the page the visitor would see.',
        run: async (p) => {
          for (let i = 0; i < 5; i++) { await p.mouse.wheel(0, 420); await beat(p, 650); }
          await beat(p, READ);
        },
      },
    ],
  },
  {
    name: 'editor-tour',
    title: 'Editing a site — the parts people react to',
    steps: (base) => [
      {
        say: 'Build a site first, so there is something to edit.',
        timelapse: true,
        run: async (p) => {
          await p.goto(`${base}/build`, { waitUntil: 'networkidle' });
          await showCursor(p);
          await typeSlowly(p, 'input[type="text"]', 'Wildflower Candle Co.');
          await clickAny(p, [/build my site/i, /start building/i, /create/i], 'build');
          await p
            .waitForURL(/\/admin\/templates\//, { timeout: 120_000 })
            .catch(() => console.warn('     ⚠️ editor never opened'));
          await p.waitForLoadState('networkidle').catch(() => {});
          // ⚠️ The Pages panel opens by default and sits over the middle of the site, so the
          // first recording showed the product through a floating panel for 30 seconds.
          // Closing it is a real control a person would use, not a staged screenshot — but
          // leaving it open would have made every later step harder to read.
          await clickAny(p, [/^close$/i], 'close the Pages panel');
          await beat(p, 1500);
        },
      },
      {
        say: 'Shuffle — a different look without touching a single setting.',
        run: async (p) => {
          for (let i = 0; i < 3; i++) {
            await clickAny(p, [/shuffle/i], 'shuffle');
            await beat(p, 1800);
          }
        },
      },
      {
        say: 'Light and dark, switched live.',
        run: async (p) => {
          await clickAny(p, [/^light$/i], 'light mode');
          await beat(p, READ);
          await clickAny(p, [/^dark$/i], 'dark mode');
          await beat(p, READ);
        },
      },
      {
        say: 'See it the way a customer on a phone would.',
        run: async (p) => {
          // ⚠️ Addressed by TITLE, not by position. The first version indexed into
          // `footer button` and matched nothing — the warning fired and that step recorded a
          // frozen page. These buttons are icon-only with `title="Mobile width"` etc
          // (TemplateActionToolbar.tsx), which is a real accessible name and survives a
          // restyle in a way `nth(1)` does not.
          await injectCursor(p);
          for (const title of ['Mobile width', 'Tablet width', 'Desktop width']) {
            const b = p.getByTitle(title).first();
            if (!(await b.isVisible().catch(() => false))) {
              console.warn(`     ⚠️ "${title}" not found — that device view is missing from the video`);
              continue;
            }
            const box = await b.boundingBox().catch(() => null);
            if (box) await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 16 });
            await beat(p, 280);
            await b.click().catch(() => {});
            await beat(p, 1800);
          }
        },
      },
      {
        say: 'Everything saves as you go — it is yours when you sign up.',
        run: async (p) => { await showCursor(p); await beat(p, READ * 2); },
      },
    ],
  },
  {
    name: 'finished-site',
    title: 'A finished site, as a customer sees it',
    steps: (base) => [
      {
        say: 'A real site built with QuickSites.',
        run: async (p) => {
          await p.goto('https://starter-crafts.quicksites.ai/', { waitUntil: 'networkidle' });
          await showCursor(p);
          await beat(p, READ);
        },
      },
      {
        say: 'Scroll through it.',
        run: async (p) => {
          await injectCursor(p);
          for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 380); await beat(p, 620); }
        },
      },
      {
        say: 'And a completely different shape from the same builder.',
        run: async (p) => {
          await p.goto('https://ws-asphalt-paving.quicksites.ai/', { waitUntil: 'networkidle' });
          await showCursor(p);
          await beat(p, READ);
          for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 380); await beat(p, 620); }
        },
      },
    ],
  },
];

// ── runner ───────────────────────────────────────────────────────────────────────────────────

async function record(scenario: Scenario, base: string, keepWebm: boolean) {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: OUT_DIR, size: VIEWPORT },
    deviceScaleFactor: 2, // retina-sharp text; the whole point is that it is readable
  });
  const page = await context.newPage();

  const steps = scenario.steps(base);
  // Wall-clock ranges relative to recording start, so post-processing knows which seconds of
  // the finished file correspond to which step.
  const t0 = Date.now();
  const ranges: { from: number; to: number; timelapse: boolean }[] = [];
  console.log(`\n▶ ${scenario.name} — ${scenario.title}`);
  for (const [i, step] of steps.entries()) {
    const from = (Date.now() - t0) / 1000;
    process.stdout.write(`   ${i + 1}/${steps.length} ${step.say}\n`);
    try {
      await step.run(page);
    } catch (e: any) {
      // ⚠️ Keep recording. A step that cannot find its button is worth SEEING in the output —
      // that is how yesterday's demo surfaced a real bug — and aborting would throw away the
      // footage leading up to it.
      console.warn(`     ⚠️ step failed, continuing: ${e?.message ?? e}`);
    }
    ranges.push({ from, to: (Date.now() - t0) / 1000, timelapse: !!step.timelapse });
  }

  const videoPath = await page.video()?.path();
  await context.close();
  await browser.close();
  if (!videoPath) throw new Error('no video produced');

  // ⚠️ LOCAL date, not `toISOString()`. "Recorded on" is a fact about when a person sat down and
  // recorded it, and UTC rolls over at 5pm Pacific — so an evening session stamped tomorrow's
  // date, told viewers the wrong day on the card, filed the clip in the wrong dated folder, and
  // (because the date is part of the storage path) published a SECOND copy of a clip that
  // already existed rather than replacing it. Caught at 19:12 PDT, which `toISOString()` called
  // the 2nd.
  const stamp = new Date().toLocaleDateString('en-CA');
  const webm = path.join(OUT_DIR, `${scenario.name}-${stamp}.webm`);
  const mp4 = path.join(OUT_DIR, `${scenario.name}-${stamp}.mp4`);
  await fs.rename(videoPath, webm);

  // H.264 + faststart: plays inline in Slack, Keynote and every browser. A raw .webm does not.
  //
  // ⚠️ Flagged steps are SPED UP, not cut. `setpts` over the whole file would make the reading
  // beats unreadable; a jump cut over the build would imply it is instant. Segments are split
  // on the recorded step boundaries, the flagged ones re-timed, and the pieces concatenated.
  const SPEED = 8;
  // Output-timeline duration of each step, in the FINISHED mp4. ⚠️ Not the same as the recorded
  // range: flagged steps are sped up 8x, so a narration cue placed at a raw timestamp lands in
  // the wrong place — usually minutes late. Measured from the encoded segments rather than
  // computed from `to - from`, because re-encoding rounds to frame boundaries and the drift
  // accumulates across every step before the one you care about.
  const outDurations: number[] = [];
  const needsTimelapse = ranges.some((r) => r.timelapse && r.to - r.from > 6);
  if (!needsTimelapse) {
    await run('ffmpeg', [
      '-y', '-i', webm,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '22',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      mp4,
    ]);
    // No re-timing happened, so each step occupies exactly the wall-clock it took.
    for (const r of ranges) outDurations.push(Math.max(0.2, r.to - r.from));
  } else {
    const parts: string[] = [];
    for (const [i, r] of ranges.entries()) {
      const seg = path.join(OUT_DIR, `.seg_${i}.mp4`);
      const dur = Math.max(0.2, r.to - r.from);
      const fast = r.timelapse && dur > 6;
      await run('ffmpeg', [
        '-y', '-ss', String(r.from), '-t', String(dur), '-i', webm,
        '-vf', fast ? `setpts=PTS/${SPEED}` : 'setpts=PTS',
        '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p',
        seg,
      ]);
      parts.push(seg);
      const { stdout: segDur } = await run('ffprobe', [
        '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', seg,
      ]);
      outDurations.push(Number(segDur.trim()) || (fast ? dur / SPEED : dur));
    }
    const listFile = path.join(OUT_DIR, '.concat.txt');
    await fs.writeFile(listFile, parts.map((f) => `file '${path.basename(f)}'`).join('\n'));
    await run('ffmpeg', [
      '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '22',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      mp4,
    ]);
    await Promise.all([...parts, listFile].map((f) => fs.rm(f, { force: true })));
    const slow = ranges.filter((r) => r.timelapse && r.to - r.from > 6);
    for (const r of slow) {
      console.log(`   ⏩ compressed ${(r.to - r.from).toFixed(0)}s of waiting to ~${((r.to - r.from) / SPEED).toFixed(0)}s`);
    }
  }
  if (!keepWebm) await fs.rm(webm, { force: true });

  const { size } = await fs.stat(mp4);
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4,
  ]);
  console.log(`\n✅ ${mp4}`);
  console.log(`   ${(size / 1_048_576).toFixed(1)} MB · ${Number(stdout.trim()).toFixed(1)}s`);
  // ⚠️ THE MANIFEST IS THE POINT, not a by-product. Without per-line offsets on the FINAL
  // timeline there is no way to place narration except by ear, and the recorder is the only
  // thing that ever knows them — they are gone the moment the process exits.
  let acc = 0;
  const lines = steps.map((st, i) => {
    const startMs = Math.round(acc * 1000);
    acc += outDurations[i] ?? 0;
    return { index: i, say: st.say, startMs, endMs: Math.round(acc * 1000) };
  });
  const manifest = {
    clip: scenario.name,
    recordedOn: stamp,
    durationSeconds: Number(Number(stdout.trim()).toFixed(2)),
    lines,
  };
  const manifestPath = path.join(OUT_DIR, `${scenario.name}-${stamp}.json`);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`   narration script (cues on the finished timeline):`);
  for (const l of lines) {
    console.log(`     ${(l.startMs / 1000).toFixed(1).padStart(5)}s  ${l.say}`);
  }
  console.log(`   manifest: ${manifestPath}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--list') || args.length === 0) {
    console.log('Scenarios:');
    for (const s of SCENARIOS) console.log(`  ${s.name.padEnd(16)} ${s.title}`);
    console.log('\n  npx tsx scripts/record-demo.mts <name> [--local] [--keep-webm]');
    return;
  }
  const name = args.find((a) => !a.startsWith('--'));
  const scenario = SCENARIOS.find((s) => s.name === name);
  if (!scenario) throw new Error(`unknown scenario "${name}" — try --list`);
  const base = args.includes('--local') ? LOCAL : PROD;
  console.log(`recording against ${base}`);
  await record(scenario, base, args.includes('--keep-webm'));
}

main().catch((e) => { console.error(e); process.exit(1); });
