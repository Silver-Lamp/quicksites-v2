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

**The distinction underneath all four: an artifact versus a dependency.** A page someone keeps is
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
3. Before anything is published, **the finished page is read once more by a model** looking for
   the defects a person misses on their own document — words mangled by PDF extraction, leftover
   placeholder text, a name spelled two ways. It produces a list; it changes nothing. See §2c.
4. They correct anything wrong, then **download their résumé — as PDF, Word (.docx) or Markdown**,
   plus the one-page HTML profile. Theirs, offline, printable, no account.
5. *Optionally*, and only if they want it, they publish it as a page with a link they can send —
   with the same three files downloadable from that page (see §2b).

Step 4 is the completion. Step 5 is the upsell, and it is allowed to not happen.

## 2c. The proofread, and why it is safe to mention to a librarian

A librarian's first question about an AI résumé tool is the right one: *does it write things for
people?* The answer stays no, and this layer is the sharpest illustration of it.

Before a page goes live a model **reads** the finished text and flags: a real word corrupted by
PDF extraction, leftover scaffolding, an internal inconsistency. It hands back a list with the
exact quote. **It cannot edit the page.** Every other AI résumé product on the market offers to
rewrite someone's history; this one is only permitted to point at it.

Say it that way round in the room. "We check it and tell you what we found" is true and useful.
"AI-checked" or "error-free" would be neither — the checker missed a spaced variant of the very
corruption it was built for during its own test, and a claim of correctness is exactly the kind of
thing a library should not be lending its name to.

### ⚠️ PDF and Word matter more than the webpage, and it took building them to see it

The first version of this offered a single self-contained **HTML** file, and the reasoning was
sound: it opens anywhere, forever, without us. It is still the right artifact for a *profile page*.

But it is the wrong artifact for a **job application.** Employers ask for a PDF. Recruiters and
applicant-tracking systems parse `.docx` — and they parse it *structurally*, which is why the Word
export uses real heading styles rather than bold body text; a document that merely looks like it
has headings reads to a parser as one undifferentiated blob. Handing a job seeker an HTML file and
calling the session finished was solving our problem, not theirs.

All three come from **one parse and three emitters** (`lib/resume/outline.ts` + `formats.ts`), never
three parsers, because three code paths drift until the Word version quietly loses a job the PDF
still lists. The PDF is the print HTML rendered in headless Chromium, so it is provably the same
document rather than a fourth interpretation.

## 2b. And it can be hosted, with the files attached to the page

A patron who wants a link gets a real one — `https://<name>.quicksites.ai` — and the page carries a
**Downloads** section offering the same résumé in PDF, Word and Markdown, with the format and file
size on each button.

Live example, built end to end through this exact flow: **https://sandon.quicksites.ai/**

⚠️ **The hosted page does not replace the files, it carries them.** A page that renders someone's
résumé and offers no way to take it away makes every reader — including a hiring manager who wants
to forward it — dependent on us staying online. The download section exists so that the answer to
"what happens if QuickSites disappears" is "you already have the file", not "you lose your
résumé".

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
with their own work history laid out cleanly, and they can take it away in whichever format they
actually need: **a PDF to attach to an application, a Word document because most job boards and
recruiters want one, or a plain-text copy.** The files open on any computer without an internet
connection, and they print. They're theirs. Nothing is stored, no account is needed, and no email
address is collected.

The tool is deliberately narrow, and I'd rather say why than oversell it: **it does not write
anything for anyone.** It only recognises and rearranges the text a person supplied. If their
résumé doesn't state a job title or a summary, the page says so and leaves the space empty rather
than inventing something plausible. A résumé is a factual claim about someone's employment, and a
tool that tidies a job history invents one.

Before anyone publishes a page, we run one more check over the finished version — looking for
words that got mangled when their PDF was read, leftover placeholder text, or a name spelled two
different ways. It produces a list of things to look at. It does not change anyone's words; it is
not allowed to. A second pair of eyes, not a guarantee.

**The commercial part, up front:** I run QuickSites, which builds and hosts websites. If someone
wants their profile online as a link they can send — like https://sandon.quicksites.ai, which is my
own — we can do that, and the page carries the same downloadable files. But it is optional, it is
not the point of the session, and nobody is asked for it. The files they walk out with work whether
or not they ever deal with me again. If a session where nobody signs up for anything isn't worth your room
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
      folder. The HTML export is a single plain file specifically so this is survivable — but
      **check the PDF and .docx downloads there too**, since those are the ones people actually
      need and they are the ones a locked-down machine is most likely to block.
- [ ] ⚠️ **Test with a PDF exported from Google Docs.** Some PDFs map the `fi`/`fl` ligatures to
      the letter `g`, so extraction silently produces "ginancial", "girmware", "workglows" — real
      words, corrupted, with nothing to flag them. This was found on a real résumé *after it had
      been published*. The parser does not yet detect it; until it does, read the extracted text
      before anyone leaves with a file.
- [ ] Print the instructions. The session should work if the wifi doesn't.
