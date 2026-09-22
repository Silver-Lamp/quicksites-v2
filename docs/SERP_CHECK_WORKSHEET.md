# SERP check worksheet — treehouses & storm shelters

> **Why you're doing this by hand.** `docs/NICHE_DISCOVERY.md` ranked these niches on *supply
> density*, which is a **proxy** for the thing that actually decides whether we can win: how much
> of the page sits above the first organic result. Nobody has looked. Ten searches settles it, and
> it is the difference between buying twenty domains that rank and twenty that don't.
>
> **You are measuring ONE thing: what is above the first blue link.** Not whether we could rank —
> whether ranking would be worth anything.

Time: about 20 minutes. Do it on a laptop, not a phone (phone SERPs show even less organic, which
would bias the answer pessimistic).

---

## Before you start

1. **Open an incognito/private window.** Your logged-in results are personalised by your own
   search history, which is full of dome and towing queries. That would bias the result.
2. **Set location.** Google uses your real location regardless of the words you type, so "near me"
   from your desk measures *your* metro, not the target one. Two options:
   - Easiest: search the phrase with the city in it (`treehouse builder asheville nc`) — the
     worksheet uses this form.
   - Better if you want the true "near me" page: in Chrome DevTools (⌥⌘I) → ⋮ → More tools →
     Sensors → Location → Custom, paste the coordinates below, reload.
     - **Asheville, NC** `35.5951, -82.5515`
     - **Austin, TX** `30.2672, -97.7431`
3. **Have this file open** to write in as you go, or print it.

---

## The ten searches

Two niches × two metros × two-to-three phrasings. Do them in this order.

| # | Search exactly this |
|---|---|
| 1 | `treehouse builder asheville nc` |
| 2 | `treehouse builders near me` *(with location set to Asheville)* |
| 3 | `custom treehouse company north carolina` |
| 4 | `treehouse builder austin tx` |
| 5 | `treehouse builders near me` *(location set to Austin)* |
| 6 | `storm shelter installer austin tx` |
| 7 | `storm shelters near me` *(location set to Austin)* |
| 8 | `safe room contractor texas` |
| 9 | `storm shelter installer asheville nc` |
| 10 | `tornado shelter installation near me` *(location set to Austin)* |

---

## What to record for each

For every search, scroll from the top and note **what comes before the first ordinary blue link**.
Copy this block ten times, or fill the summary table below.

```
Search #__:  ______________________________________________

Above the first organic result (tick all that appear):
  [ ] Paid ads          how many? ___
  [ ] Map pack          how many businesses? ___   (3 is full; 1–2 is starved; absent is best)
  [ ] "People also ask" box
  [ ] AI overview / AI answer
  [ ] Images or video carousel
  [ ] Shopping results

First organic result is:
  [ ] A real local business    [ ] A directory (Yelp/Angi/Thumbtack/Houzz)
  [ ] A national brand/maker   [ ] A blog or listicle    [ ] Reddit/forum

Roughly how far down is the first organic link?
  [ ] Visible without scrolling   [ ] One scroll   [ ] Two or more scrolls

Anything odd worth a note: ______________________________________
```

### Summary table (fill this and you're done)

| # | Ads | Map pack | First organic is… | Organic visible without scrolling? |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |

---

## How to read what you wrote

Score each search: **good** / **bad**, using only the map pack and the first organic result.

| What you saw | Verdict | Why |
|---|---|---|
| Map pack absent or 1–2 businesses, first organic is a **directory or listicle** | 🟢 **Best case** | Google has no local answer and is falling back to lists. A better list is exactly what we build. |
| Map pack absent or thin, first organic is a **national maker** | 🟢 Good | Beatable with a local/state page; that's the dome pattern. |
| Full 3-pack **but** organic still visible without scrolling | 🟡 Mixed | Winnable, lower ceiling. Needs a second signal before spending. |
| Full 3-pack + ads, organic needs two scrolls | 🔴 **Skip** | This is towing. We'd rank into a page nobody reaches. |
| First organic is **Reddit or a forum** | 🟢 Interesting | Means the buyer is researching and nobody has published the good answer. |

**The decision:**

- **7 or more 🟢 across the ten** → real cohort. Tell me and I'll price the domains and draft the
  page structure, same shape as the dome build.
- **4–6 🟢** → one niche is probably good and the other isn't. Note which; we run the probe deeper
  on that one alone (`--only=treehouse --metros=10`).
- **3 or fewer 🟢** → the supply-density proxy is wrong, and that's the most valuable outcome here.
  It means the whole `NICHE_DISCOVERY` scoring needs the local-pack term measured rather than
  inferred, and we should not buy anything until it is.

---

## One sanity check while you're in there (30 seconds)

Search **`towing service near me`** with location set to Bonney Lake, WA.

We rank **position 10.9** on that query with **69 impressions and zero clicks** — it's the finding
the whole thesis rests on. You should see a full 3-pack, probably ads, and no organic result until
you scroll. **If instead you see our site high on a clean page, the towing diagnosis is wrong** and
I need to know immediately, because everything above depends on it.

---

## When you're done

Paste the summary table back to me — or just say "7 green, storm shelters were the weak one" and
I'll take it from there. Raw notes are fine; I don't need it tidy.
