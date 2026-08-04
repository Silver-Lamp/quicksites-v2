# Verbatim at the library — the résumé clinic

> Running Verbatim as a session inside a public library's existing job-seeker help. Chosen over
> five alternatives by a cold mesh poll (crosstalk 2026-08-04, three sibling sessions answering
> independently), and over a "build your business website" workshop, which all three rejected.

---

## 1. Why this one and not the obvious one

The obvious QuickSites library play is a small-business website workshop. Every test the mesh
proposed rejects it, and they were proposed independently:

| test | source | website workshop | résumé clinic |
|---|---|---|---|
| Is it useful to the attendee if they never touch our product? | PorchHearth | no — the output *is* the product | **yes** — they leave with their own page |
| Would the librarian still book the room if you said the commercial part out loud, first? | DeckSketch | awkward | **yes** |
| Could the librarian run it with a generic tool and it still be good? | HiveJournal | it's a funnel | **yes** — and ours is a better instrument |
| Does the attendee bear a cost that only pays off if OUR side works? | PorchHearth | **yes** — their web presence becomes a bet on us | no |

The fourth is the one that decides it. PorchHearth reached it by arguing *against* their own best
idea (a MEHKO permit workshop): *"a supply-side programme before there is demand converts our
problem into someone else's expense."* A local business putting its web presence on a platform
with three lifetime orders is that, exactly — and the poster poll had already found that
abandonment is precisely what that buyer fears.

**The distinction underneath all four: an artefact versus a dependency.** A page someone keeps is
useful whether or not we exist. A live site is a standing bet that we do.

⚠️ **That claim was false when it was first made.** Verbatim produced only a draft on our
platform — if QuickSites went away the person had nothing. The export (§3) exists to make the
sentence true. It was a true observation (the parser is deterministic and invents nothing) welded
to an unchecked inference (therefore they leave with something), which is the CLAUDE.md §9 failure
in its natural habitat.

## 2. What the session is

A librarian's existing job-help hour, with one tool added:

1. A patron pastes or uploads their résumé. **The PDF never leaves the device** — extraction runs
   in the browser and only the text is posted.
2. Verbatim parses it and shows **what it read** and **what the résumé did not yield**. It invents
   nothing: no summary written for them, no job title inferred, no photograph, ever.
3. They correct anything wrong, then **download one HTML file** — theirs, offline, printable.
4. *Optionally*, and only if they want it, they publish it as a page with a link they can send.

Step 3 is the completion. Step 4 is the upsell, and it is allowed to not happen.

## 3. The things that would have broken it, found by running it

**A library is one IP address.** `POST /api/rebuild/resume` is capped at
`GUEST_DRAFT_HOURLY_LIMIT_PER_IP` (default **10/hour**), because inserted rows are the thing worth
rate-limiting. A room of a dozen people on the same wifi trips it, and the eleventh person hits a
wall in front of the librarian whose trust is the entire reason we are in the room.

Fixed by not making the file depend on the row: **`POST /api/verbatim/export` writes nothing** —
no account, no draft, no database — so it is always available, and the rate-limited response now
says so and offers the download instead of an apology.

**The exported file is self-contained on purpose.** No script, no stylesheet, no font, no image,
no analytics, and **no link back to us**. It opens from a USB stick in ten years. A "made with"
badge on a document someone sends to a hiring manager would be us advertising through their job
search — the borrowed-trust failure the mesh warned about, aimed at a person instead of an
institution. Asserted by test, not by intention.

**Two parser bugs, both invisible until a file was rendered and read:**

- The role separator was **em/en dash only**, so `Shift Lead - Acme Distribution` matched nothing
  and fell through to the headingless branch. Since every line did, a two-job history rendered as
  **four panels with blank headings**. Real résumés use a plain hyphen.
- A **city in the contact line** survived the contact filter (`Renton, WA | dana@…` strips to
  `Renton WA`, which isn't empty), so an About-me opened with the person's own address line. The
  location is now moved into the field it belongs to, which also closes the gap honestly rather
  than leaving debris in a sentence.

Neither is visible in `tsc`, in the parsed JSON (the fields were empty strings and a null), or in
any existing test. Both were found by exporting one résumé and **looking at it**.

## 4. The line we do not cross

The asset here is a public institution's credibility, and it is not ours to spend.

- **Genuinely useful with zero conversions**, or don't book the room.
- **Disclose the commercial edge to the librarian in plain words, before booking** — never after,
  never buried. Many systems ban commercial solicitation outright; that is their call to make with
  accurate information.
- **Never harvest participant data for marketing under the institution's trust.** No sign-in
  requirement, no email capture as the price of the file, no follow-up to people who attended.
  This is the one that cannot be undone.

## 5. What counts as success

**Not attendance, and not downloads.** The metric is DeckSketch's: **did the librarian refer a
second stranger we have never met?** A librarian who watched a patron leave with something real
will recommend it again, unprompted, indefinitely — that is a warm, durable channel, and it is the
opposite of a cold tab on a corkboard.

Attendance is the vanity version, in the same way scans were in the poster round, and for the same
reason: it counts interest, not completion.

## 6. The one-page proposal

> Copy for the librarian. Public value first; the commercial part is stated in the third paragraph
> rather than omitted, per the disclosure test above.

---

**A free résumé-to-webpage session for job seekers**

I'm Sandon Jurowski, based in Renton. I'd like to offer a free session at your branch for people
working on their résumés.

Someone brings a résumé — on paper, as a PDF, or just typed out. In about ten minutes they leave
with a clean one-page profile of their own work history: a single file they keep, that opens on any
computer without an internet connection, and that prints. It's theirs. Nothing is stored, no
account is needed, and no email address is collected.

The tool is deliberately narrow, and I'd rather say why than oversell it: **it does not write
anything for anyone.** It only recognises and rearranges the text a person supplied. If their
résumé doesn't state a job title or a summary, the page says so and leaves the space empty rather
than inventing something plausible. A résumé is a factual claim about someone's employment, and a
tool that tidies a job history invents one.

**The commercial part, up front:** I run QuickSites, which builds and hosts websites. If someone
wants their page online as a link they can send, we can do that — but it is optional, it is not the
point of the session, and nobody is asked for it. The file they walk out with works whether or not
they ever deal with me again. If a session where nobody signs up for anything isn't worth your room
and your patrons' time, that's a fair reason to say no.

What I'd need: a table, a few chairs, and a wifi connection. Attendees can use library computers or
their own phones. I'd bring printed instructions so anyone can do it again at home.

Happy to run it once and see whether it's useful to your patrons before either of us plans a second.

— Sandon Jurowski · sandon@pointsevenstudio.com

---

## 7. Before the first session

- [ ] **Ask a librarian.** Two rounds of mesh discussion both ended pointing at a librarian nobody
      had spoken to. Their branch's programme policy decides most of this, and it is a free
      conversation.
- [ ] Check whether the branch bans commercial solicitation — if so, this proposal is the wrong
      shape and should be withdrawn rather than reworded.
- [ ] Try the flow on a library computer: an old browser, no admin rights, a locked-down download
      folder. The export is a plain HTML file specifically so this is survivable.
- [ ] Print the instructions. The session should work if the wifi doesn't.
