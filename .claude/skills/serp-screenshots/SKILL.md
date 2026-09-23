---
name: serp-screenshots
description: Stitch scrolled PNG screenshots of a Google search into one continuous page, read it, and pre-fill the /admin/serp-check form. Use when the user points at screenshots of a SERP, says they screenshotted a search, or asks to fill the SERP check from images.
---

# SERP screenshots → a pre-filled check

Turn a handful of scrolled captures into one page, read it, and hand the person the values for
`/admin/serp-check`. Saves the fiddly part of `docs/SERP_CHECK_WORKSHEET.md` — counting the pack
and identifying the first blue link — without taking the judgement away from them.

## ⚠️ Pre-fill. Never submit.

**The human run exists to be ground truth for the classifier.** `/admin/serp-check` ends with a
*you vs the machine* table, and its whole value is that a person looked. If a model reads the
screenshots and posts the answers, that comparison quietly becomes machine-vs-machine and the
calibration loop is dead while still appearing to work.

So: report what you read, say how confident you are per field, and let them confirm each value in
the console. If they ask you to post it anyway, say plainly in `notes` that the reading was
screenshot-assisted, so the row is never mistaken for an unaided human check.

## Steps

**1. Get the shots in scroll order.** Newest-last for a normal top-to-bottom scroll:

```bash
ls -t ~/Desktop/*.png | head -6 | tail -r
```

Confirm the count with the user if it is ambiguous — stitching an unrelated screenshot into the
middle produces a page that looks fine and is wrong.

**2. Stitch.**

```bash
.claude/skills/serp-screenshots/stitch.sh OUT.png SHOT1.png SHOT2.png ...
```

It crops the browser chrome from every shot but the first, and removes the scroll overlap by
matching each shot against the previous one's tail. Read its stderr: it prints the trim per shot
and says when a match was not confident. `CHROME_PT` / `BOTTOM_PT` / `MAX_RMSE` override the
defaults for a differently-shaped window.

**3. Downscale, then look at it.**

```bash
magick OUT.png -resize 1100x OUT-small.png
```

Read the downscaled file. Full-res is too tall to take in at once and the extra pixels add
nothing — the things being counted are large.

**4. Report these, with a confidence note on anything you are unsure of.**

| field | what to look for |
|---|---|
| query | the search box at the top |
| location | the chip under the tabs (e.g. "Bonney Lake, WA · Choose area"), or the footer line |
| **pack size** | businesses in the "Businesses"/map block — **the number that decides the verdict** |
| first organic | the first ordinary blue link *below* the pack and any AI overview |
| its domain | shown above the title |
| AI overview | an "✦ AI Overview" block |
| ads | "Sponsored" labels |

**5. Hand over the values** and point at `/admin/serp-check`. Do not post them.

## Counting rules that keep hand and machine comparable

⚠️ **A "Sponsored" entry inside the map pack is not one of the businesses.** It is a paid slot,
and DataForSEO returns it as `paid` rather than `local_pack` — so counting it would make every
human row disagree with every machine row by one, for a reason nobody would find. In the test
capture the pack read Cascade / Pure / BL **plus** a Sponsored entry: that is **3**.

⚠️ **COUNT THE PACK CAREFULLY — THE THIRD ENTRY HIDES.** A "Places"/"Businesses" block usually
shows three, and the third is frequently clipped by the **"More places"** button overlapping it.
On `custom treehouse company north carolina` (2026-09-23) the visible entries read as two
(World Treehouses, Falconhurst) with a third — Treehouse Customs — cut off behind the button and
visible only as a map pin. Two and three give **opposite verdicts** (`good` vs `skip`), and the
undercount biases toward calling a page winnable when it is not. Crop that region at full
resolution before committing to a number, and cross-check the map pins.

⚠️ **The first organic is the first ordinary blue link, below everything else.** Not the pack, not
the AI overview, not "People also ask". If an AI overview answers the question and the first blue
link is far down, that is the finding — record it, do not skip past it.

⚠️ **Directories are directories however local they look.** A Yelp page titled "Best Towing near
Bonney Lake, WA" is `directory`, not a business's own site. That distinction changes the verdict.

## What this cannot do

- **It is a reading, and readings can be wrong.** Dark mode, low contrast and a compressed
  downscale all cost accuracy. Say which fields you are confident about and which you are not.
- **A gap in the scroll is invisible.** If the person skipped a viewport, the stitch joins cleanly
  and nothing looks wrong. If the overlap match fails for a pair, the script says so — repeat that
  warning to the user rather than swallowing it.
- **The crop defaults assume a Retina Chrome window.** A different window shape needs the env
  overrides; a bad crop is silent, which is why step 3 says to look at the output.

## Worked example

Six shots of `towing service near me` (Bonney Lake, WA), the control row:

```
shot 2: overlap matched (rmse 0.0676) — trimming to +720px
shot 3: overlap matched (rmse 0.0239) — trimming to +1032px
...
stitched  2940x6116  from 6 shots        # 8082px before dedup — ~2000px of repeats removed
```

Read: pack **3** (Cascade, Pure, BL, plus one Sponsored) · AI overview **yes** · first organic
**Yelp** (`yelp.com`, directory) → the classifier's verdict is **skip**, which is what the control
must produce. Before dedup the same stitch showed Yelp twice, Fitz Towing twice and one Reddit
thread twice — a duplicated first organic is exactly the misread this exists to prevent.
