// scripts/record-demo.mts
//
// RECORD A REAL SCREEN WALKTHROUGH OF THE PRODUCT, AUTOMATICALLY.
//
//   npx tsx scripts/record-demo.mts --list
//   npx tsx scripts/record-demo.mts guest-build
//   npx tsx scripts/record-demo.mts guest-build --local --keep-webm
//   npx tsx scripts/record-demo.mts add-product --as sandonjurowski+tester2@gmail.com
//
// `--as <email>` signs the recorder in as that account first, through a magic link minted with
// the service role (the same mechanism as /api/admin/merchants/impersonate) — no password, no
// email sent. The signed-in scenarios (add-block / edit-block / add-product) need it: creating a
// store and adding products are owner actions, and doing them as an anonymous guest would leave
// junk merchant rows behind. ⚠️ Use a test account you own; the site it creates is a real row.
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
// ⚠️ The business name typed into the guest flow is shared with the new-site alert, which must
// recognise the recorder's builds as ours and never email the owner about them.
import { DEMO_RECORDER_BUSINESS_NAMES } from '../lib/demos/recorderIdentity';
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
 * Replace a field's contents at human speed (select the old text first, so it visibly goes).
 *
 * ⚠️ `selectText()` rather than a select-all keystroke: the hero's headline is a contenteditable,
 * and `Meta+A` / `Control+A` + Backspace left it untouched in headless Chromium — the first cut
 * typed "Hand-poured candles, made in Renton" IN FRONT of "Wildflower Candle Co." and the clip
 * showed the two run together. Typing over a selection replaces it in inputs and contenteditables
 * alike.
 */
async function retypeSlowly(p: Page, selector: string, text: string) {
  await moveTo(p, selector);
  const field = p.locator(selector).first();
  await field.click();
  await field.selectText().catch(async () => {
    await p.keyboard.press('Control+A').catch(() => {});
  });
  await beat(p, 300);
  await p.keyboard.type(text, { delay: 70 });
}

/**
 * The drawer's own Save — the LAST matching button, because the page header also has a "Save"
 * and `getByRole(...).first()` pressed that one while the drawer stayed open for the rest of the
 * clip. Drawers and modals are portalled to the end of the document.
 */
async function clickLast(p: Page, name: RegExp, what: string): Promise<boolean> {
  await injectCursor(p);
  const b = p.getByRole('button', { name }).last();
  if (!(await b.count().then((n) => n > 0).catch(() => false))) {
    console.warn(`     ⚠️ no control matched for "${what}" — the recording will show nothing here`);
    return false;
  }
  const box = await b.boundingBox().catch(() => null);
  if (box) await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
  await beat(p, 300);
  await b.click().catch(() => {});
  return true;
}

// ── signed-in recordings ─────────────────────────────────────────────────────────────────────

/** Set from `--as <email>`; null = record as an anonymous visitor. */
let SIGN_IN_AS: string | null = null;

/**
 * Mint a one-time sign-in link for a test account, without sending an email.
 *
 * Same call as app/api/admin/merchants/impersonate: `generateLink({type:'magiclink'})` returns
 * the action link Supabase would have emailed; opening it lands on /auth/callback signed in.
 * Reads the service role from .env.local — this runs on the owner's machine only.
 */
async function mintSignInLink(base: string, email: string): Promise<string> {
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });
  const { installNodeWebSocket } = await import('../lib/supabase/nodeWebSocketShim');
  await installNodeWebSocket();
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('--as needs NEXT_PUBLIC_SUPABASE_URL + a service-role key in .env.local');
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: email.toLowerCase(),
    options: { redirectTo: `${base}/auth/callback?next=${encodeURIComponent('/admin/templates/new')}` },
  });
  if (error) throw new Error(`generateLink: ${error.message}`);
  const link = (data as any)?.properties?.action_link ?? (data as any)?.action_link;
  if (!link) throw new Error('generateLink returned no action link');
  return link;
}

/** The first block on the canvas. The live preview marks each block as a hoverable group. */
const FIRST_BLOCK = '.group.relative.cursor-pointer';

/**
 * Hover a block so its chrome appears, then press one of its controls by accessible name.
 * The controls are `hidden group-hover:flex`, so they exist only while the pointer is over the
 * block — hover first, then click, never the other way round.
 */
