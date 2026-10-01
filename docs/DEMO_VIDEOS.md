# Demo videos — recording, publishing, and what to make next

Recorded walkthroughs of the real product, shown as a row of clip cards on `/features`.
Prospects asked to *see* a site being made; this is that.

**Re-derive, never remember:**

```bash
# which features have clips, and how many
psql "$SUPABASE_DB_URL" -c "select category, slug, jsonb_array_length(demo_clips) clips
  from features where is_public and not is_archived order by clips desc nulls last, category;"
```

---

## 1. The loop

```bash
npx tsx scripts/record-demo.mts                  # records against PRODUCTION
npx tsx scripts/record-demo.mts --local          # localhost:3000
npx tsx scripts/upload-demo-videos.mts           # dry run — prints what it would do
npx tsx scripts/upload-demo-videos.mts --apply
```

`record-demo.mts` drives the real product in headless Chromium (Playwright `recordVideo`, no
xvfb needed) and writes `demo-videos/<name>-<YYYY-MM-DD>.mp4`. `upload-demo-videos.mts` measures
each clip, cuts a poster, uploads both, and attaches them to the feature they demonstrate.

⚠️ **Recording runs against production by default and that is the honest choice** — a demo of a
staging build is a demo of something nobody can sign up for. The cost: a guest-build recording
leaves a real anonymous draft row behind, exactly like a visitor. Those rows land in the
guest-build funnel counts, which somebody reads, so say so when you run it.

## 2. The rules that are load-bearing

**Dated storage paths.** `demos/<YYYY-MM-DD>/<name>.mp4`, with the date taken from the FILENAME,
never the clock. The product changes underneath a walkthrough: on a stable path the clip you sent
a prospect last month silently becomes a different video and nothing says so. Dating means a
re-record replaces only that day's file and earlier takes stay reachable. An undated filename is
refused rather than dated for you.

**The feature a clip belongs to is declared, not guessed** — the `CLIPS` map in the upload script
— and every slug is checked against the DB before a byte uploads. A clip on the wrong feature is
a wrong claim about the product; a typo'd slug would otherwise upload fine and attach nothing.

**⚠️ Posters are not polish.** These recordings open on a loading page, so a `<video>` with no
poster renders a WHITE first frame. The first clip row was blank white rectangles, which reads as
broken rather than as video.

**⚠️ And the poster timestamp is declared per clip, not chosen by a filter.** ffmpeg's `thumbnail`
filter picks the most visually *distinctive* frame. For `editor-tour` that was the colourful
loading animation — a poster reading *"Building your site …"* on a card labelled *"Editing blocks,
theme and publish"*. The filter worked; the result was wrong, and only looking at the frames
showed it. Pick `posterAt` off a contact sheet:

```bash
ffmpeg -i demo-videos/<clip>.mp4 -vf "fps=1/3,scale=320:-1,tile=3x3" -frames:v 1 /tmp/sheet.jpg
```

**Duration is measured with ffprobe, never estimated**, and an unmeasured clip renders **no**
duration pill — a `0:00` badge is a measurement nobody took, printed as fact.

**⚠️ `features.demo_clips`, not `features.gallery`.** The latter is the portfolio IMAGE gallery,
counted to the operator as "N images". (It had also been stored and never rendered for its whole
life — `/features` only read `video_url` — so anything put there was invisible while looking
saved.)

## 3. Candidates, roughly in order of what they'd earn

Two of sixteen features have a clip. These are the ones where *seeing it* beats reading it:

| Feature | What the clip shows | Why it earns its place |
|---|---|---|
| `ecommerce-storefront` | Add a product → it appears on the live site → buy it | The take-rate thesis. Nothing on the site shows money moving. |
| `customer-crm` | A paid order becoming a customer row with LTV and a timeline | "Fills itself" is the claim; the clip is the proof. |
| `email-campaigns` | Pick a segment → send → the attributed order lands | Closes the CRM loop in one take. |
| `hear-this-page` | Tap the button, hear the page | Audio cannot be screenshotted. ⚠️ Label the house narrator as such. |
| `in-your-voice` | An owner's consented clone reading their own page | The moat. ⚠️ Consented clone only; never imply a voice we did not get. |
| `lead-capture-call-tracking` | A call arriving and landing in the log | ⚠️ Never use a real caller's audio or number. |
| `multi-tenant-routing-subdomains` | One codebase answering on two hosts | Hard to believe in prose, trivial to show. |
| `white-label-reseller` | A partner's brand on the admin chrome | The reseller pitch, in four seconds. |
| `revenue-dashboard` | GMV, fees and commissions reconciling | ⚠️ Use the green-path demo data, never a real merchant's numbers. |

**⚠️ Re-record the three existing clips.** They were recorded 2026-10-01 *before* the fix that
stops a new site opening behind the Pages tray (#1088), so `guest-build` and `editor-tour` both
show a drawer covering the hero — footage of a bug we fixed the same day.

## 4. Adding one

1. Add a scenario to `SCENARIOS` in `scripts/record-demo.mts`.
2. Add a `CLIPS` entry in `scripts/upload-demo-videos.mts`: `feature`, `label`, `blurb`,
   `posterAt` (chosen off a contact sheet), and `primary` if it should lead.
3. Record, dry-run the upload, look at the poster, then `--apply`.
4. Open `/features` and look at the row. Every defect in this pipeline so far was found that way
   and none by a passing test.
