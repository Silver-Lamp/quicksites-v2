# Family Hub / Photo-Frame — counsel-input brief

> **Status: COUNSEL-GATED. Nothing is built.** This is a scoping brief to make the
> owner's counsel conversation concrete — the product, the data architecture, and
> the specific questions counsel needs to weigh in on. It is **not** legal advice
> and **not** a compliance design; it deliberately leaves the legal calls open for
> counsel. No code, no data pipeline, and no binding cross-product contract is built
> until counsel + owner sign off. Companion: crosstalk `§14`; sibling model lives in
> HiveJournal. Last updated 2026-07-18.

## 1. What the product is

A **software-only family hub** that runs full-screen on a device the family already
owns (an old tablet or a wall-mounted screen) — positioned to undercut the
**hardware-bundled family displays** (Skylight Calendar, Hearth Display, Cozyla:
$150–300 hardware + subscription). Two halves:

1. **The hub / kiosk** — an always-on wall display: shared calendar, routines /
   check-ins, an allowance-points board. (Largely rendered from data that already
   exists on the HiveJournal side.)
2. **The photo frame** — families upload their photos; a full-screen slideshow
   rotates them behind/around the hub. **This half is what raises the sensitivity
   bar** — the photos are frequently of **children**.

## 2. The two-company data architecture (already decided, technically)

The two products are run by the same owner but are separate systems. The agreed
posture (QuickSites §14 boundary) is that **QuickSites holds no sensitive member
data**; HiveJournal owns auth + the member model + any sensitive originals.

- **HiveJournal (owns the sensitive data):**
  - Existing family model — `family_members` (parent-owned; **birthdate kept
    private and exposed only as an age-band**; parent-only row-level security;
    child-account linkage deliberately deferred; avatar is an emoji, not a photo),
    `routines` + `check-ins`, and a connection/oversight ACL layer.
  - **Net-new:** a member-**photo upload pipeline** (uploads were explicitly
    deferred in the existing model) and a **scoped, short-TTL, signed
    display-derivative feed**.
- **QuickSites (renders only):**
  - The kiosk/display UI. It renders from HiveJournal's scoped feed and **persists
    nothing to disk** — no caching of originals or derivatives, re-fetches on
    rotation. QuickSites never stores a child's photo.

The point of this split: the entity that already has the minors-aware model,
parental ownership, and consent surface is the one that holds the images; the
sitebuilder is a pure renderer with no retained copy.

## 3. Why the photo half is the sensitive part

The existing family model already treats minors carefully (private birthdate →
age-band only, parent-only access, kid-linkage deferred). **Photos of children's
faces are a step up in sensitivity from a name + emoji**, and displaying them on an
always-on screen in a shared physical space adds a context dimension that data-only
features don't have. That is the whole reason this is counsel-gated.

## 4. Questions for counsel (the open legal calls)

These are the decisions the build must be designed around — surfaced here, **not
answered here**:

1. **COPPA / children's-privacy applicability.** The product handles photos of
   under-13 children uploaded by their parent. What obligations attach (notice,
   verifiable parental consent, data-minimization, retention limits), and does the
   parent-uploads-their-own-child's-photo pattern change the analysis?
2. **Consent model.** What consent must be captured, from whom, and how (verifiable
   parental consent standard)? Consent to upload, to display, and — separately — to
   have a *second company* (QuickSites) render the image?
3. **Cross-entity data sharing.** The images live with HiveJournal and are rendered
   by QuickSites. What agreement / data-processing terms govern that hand-off
   between the two entities, even under common ownership? Does the scoped,
   no-retention renderer posture materially reduce exposure?
4. **Access scoping — who may see which photos.** The family model has relationships
   and an oversight ACL. Who is authorized to view a given child's photos, and how
   should the kiosk's "anyone in the room can see the wall" reality be handled
   (household-scope vs. per-member)?
5. **Retention & deletion / right to erasure.** Parent deletes a photo or a member,
   or closes the account — what must be guaranteed end-to-end, including that the
   renderer truly holds nothing?
6. **Display context.** An always-on screen in a home is visible to guests. Are
   there constraints or disclosures needed for that?
7. **Age handling.** The model stores an age-band, not a birthdate. Is that the
   right minimization for the photo feature, or is more/less needed?

## 5. What happens after counsel

Only once counsel + owner green-light, and the consent + access-scoping design is
set:

1. HiveJournal builds the upload pipeline + the scoped derivative feed on the
   existing family model.
2. The two sides spec the **family-media-feed contract** (`crosstalk/contracts/`) —
   scoped, short-TTL, signed, derivative-only, no-retention on the QuickSites side.
3. QuickSites builds the kiosk/display UI (reusing the shipped screensaver for the
   photo-frame rendering — see [`REFERRAL_PRICING.md`](REFERRAL_PRICING.md) is
   unrelated; the screensaver is `components/brand/screensaver.tsx`).

The non-photo kiosk (calendar + routines + allowance board) does **not** require
minors' photos and could ship independently of this gate if the owner ever wants
the competitor product sooner — noted as an option, not a decision.