async function clickBlockControl(p: Page, blockSelector: string, label: string): Promise<boolean> {
  await injectCursor(p);
  const block = p.locator(blockSelector).first();
  if (!(await block.count())) { console.warn(`     ⚠️ no block matched ${blockSelector}`); return false; }
  await block.scrollIntoViewIfNeeded().catch(() => {});
  const box = await block.boundingBox().catch(() => null);
  if (box) await p.mouse.move(box.x + box.width / 2, box.y + Math.min(60, box.height / 2), { steps: 20 });
  await block.hover().catch(() => {});
  await beat(p, 500);
  const btn = block.locator(`button[aria-label="${label}"]`).first();
  if (!(await btn.count())) { console.warn(`     ⚠️ "${label}" not found on the hovered block`); return false; }
  const bb = await btn.boundingBox().catch(() => null);
  if (bb) await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 14 });
  await beat(p, 300);
  await btn.click({ force: true }).catch(() => {});
  return true;
}

/**
 * The open drawer's own Save.
 *
 * ⚠️ Three "Save" buttons can be on screen at once — the page header's, the floating toolbar's
 * (bottom edge), and the drawer's footer — and neither `.first()` nor `.last()` is reliably the
 * drawer's: two recordings saved the page while the drawer stayed open to the end of the clip.
 * The drawer footer is the LOWEST visible Save that is still above the floating toolbar, so pick
 * by geometry rather than by DOM order.
 */
async function clickDrawerSave(p: Page): Promise<boolean> {
  await injectCursor(p);
  // Both the block drawer and the picker are `role="dialog"` (DrawerShell / ModalShell); the
  // open one is the last. Scoping here is what excludes the page header's and the floating
  // toolbar's Save buttons, which share the label.
  const dialog = p.locator('[role="dialog"]').last();
  const b = dialog.locator('button', { hasText: /^\s*Save\s*$/ }).locator('visible=true').last();
  if (!(await b.count())) { console.warn('     ⚠️ no Save button in the open drawer'); return false; }
  await b.scrollIntoViewIfNeeded().catch(() => {});
  const box = await b.boundingBox().catch(() => null);
  if (box) await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
  await beat(p, 300);
  // ⚠️ A DOM click, not a pointer click. Once a Q&A row is typed the drawer is tall enough that
  // its footer sits under the fixed editor toolbar; Playwright's hit-test then refuses the click
  // for 10s ("intercepts pointer events") while the cursor visibly rests on the button. The
  // viewer sees the cursor arrive and the drawer close, which is the honest sequence.
  await b.evaluate((el) => (el as HTMLButtonElement).click()).catch((e) => console.warn(`     ⚠️ drawer Save failed: ${e?.message?.split('\n')[0]}`));
  return true;
}

/**
 * Press the "+ Add block" affordance under the first block and wait for the picker.
 *
 * ⚠️ NOT a block control: it is a sibling BELOW the block wrapper, always visible, and at 720p it
 * sits right under the floating editor toolbar. A forced click at its centre lands on the toolbar
 * and nothing opens — two recordings showed the cursor parked on the toolbar and no picker. An
 * unforced Playwright click scrolls it clear and checks it actually receives the event.
 */
async function clickAddBelow(p: Page): Promise<boolean> {
  await injectCursor(p);
  const btn = p.locator('button[aria-label="Add a block below"]').first();
  if (!(await btn.count())) { console.warn('     ⚠️ no "Add a block below" button on the canvas'); return false; }
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await p.mouse.wheel(0, 160); // lift it above the floating toolbar
  await beat(p, 400);
  const box = await btn.boundingBox().catch(() => null);
  if (box) await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
  await beat(p, 300);
  await btn.click({ timeout: 10_000 }).catch((e) => console.warn(`     ⚠️ add-below click failed: ${e?.message?.split('\n')[0]}`));
  // The picker is a modal with quick picks; "Text" is always in it.
  await p.getByRole('button', { name: /^Text\b/i }).first().waitFor({ state: 'visible', timeout: 10_000 })
    .catch(() => console.warn('     ⚠️ the block picker did not open'));
  return true;
}

