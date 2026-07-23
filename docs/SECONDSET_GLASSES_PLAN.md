# SecondSet — AR‑glasses service‑transparency layer (PLANNING, not greenlit)

> **Status: ideation / plan only.** Nothing is built, no spend, no hardware commitment.
> Awaiting Sandon's greenlight of a scoped v0 (+ brand + business‑model calls). Working
> name **SecondSet** ("a second set of eyes"); tagline *"See the work. Trust the bill."*
> Grounded in two crosstalk rounds with HiveJournal (who owns the glasses tech), 2026‑07‑23.

## 1. The wedge

The #1 trust problem in local service businesses is **"am I being ripped off?"** Auto
repair is the poster child (fear of unnecessary repairs). AR glasses collapse it: the
**tech's‑eye‑view becomes customer‑visible proof.** QuickSites is the ideal back‑end
because we already own every receiving surface — the customer portal, the **CRM**
(`customers` + activity timeline), the **media_assets** library, and the **About That**
audio rail. The glasses are the capture front‑end; **QS is the system of record.**

## 2. Hardware reality (from HJ — real, not roadmap)

HJ runs a live TypeScript `@mentra/sdk` AppServer on **Mentra Live** glasses (`apps/glasses/`),
an **OPEN device** running MentraOS (unlike the closed Ray‑Ban Meta). Phone‑tethered
(MentraOS companion → HJ backend).

| Capability | Today |
|---|---|
| **Photo capture** (`session.camera`/`requestPhoto`) | ✅ still photos, on demand |
| **Spoken‑note capture** (`onTranscription` STT) | ✅ wearer talks → text (+ keep audio) |
| **Triggers** (`onButtonPress` + voice) | ✅ tap AND hands‑free voice |
| **Audio to the wearer** (`session.audio.speak`/`playAudio`) | ✅ HJ's primary rail — "voice in the ear" |
| Continuous video / streaming | ❌ still‑photo only |
| **Live** two‑way audio (real‑time duplex) | ❌ net‑new build (playback + STT exist as primitives) |
| Display / HUD overlay | ❌ none — Mentra Live is audio+camera (HUD ~2027) |

**Implication:** the tech is **voice‑guided, never a visual card** — which for hands‑in‑an‑engine
is arguably better. And the **capture half of our use case already exists.**

## 3. v0 scope — auto‑repair async proof‑of‑work loop

**In:**
- Tech taps/says → **photo of the actual problem** + **spoken note** → routed to QS.
- Lands in the **customer's QS portal** against their **job**, note **narrated via About That**.
- Customer **sees the photo, hears the explanation, and approves/declines** before work proceeds.
- **Owner → tech async voice note** ("check the rear rotor too") played in‑ear via `playAudio`
  — the owner↔tech beat **without** net‑new duplex.

**Out (defer to v1+):** live two‑way audio, continuous video, HUD, non‑auto verticals,
on‑glasses NLU (Sophia/cicero — licensing‑gated, ignore).

**Beachhead:** one pilot auto‑repair shop. Prove the trust loop before breadth.

## 4. QS‑side architecture (the real QS build)

The strategic piece: QS's order model today is **e‑commerce checkout** (catalog → Stripe),
not **service jobs**. v0 needs a minimal service‑job spine — this **extends QuickSites from
"site + store + CRM" into field‑service jobs**, a new category of business we can serve.

1. **`service_jobs` model (net‑new)** — `job` ↔ `customers` (reuse CRM), owning merchant/shop,
   line items (`description`, `price_cents`, `status`), job status
   (`awaiting_approval` / `approved` / `declined` / `done`), and a capture list.
2. **Capture ingest** — `POST /api/glasses/capture` reads HJ's `glasses-capture` contract
   (`{ capture_token|job_id, photos[], transcript, audio_url? }`), stores photos in
   **media_assets**, notes on the **job timeline**, optionally mints an About That narration
   of the spoken note. Auth via a per‑job/per‑shop capture token (glasses never hold QS creds).
3. **Customer portal** — a job view: proof (photo + heard note) + **approve/decline line items**.
   Reuses the CRM customer identity; consent captured per job.
4. **Owner → tech voice note** — QS admin composes (text→TTS or record) → handed to HJ →
   `playAudio` in the tech's ear.

**Reuses:** CRM `customers`, `media_assets`, About That narration, agency‑billing/take‑rate,
notification rails.

## 5. HJ side

- A new **`contracts/glasses-capture.md`** (HJ drafts on greenlight): the glasses→HJ→QS
  delivery shape + the QS‑issued capture token + the owner‑voice‑note playback call.
- Extend `apps/glasses/` with a **service‑job capture mode** (alongside the AisleAsk
  store‑walk mode already on the device).

## 6. Brand + business model (Sandon's calls)

- **Brand:** separate, QS‑powered. Candidates: **SecondSet** (lead), FieldProof, ShopLens,
  ClearView, OnSite, Witness. Tagline: *"See the work. Trust the bill."*
- **Business model:** per‑shop subscription (could ride QS agency‑billing / take‑rate) +
  the hardware relationship (whose P&L, who supplies/owns the Mentra Live units).

## 7. Vertical roadmap (after v0 proves out)

Same shape everywhere — field capture → customer‑visible proof → CRM record + owner↔tech comms:
**auto‑repair (v0)** → **towing/roadside** (condition‑at‑pickup = a dispute shield) →
HVAC/plumbing/electrical → contractors/landscaping/**deck builders** (capture → a **DeckSketch**
estimate — a mesh loop) → appliance/pest/home‑inspection → **dental/med‑aesthetics**
(privacy‑heavy, latest).

## 8. Gates / open decisions (load‑bearing — resolve before build)

1. **Privacy/consent** — recording in customers' vehicles/spaces + audio: **per‑job consent,
   retention, redaction**; a hard bar for any medical vertical. Load‑bearing.
2. **Hardware/spend** — glasses units + render/storage costs → **gated on Sandon**.
3. **Business model / P&L** — subscription + hardware ownership.
4. **Contract** — `glasses-capture` shape + the capture‑token security model.
5. **Live duplex** — a v1 decision (net‑new on HJ's side).

## 9. Next step

On Sandon's v0 greenlight: **HJ** stubs `contracts/glasses-capture.md`; **QS** specs +
builds the `service_jobs` spine + capture‑ingest route + portal‑approval + owner‑voice‑note.
Until then this is a plan on the shelf, ready to go.