/**
 * The shared opening of every signed-in scenario: sign in, create a site from the industry
 * chooser, land in the editor. One timelapsed step, so the clip starts on the thing it is about.
 *
 * ⚠️ Falls back to the guest build when `--as` was not given — the add/edit-block clips still
 * work that way, and the recorder SAYS it fell back, because a product clip recorded as a guest
 * would show "This site doesn't have a store yet" and nothing else.
 */
function openEditorOnNewSite(base: string, businessName: string): Step {
  return {
    say: 'Sign in and start a new site, so there is something to work on.',
    timelapse: true,
    run: async (p) => {
      if (SIGN_IN_AS) {
        const link = await mintSignInLink(base, SIGN_IN_AS);
        await p.goto(link, { waitUntil: 'networkidle' }).catch(() => {});
        await p.waitForURL((u) => u.toString().startsWith(base), { timeout: 30_000 })
          .catch(() => console.warn('     ⚠️ magic link did not land back on the site'));
        await p.goto(`${base}/admin/templates/new`, { waitUntil: 'networkidle' });
        await showCursor(p);
        await clickAny(p, [/start from your industry/i], 'industry chooser');
        await beat(p, 800);
        const biz = p.locator('#biz, input[placeholder*="Towing"]').first();
        await biz.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => console.warn('     ⚠️ business-name field not found'));
        await typeSlowly(p, '#biz', businessName);
        const search = p.locator('input[placeholder="Search industries"]').first();
        if (await search.count()) {
          // ⚠️ Must be a label that EXISTS. "Candle" matched nothing ("No industries match") and the
          // first recording clicked Create with no industry — a red "Pick an industry" and no site.
          await typeSlowly(p, 'input[placeholder="Search industries"]', 'Handmade');
          await beat(p, 600);
        }
        // The industry list is a grid of buttons; take the first match (or the first option).
        const option = p.locator('button:has(span.truncate)').first();
        if (await option.count()) {
          const box = await option.boundingBox().catch(() => null);
          if (box) await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 16 });
          await option.click().catch(() => {});
        } else {
          console.warn('     ⚠️ no industry option found');
        }
        await beat(p, 600);
        await clickAny(p, [/create my site/i], 'create my site');
      } else {
        console.warn('     ⚠️ no --as <email>: recording as a guest instead (product steps will have no store)');
        await p.goto(`${base}/build`, { waitUntil: 'networkidle' });
        await showCursor(p);
        await typeSlowly(p, 'input[type="text"]', businessName);
        await clickAny(p, [/build my site/i, /start building/i, /create/i], 'build');
      }
      await p.waitForURL(/\/admin\/templates\//, { timeout: 120_000 })
        .catch(() => console.warn('     ⚠️ editor never opened'));
      await p.waitForLoadState('networkidle').catch(() => {});
      // A site created from the chooser opens with the Pages tray already closed (#1088), so only
      // reach for Close when it is actually there — otherwise the miss is noise, not a defect.
      if (await p.getByRole('button', { name: /^close$/i }).first().isVisible().catch(() => false)) {
        await clickAny(p, [/^close$/i], 'close the Pages panel');
      }
      // ⚠️ WAIT FOR THE CANVAS, NOT THE URL. The editor URL arrives before the blocks render (they
      // load client-side), and the first two recordings hovered an empty canvas: "no block
      // matched" while the frame extracted 20s later showed seven of them. A probe against the
      // same page confirmed the selector; the wait was the bug.
      await p.locator(FIRST_BLOCK).first().waitFor({ state: 'visible', timeout: 60_000 })
        .catch(() => console.warn('     ⚠️ canvas blocks never rendered — every later step will miss'));
      await beat(p, 1500);
    },
  };
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
    // ⚠️ The VISIBLE match, not the first. The products editor renders "Set up my store" twice
    // (one inside a collapsed details), `.first()` picked the hidden one, the click failed
    // silently and the clip showed a cursor parked mid-screen beside an unpressed button.
    const all = p.getByRole('button', { name });
    const visible = all.locator('visible=true').first();
    const b = (await visible.count().then((n) => n > 0).catch(() => false)) ? visible : all.first();
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
          await typeSlowly(p, 'input[type="text"]', DEMO_RECORDER_BUSINESS_NAMES[0]);
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
    name: 'add-block',
    title: 'Adding a block — a new section in two clicks',
    steps: (base) => [
      openEditorOnNewSite(base, 'Wildflower Candle Co.'),
      {
        say: 'Hover any section — its controls appear.',
        run: async (p) => {
          const block = p.locator(FIRST_BLOCK).first();
          await block.scrollIntoViewIfNeeded().catch(() => {});
          const box = await block.boundingBox().catch(() => null);
          await injectCursor(p);
          if (box) await p.mouse.move(box.x + box.width / 2, box.y + 60, { steps: 24 });
          await block.hover().catch(() => {});
          await beat(p, READ);
        },
      },
      {
        say: 'Add a block below it.',
        run: async (p) => {
          await clickAddBelow(p);
          await beat(p, READ);
        },
      },
      {
        say: 'Pick what it should be — an FAQ.',
        run: async (p) => {
          await clickAny(p, [/^FAQ\b/i], 'FAQ quick pick');
          await beat(p, READ);
        },
      },
      {
        say: 'It is added and opened for editing — type the first question and answer.',
        run: async (p) => {
          // A new FAQ is EMPTY (no starter questions), so the clip has to put one in or the
          // section it shows afterwards is a heading over nothing.
          await p.getByRole('button', { name: /add q&a/i }).first().waitFor({ state: 'visible', timeout: 20_000 })
            .catch(() => console.warn('     ⚠️ FAQ editor did not open'));
          await beat(p, READ);
          await clickAny(p, [/add q&a/i], 'add a Q&A row');
          await beat(p, 600);
          const q = p.getByLabel(/^Question 1/i).first();
          const a = p.getByLabel(/^Answer 1/i).first();
          if (await q.count()) {
            // A new row is prefilled "New Question" / "New Answer" — select it or the typing
            // appends ("New QuestionDo you ship?" went to a clip once).
            const qb = await q.boundingBox().catch(() => null);
            if (qb) await p.mouse.move(qb.x + qb.width / 2, qb.y + qb.height / 2, { steps: 16 });
            await q.click();
            await q.selectText().catch(() => {});
            await p.keyboard.type('Do you ship?', { delay: 70 });
            await beat(p, 500);
            const ab = await a.boundingBox().catch(() => null);
            if (ab) await p.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2, { steps: 16 });
            await a.click();
            await a.selectText().catch(() => {});
            await p.keyboard.type('Yes — anywhere in the US, usually within three days.', { delay: 60 });
          } else {
            console.warn('     ⚠️ Question 1 field not found');
          }
          await beat(p, READ);
          await clickDrawerSave(p);
          await beat(p, 1500);
        },
      },
      {
        say: 'The new section sits exactly where you put it.',
        run: async (p) => {
          await injectCursor(p);
          for (let i = 0; i < 3; i++) { await p.mouse.wheel(0, 360); await beat(p, 650); }
          await beat(p, READ);
        },
      },
    ],
  },
  {
    name: 'edit-block',
    title: 'Editing a block — change the words, see it live',
    steps: (base) => [
      openEditorOnNewSite(base, 'Wildflower Candle Co.'),
      {
        say: 'Hover the hero and open it for editing.',
        run: async (p) => {
          await clickBlockControl(p, FIRST_BLOCK, 'Edit block');
          // The hero editor is lazy-loaded ("Loading editor for hero block…") and opens on a
          // PREVIEW of the content; the text fields exist only after the Edit toggle. The first
          // recording waited 45s for a Headline field that was never going to render.
          await p.getByRole('button', { name: /suggest all/i }).first().waitFor({ state: 'visible', timeout: 30_000 })
            .catch(() => console.warn('     ⚠️ hero editor did not finish loading'));
          await beat(p, READ);
          const editToggle = p.getByRole('button', { name: /^edit$/i }).last();
          if (await editToggle.count()) {
            const box = await editToggle.boundingBox().catch(() => null);
            if (box) await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 16 });
            await beat(p, 300);
            await editToggle.click().catch(() => {});
          }
          await beat(p, 1000);
        },
      },
      {
        say: 'Rewrite the headline.',
        run: async (p) => {
          const field = p.locator('[aria-label="Headline"]').first();
          await field.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => console.warn('     ⚠️ Headline field not found'));
          await retypeSlowly(p, '[aria-label="Headline"]', 'Hand-poured candles, made in Renton');
          await beat(p, 800);
        },
      },
      {
        say: 'And the line under it.',
        run: async (p) => {
          const field = p.locator('[aria-label="Subheadline"]').first();
          if (await field.count()) await retypeSlowly(p, '[aria-label="Subheadline"]', 'Small batches. Clean soy wax. Scents you will actually want in your home.');
          await beat(p, 800);
        },
      },
      {
        say: 'Save — the page updates in place.',
        run: async (p) => {
          await clickDrawerSave(p);
          await beat(p, 1500);
          await injectCursor(p);
          await p.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2, { steps: 12 });
          await beat(p, READ * 2);
        },
      },
    ],
  },
  {
    name: 'add-product',
    title: 'Adding products — a store on the site in under a minute',
    steps: (base) => [
      openEditorOnNewSite(base, 'Wildflower Candle Co.'),
      {
        say: 'Add a Products block below the hero.',
        run: async (p) => {
          await clickAddBelow(p);
          await beat(p, 1200);
          await clickAny(p, [/^Products\b/i], 'Products quick pick');
          await beat(p, READ);
        },
      },
      {
        say: 'The site has no store yet — one click sets it up.',
        run: async (p) => {
          // ⚠️ By FULL text, not by accessible-name substring. Four elements answer to
          // "set up my store" — the canvas block's placeholder sentence mentions it, and that
          // wrapper is 1000px wide, behind the drawer, and wins `.first()`; clicking it timed out
          // while the real button sat unpressed. Anchoring the regex to the whole text leaves
          // exactly the button.
          await injectCursor(p);
          const setup = p.locator('button', { hasText: /^\s*🏪?\s*Set up my store\s*$/ }).locator('visible=true').first();
          await setup.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => console.warn('     ⚠️ Set up my store button not found'));
          const sb = await setup.boundingBox().catch(() => null);
          if (sb) await p.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2, { steps: 20 });
          await beat(p, 300);
          await setup.click({ timeout: 10_000 }).catch((e) => console.warn(`     ⚠️ set-up click failed: ${e?.message?.split('\n')[0]}`));
          const qa = p.locator('#qa-title').first();
          await qa.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => console.warn('     ⚠️ quick-add form never appeared — is the recorder signed in?'));
          await beat(p, READ);
        },
      },
      {
        say: 'Add the first product: a name and a price.',
        run: async (p) => {
          await typeSlowly(p, '#qa-title', 'Lavender Soy Candle');
          await retypeSlowly(p, '#qa-price', '24');
          await clickAny(p, [/^\+ add$/i, /^add$/i], 'add product');
          await beat(p, READ);
        },
      },
      {
        say: 'And a second one.',
        run: async (p) => {
          await typeSlowly(p, '#qa-title', 'Cedar & Smoke Candle');
          await retypeSlowly(p, '#qa-price', '28');
          await clickAny(p, [/^\+ add$/i, /^add$/i], 'add product');
          await beat(p, READ);
        },
      },
      {
        say: 'Save — they are on the page, with Add to Cart.',
        run: async (p) => {
          await clickDrawerSave(p);
          await beat(p, 1500);
          await injectCursor(p);
          for (let i = 0; i < 3; i++) { await p.mouse.wheel(0, 360); await beat(p, 650); }
          await beat(p, READ * 2);
        },
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
    console.log('\n  npx tsx scripts/record-demo.mts <name> [--local] [--keep-webm] [--as <email>]');
    return;
  }
  const asIdx = args.indexOf('--as');
  if (asIdx >= 0) {
    SIGN_IN_AS = args[asIdx + 1] ?? null;
    if (!SIGN_IN_AS || SIGN_IN_AS.startsWith('--')) throw new Error('--as needs an email');
    args.splice(asIdx, 2);
  }
  const name = args.find((a) => !a.startsWith('--'));
  const scenario = SCENARIOS.find((s) => s.name === name);
  if (!scenario) throw new Error(`unknown scenario "${name}" — try --list`);
  const base = args.includes('--local') ? LOCAL : PROD;
  console.log(`recording against ${base}${SIGN_IN_AS ? ` as ${SIGN_IN_AS}` : ' as an anonymous visitor'}`);
  await record(scenario, base, args.includes('--keep-webm'));
}

main().catch((e) => { console.error(e); process.exit(1); });
