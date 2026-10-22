// lib/guide/triedAndGraded.ts — the copy and page list for the evidence guide site (working name
// "Tried & Graded"; owner chose "a separate guide site", 2026-10-21; docs/LONGEVITY_PLAN.md §12,
// docs/longevity/MULLEIN_PAGES.md). Built into a QuickSites template by
// scripts/guide/build-tried-and-graded.mts. Kept in code so lib/guide/__tests__ can hold every page
// to the copy rules before anything ships — a health page is the one place a phrase is a claim.
//
// Grades are NEVER written here: pages embed an `evidence_claims` block and the grade is derived
// from lib/evidence/topics at render.

import { gradeClaim } from '@/lib/evidence/grade';
import { EVIDENCE_TOPICS } from '@/lib/evidence/topics';

export const GUIDE_NAME = 'Tried & Graded';

/**
 * The look, borrowed in spirit from timeline.com (owner, 2026-10-21: "a case study to borrow design
 * elements from … not a blatant ripoff but similar styling"; docs/longevity/TRIEDANDGRADED_DESIGN.md):
 * a warm light page, a clean grotesk heading face, one restrained accent (emerald, not their red),
 * soft cards, airy banded sections. Applied by scripts/guide/build-tried-and-graded.mts.
 */
export const GUIDE_THEME = {
  id: 'tried-and-graded',
  name: 'Tried & Graded',
  accentColor: 'emerald-700',
  accent2Color: 'stone-700',
  neutral: 'warm',
  surface: 'soft',
  darkMode: 'light',
  fontPair: 'sora-inter',
  fontFamily: 'sans',
  borderRadius: 'lg',
  layout: { rhythm: 'banded', density: 'airy', sectionWidth: 'wide', heroLayout: 'centered', featureVariant: 'grid' },
} as const;

/** Small uppercase section label (Timeline's "COMPARE US TO OTHER" device). */
export const eyebrow = (t: string) => `<p class="not-prose mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-60">${t}</p>`;

/**
 * The home page's numbers, DERIVED from the evidence records at build time — never typed
 * (crosstalk/contracts/re-derivable-claims-standard.md). Adding a study or a topic changes them.
 */
export function guideStats() {
  const topics = Object.values(EVIDENCE_TOPICS);
  const studies = topics.reduce((n, t) => n + t.studies.length, 0);
  const claims = topics.flatMap((t) => t.claims.map((c) => gradeClaim(c.evidence, t.studies)));
  return {
    topics: topics.length,
    studies,
    claims: claims.length,
    testedNoEffect: claims.filter((g) => g === 'tested_no_effect').length,
  };
}

function statsRow(): string {
  const s = guideStats();
  const cell = (n: number | string, label: string) =>
    `<div class="border-t border-zinc-900/15 pt-3"><div class="text-4xl font-medium tracking-tight">${n}</div><div class="mt-1 text-sm opacity-70">${label}</div></div>`;
  return (
    '<div class="not-prose my-10 grid grid-cols-2 gap-6 sm:grid-cols-4">' +
    cell(s.studies, 'Studies read and recorded') +
    cell(s.claims, 'Claims graded by fixed rules') +
    cell(s.testedNoEffect, 'Claims tested and found to do nothing') +
    cell(6, 'Grades. Nobody picks the word.') +
    '</div>'
  );
}


/**
 * An OPEN EXPERIMENT card (HiveJournal, 2026-10-22: "add the HAVN hat experiment and Rife, Tested").
 * A claim nobody has tested yet is not graded at all — the grade function needs studies, and a
 * "No real evidence" badge would be a statement about research when it is only a statement about
 * runs. The card says what is claimed and by whom, how it will be tested, who pays (nobody with a
 * stake), and that no result exists yet — dated, because a count in prose rots
 * (re-derivable-claims-standard). Live counts come later from HJ's read-only summary endpoint.
 */
export const EXPERIMENTS_CHECKED = '2026-10-22';
export function experimentCard(e: { claimBy: string; claim: string; design: string; runHref: string; runLabel: string }): string {
  return (
    '<div class="not-prose my-8 rounded-lg border border-zinc-900/15 p-5">' +
    '<div class="flex flex-wrap items-center justify-between gap-2"><span class="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-60">Open experiment</span>' +
    `<span class="rounded-full border border-zinc-500/40 bg-zinc-500/15 px-2.5 py-0.5 text-xs font-semibold" data-experiment-status="untested">Not yet tested — no completed runs as of ${EXPERIMENTS_CHECKED}</span></div>` +
    `<p class="mt-3 text-sm opacity-70">Claim under test, in ${e.claimBy}’s own words — not verified by us:</p>` +
    `<p class="mt-1 text-lg font-medium leading-snug">“${e.claim}”</p>` +
    `<dl class="mt-4 grid gap-2 text-sm sm:grid-cols-2"><div><dt class="opacity-60">How it is tested</dt><dd>${e.design}</dd></div><div><dt class="opacity-60">Who pays</dt><dd>Nobody with a stake — independent, no affiliate link on the product under test.</dd></div></dl>` +
    `<a href="${e.runHref}" class="mt-5 inline-block rounded-md border border-zinc-900/30 px-4 py-2 text-sm font-semibold no-underline hover:border-zinc-900/60">${e.runLabel} →</a>` +
    '</div>'
  );
}

/**
 * A HISTORY TIMELINE row (owner, 2026-10-22: "transcribe the last 3 mov files … make a timeline and
 * facts history page"). The source was a ~9-minute promotional video on Royal Rife; each of its
 * claims is set against the documented record. Every row carries a status and a source, and the
 * status is the point: "documented" (a record exists), "claimed" (the story says it; we found no
 * record), "contradicted" (a record says otherwise).
 */
export type HistoryStatus = 'documented' | 'claimed' | 'contradicted';
export type HistoryRow = { year: string; text: string; status: HistoryStatus; source: string };
const HISTORY_LABEL: Record<HistoryStatus, string> = { documented: 'Documented', claimed: 'Claimed — no record found', contradicted: 'Contradicted by the record' };
const HISTORY_TINT: Record<HistoryStatus, string> = { documented: 'bg-emerald-500/15 border-emerald-500/40', claimed: 'bg-amber-500/15 border-amber-500/40', contradicted: 'bg-rose-500/15 border-rose-500/40' };
export function historyTimeline(rows: HistoryRow[]): string {
  return (
    '<ol class="not-prose my-8 border-l border-zinc-900/15">' +
    rows
      .map(
        (r) =>
          `<li class="relative ml-5 pb-7"><span class="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-zinc-900/40"></span>` +
          `<div class="flex flex-wrap items-center gap-2"><span class="text-sm font-semibold tabular-nums">${r.year}</span>` +
          `<span class="rounded-full border px-2 py-0.5 text-[11px] font-semibold ${HISTORY_TINT[r.status]}" data-history-status="${r.status}">${HISTORY_LABEL[r.status]}</span></div>` +
          `<p class="mt-1.5 leading-relaxed">${r.text}</p><p class="mt-1 text-xs opacity-60">Source: ${r.source}</p></li>`,
      )
      .join('') +
    '</ol>'
  );
}

export const RIFE_HISTORY_CHECKED = '2026-10-22';
export const RIFE_HISTORY: HistoryRow[] = [
  { year: '1888', text: 'Royal Raymond Rife is born on 16 May in Elkhorn, Nebraska.', status: 'documented', source: 'biographical record (Wikipedia, “Royal Rife”)' },
  { year: 'c. 1904', text: 'The story says he was admitted to Johns Hopkins at 16 and later trained at Zeiss. No record of either has been found; investigators describe his educational titles and Zeiss experience as unsubstantiated.', status: 'claimed', source: 'the video; no university or employer record located' },
  { year: '1929–31', text: 'Rife builds microscopes and films microbes with time-lapse; newspapers and Popular Science cover his work.', status: 'documented', source: 'San Diego Union (1929), Popular Science (June 1931)' },
  { year: '1931', text: 'The New York Times reports a Rife microscope said to magnify 17,000 times. The video says 60,000. Magnification is not resolution: a visible-light microscope cannot resolve viruses at any magnification, because light’s wavelength (roughly 200 nm) is larger than most viruses.', status: 'contradicted', source: 'New York Times (22 Nov 1931); optics — University of Wisconsin–Madison analysis (2017)' },
  { year: '1931', text: 'Kendall and Rife publish observations of typhoid bacteria in a “filterable” form in California and Western Medicine. Later findings contradict these observations.', status: 'documented', source: 'California and Western Medicine (Dec 1931)' },
  { year: '1930s', text: 'Rife says specific frequencies — a “mortal oscillatory rate” — make microbes disintegrate. No published, independently replicated study shows this.', status: 'claimed', source: 'Rife’s own accounts; no controlled replication found' },
  { year: '1934', text: 'A clinic organised by Dr Milbank Johnson treats 16 cancer patients; the story says 14 were “clinically cured” in three months. The figure comes from Rife’s own report. The patient records were never published, and Johnson reportedly wrote in 1935 that the results were “not conclusive”.', status: 'claimed', source: 'Rife’s report; no clinic records published' },
  { year: '1938', text: 'The San Diego Evening Tribune reports Rife’s claim to “devitalize disease organisms” — and that he stopped short of claiming a cure for cancer.', status: 'documented', source: 'San Diego Evening Tribune (6 May 1938)' },
  { year: '1930s–40s', text: 'The story says the AMA’s Morris Fishbein offered to buy Rife out, then sent people with bribes and threats, and that Rife’s lab was vandalised and his research destroyed. Fishbein was a real and combative AMA figure; we found no record of these specific events.', status: 'claimed', source: 'the video and later promotional retellings' },
  { year: '1939–69', text: 'The story attributes a lab fire, a poisoning (of Dr Johnson, who died in 1944) and a hotel-bed fire to suppression of Rife’s work. We found no source for any of these beyond promotional retellings.', status: 'claimed', source: 'promotional retellings only' },
  { year: '1960–61', text: 'The story says Rife’s later partners were prosecuted for medical fraud and imprisoned. We have not located court records to confirm the details.', status: 'claimed', source: 'the video; court records not located' },
  { year: '1971', text: 'Rife dies on 5 August in El Cajon, California, aged 83 — penniless, and blaming organised medicine, per his obituary. The video says he was given a lethal dose of Valium in hospital; no record we found states the cause of death.', status: 'documented', source: 'Daily Californian obituary (11 Aug 1971); cause of death not in the record' },
  { year: '1987', text: 'Barry Lynes publishes The Cancer Cure That Worked, the book behind most of today’s Rife story. The American Cancer Society calls its claims implausible.', status: 'documented', source: 'the book; American Cancer Society' },
  { year: '1994', text: 'The American Cancer Society’s journal reviews electronic cancer devices, Rife devices among them, and finds no evidence they work.', status: 'documented', source: 'CA: A Cancer Journal for Clinicians (1994)' },
  { year: '1996–2009', text: 'Sellers of Rife devices are convicted of health fraud in the US — including felony convictions in 1996 and 26 felony counts against one seller in 2009.', status: 'documented', source: 'FDA Consumer; court reporting' },
  { year: '2000', text: 'An Australian newspaper links Rife machines to the deaths of cancer patients who relied on them.', status: 'documented', source: 'Sydney Morning Herald (30 Dec 2000)' },
  { year: '2001 · 2020', text: 'The US Federal Trade Commission sues a seller over claims that its Rife-style devices protect against viruses and bacteria (2001), and warns another over COVID-19 claims for frequency programmes (2020).', status: 'documented', source: 'FTC complaint (2001); FTC warning letter (2020)' },
  { year: '2026', text: 'Rife, Tested: an open, blinded test in a dish — yeast, a driven coil and an identical sham, counted blind. Never on a person or an animal.', status: 'documented', source: 'HiveJournal protocol' },
];

function guideCard(href: string, kicker: string, title: string, line: string): string {
  return `<a href="${href}" class="block rounded-lg border border-zinc-900/10 bg-white/60 p-5 no-underline transition hover:border-zinc-900/30"><span class="block text-[11px] font-semibold uppercase tracking-[0.18em] opacity-60">${kicker}</span><span class="mt-2 block text-lg font-medium leading-snug">${title}</span><span class="mt-1 block text-sm opacity-70">${line}</span></a>`;
}
export const QUIT_LINE = 'Free help to stop smoking: <a href="https://smokefree.gov">smokefree.gov</a> · 1-800-QUIT-NOW (1-800-784-8669).';
export const COMMISSION_LINE = 'We earn a commission if you buy through links on this site. It never changes a grade — grades are calculated from the studies by fixed rules.';
/** Blue Zones, LLC owns the BLUE ZONES and Power 9 marks; every page that names them says this. */
export const NOT_AFFILIATED_BZ = '“Blue Zones” and “Power 9” are trademarks of Blue Zones, LLC. This site is not affiliated with or endorsed by Blue Zones, LLC; we name the research only to grade it.';

export type GuideBlock =
  | { kind: 'hero'; headline: string; subheadline: string }
  | { kind: 'text'; html: string }
  | { kind: 'evidence'; topic: string; claimIds: string[]; title?: string };

export type GuidePage = { slug: string; navLabel?: string; title: string; description: string; blocks: GuideBlock[] };

const STUDY_PENDING =
  '<p><strong>The study is not open yet.</strong> It opens only after an independent ethics board approves the plan, and the plan is registered publicly before anyone joins. This page will say when.</p>';

/**
 * Owner, 2026-10-21: "remove commission notice when no products are yet in play". The commission
 * line appears ONLY while affiliate product links are live on the site. A disclosure for a
 * relationship that does not exist yet is noise; a missing disclosure once links go live is an FTC
 * problem — so flipping this to true is the one switch that adds both the links' context and the
 * notice, and the tests pin both states.
 */
export const AFFILIATE_LINKS_LIVE = false;

export function guidePages(opts: { affiliateLinksLive: boolean }): GuidePage[] {
  const commissionP = opts.affiliateLinksLive ? `<p><em>${COMMISSION_LINE}</em></p>` : '';
  const conflict = opts.affiliateLinksLive
    ? `<h2>Our conflict</h2><p>${COMMISSION_LINE} That is why the plan, the measure and the analysis are fixed and published before the study starts.</p>`
    : '<h2>Fixed before it starts</h2><p>The plan, the measure and the analysis are fixed and published before the study starts, so the result cannot be shaped after the fact.</p>';
  return [
  {
    slug: 'home',
    title: 'Tried & Graded — health claims, graded by the evidence',
    description: 'Popular supplements and therapies, graded by what the studies actually show — and tested ourselves where nobody has.',
    blocks: [
      { kind: 'hero', headline: 'Health claims, graded by the evidence', subheadline: 'What the studies show, what they don’t, and a study of our own where nobody has run one.' },
      {
        kind: 'text',
        html:
          statsRow() +
          eyebrow('How this works') +
          '<h2>Every claim gets a grade, and nobody here types it.</h2>' +
          '<p>We record each study — its design, its size, who paid for it, and whether the claim was what the study set out to test — and a fixed set of rules turns that into one of six grades. To change a grade, the evidence has to change. <a href="/how-we-grade">How we grade</a>.</p>' +
          '<p>Where a popular claim has never been tested, we say so, and where we can, we run the test — registered in advance, published whatever it shows.</p>' +
          commissionP +
          eyebrow('Guides') +
          '<h2>What we’ve graded</h2>' +
          '<div class="not-prose mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">' +
          guideCard('/urolithin-a', 'Urolithin A · Mitopure', 'Does urolithin A work?', 'Four placebo-controlled trials. Some results held, some didn’t.') +
          guideCard('/mullein-for-smokers', 'Mullein', 'Mullein for smokers', 'Nobody has tested it. That’s why we’re running a study.') +
          guideCard('/blue-zones-habits-graded', 'Blue Zones', 'The Blue Zones habits, graded', 'Sensible habits, mostly observational evidence.') +
          guideCard('/are-the-blue-zones-real', 'Blue Zones', 'Are the Blue Zones real?', 'The age-record debate, both sides.') +
          guideCard('/does-mullein-work', 'Mullein', 'Does mullein work?', 'Every common claim, graded.') +
          guideCard('/my-urolithin-a-log', 'Self-test', 'One person’s urolithin A log', 'On, off, on — every reading published.') +
          guideCard('/experiments', 'Open experiments', 'Claims nobody has tested — yet', 'The HAVN hat and Rife frequencies: blinded tests anyone can run.') +
          '</div>' +
          '<p class="not-prose mt-6 text-sm opacity-70">Also: <a class="underline" href="/does-mullein-detox-your-lungs">does mullein detox your lungs?</a> · <a class="underline" href="/smoking-mullein">smoking mullein</a> · <a class="underline" href="/mullein-drops-gummies-capsules-tea">drops, gummies, capsules or tea</a> · <a class="underline" href="/mullein-study">our mullein study</a> · <a class="underline" href="/blue-zones-habit-experiment">try a habit as an experiment</a></p>' +
          '<blockquote class="not-prose my-12 border-l-2 border-emerald-700 pl-5 font-serif text-2xl leading-snug">“A trial that tested a claim and found nothing outranks a weaker study that found something.”<span class="mt-3 block font-sans text-sm opacity-60">One of the six rules — <a class="underline" href="/how-we-grade">how we grade</a></span></blockquote>',
      },
    ],
  },
  {
    slug: 'mullein-for-smokers',
    navLabel: 'Mullein for smokers',
    title: 'Mullein for Smokers: What the Evidence Says (and Our Study)',
    description: 'Nobody has tested whether mullein helps a smoker’s cough. Here is what is known, what isn’t, and the study we’re running.',
    blocks: [
      { kind: 'hero', headline: 'Mullein for smokers: what the evidence says', subheadline: 'Short answer: nobody has tested it. That’s why we’re running a study.' },
      {
        kind: 'text',
        html:
          '<p><strong>Short answer:</strong> nobody has tested whether mullein helps a smoker’s cough. Not once. There are two human trials of mullein at all, and neither is about lungs.</p>' +
          '<h2>What people use it for</h2>' +
          '<p>Mullein leaf has been used for coughs and sore throats for a long time. The EU’s herbal medicines committee lists relief of sore throat with dry cough as a <em>traditional</em> use — meaning long-standing use, not trial results. Today it is sold as tea, drops, gummies and capsules, often with lung claims on the label.</p>',
      },
      { kind: 'evidence', topic: 'mullein', claimIds: ['cough', 'smokers-lungs'], title: 'What the research shows' },
      {
        kind: 'text',
        html:
          '<h2>What it can’t do</h2>' +
          '<p>No supplement undoes what smoke does to the lungs. The one thing that does is stopping, and it is never too late to start.</p>' +
          `<p>${QUIT_LINE}</p>` +
          '<h2>The study</h2>' +
          '<p>Adults who smoke daily and have had a cough for two months or more take mullein capsules for four weeks and identical-looking placebo capsules for four weeks, in random order, without knowing which is which. Cough is measured with a standard questionnaire. The plan is registered before anyone joins, and the result is published here whatever it shows — including “it did nothing”. <a href="/mullein-study">About the study</a>.</p>' +
          STUDY_PENDING,
      },
    ],
  },
  {
    slug: 'does-mullein-detox-your-lungs',
    title: 'Does Mullein Detox Your Lungs? What the Evidence Says',
    description: 'No study has tested mullein as a lung “detox” or measured lung function after taking it. What is known, and what actually helps.',
    blocks: [
      { kind: 'hero', headline: 'Does mullein detox your lungs?', subheadline: 'No study has tested it. Here’s what is known.' },
      {
        kind: 'text',
        html:
          '<p><strong>No study has tested mullein as a lung “detox”, and no study has measured lung function after taking it.</strong> The lungs clear themselves through mucus and tiny hair-like cilia; smoke slows that down. No product has been shown to reverse that.</p>' +
          '<p>Some people say mullein tea or drops make a cough feel looser or a throat feel softer. That is a real experience worth taking seriously — and it is also the kind of effect a placebo produces, which is why it needs a proper test.</p>',
      },
      { kind: 'evidence', topic: 'mullein', claimIds: ['smokers-lungs', 'cough'] },
      { kind: 'text', html: `<h2>What does help</h2><p>Stopping smoking is the only thing shown to let the lungs recover. ${QUIT_LINE}</p><p><a href="/mullein-study">Our mullein study</a> will test the cough question directly.</p>` },
    ],
  },
  {
    slug: 'smoking-mullein',
    title: 'Smoking Mullein: Is It Safer Than Tobacco?',
    description: 'Mullein is smoked as a tobacco-free herb. What is and isn’t known about breathing its smoke.',
    blocks: [
      { kind: 'hero', headline: 'Smoking mullein', subheadline: 'Tobacco-free is not the same as smoke-free.' },
      {
        kind: 'text',
        html:
          '<p>Dried mullein leaf is sold as a smoking blend, often to cut down on tobacco or as a base for other herbs. It contains no nicotine.</p>' +
          '<p><strong>What isn’t known:</strong> no study has measured what breathing mullein smoke does to the lungs over time. <strong>What is known:</strong> burning plant material makes smoke — fine particles and combustion products the lungs have to deal with, whatever the plant. “No tobacco” does not mean “no smoke”.</p>' +
          `<p>If you are using it to cut down, that is a step worth support. ${QUIT_LINE}</p>`,
      },
    ],
  },
  {
    slug: 'does-mullein-work',
    navLabel: 'Does it work?',
    title: 'Does Mullein Work? Every Claim, Graded',
    description: 'Every common mullein claim, graded by the human studies behind it — including the ones that don’t exist.',
    blocks: [
      { kind: 'hero', headline: 'Does mullein work?', subheadline: 'Every common claim, graded by the human studies behind it.' },
      { kind: 'evidence', topic: 'mullein', claimIds: [], title: 'The claims' },
      {
        kind: 'text',
        html:
          '<h2>How long does it take to work?</h2>' +
          '<p>Nobody knows, because the effect itself has never been measured for cough. Labels that promise results within days are not based on a trial. Our study measures at four weeks.</p>' +
          '<h2>Is it safe?</h2>' +
          '<p>Mullein has a long history of use and few reported problems, but it has not been studied for safety in trials either. Talk to a doctor first if you are pregnant or breastfeeding, have a lung condition, or take other medicines. Strain teas well — the leaf’s fine hairs can irritate the throat.</p>',
      },
    ],
  },
  {
    slug: 'mullein-drops-gummies-capsules-tea',
    title: 'Mullein Drops vs Gummies vs Capsules vs Tea',
    description: 'The forms mullein is sold in, what the labels mean, and what to look for — with no claim the evidence doesn’t support.',
    blocks: [
      { kind: 'hero', headline: 'Mullein drops, gummies, capsules or tea', subheadline: 'What you’re buying, and what to look for.' },
      {
        kind: 'text',
        html:
          commissionP +
          '<p>None of these forms has been tested for cough in a human trial, so none can be recommended for it. If you choose to try mullein, these are the differences that matter:</p>' +
          '<ul><li><strong>Tea</strong> — the traditional form; cheapest; strain it well.</li><li><strong>Drops (tincture or glycerite)</strong> — concentrated extract; check the ratio and whether it contains alcohol.</li><li><strong>Gummies</strong> — usually the least mullein per serving, plus sugar.</li><li><strong>Capsules</strong> — dried leaf or extract in a measured dose; the form our study uses.</li></ul>' +
          '<h2>What to look for</h2><ul><li>A third-party certificate of analysis (identity, heavy metals, microbes).</li><li>The part of the plant and the amount per serving on the label.</li><li>No promises to “detox”, “cleanse” or “repair” lungs — a label that makes one is making a claim no study supports.</li></ul>' +
          '<p><em>Products will be listed here once we’ve checked their certificates.</em></p>',
      },
    ],
  },
  {
    slug: 'mullein-study',
    navLabel: 'The study',
    title: 'Our Mullein Study: Smoker’s Cough, Placebo-Controlled',
    description: 'A registered, placebo-controlled study of mullein for smoker’s cough. The plan, who can join, and the result — published whatever it shows.',
    blocks: [
      { kind: 'hero', headline: 'Our mullein study', subheadline: 'Registered in advance. Published whatever it shows.' },
      {
        kind: 'text',
        html:
          STUDY_PENDING +
          '<h2>The question</h2><p>In adults who smoke daily and have a long-lasting cough, does four weeks of mullein improve cough compared with an identical-looking placebo?</p>' +
          '<h2>How it works</h2><ul><li>Two four-week periods with a two-week break between: mullein capsules in one, placebo in the other, in random order. Nobody — including us — knows which is which until the end.</li><li>Cough is measured with the Leicester Cough Questionnaire, a standard tool used in cough research.</li><li>A short daily cough diary, and cigarettes per day — so the study would also notice if taking a supplement made anyone smoke more.</li></ul>' +
          '<h2>Who it’s for</h2><p>Adults 21 and over who smoke cigarettes daily and have had a cough for two months or more. People with a diagnosed lung disease, who are pregnant, or who cough up blood should talk to their doctor instead.</p>' +
          `<h2>Help to stop</h2><p>Everyone who joins gets quit-smoking support, and stopping during the study is welcome. ${QUIT_LINE}</p>` +
          conflict,
      },
    ],
  },
  {
    slug: 'are-the-blue-zones-real',
    navLabel: 'Blue Zones',
    title: 'Are the Blue Zones Real? The Age-Record Debate, Both Sides',
    description: 'Do people in the Blue Zones really live longer, or are the records wrong? The critique, the response, and what holds either way.',
    blocks: [
      { kind: 'hero', headline: 'Are the Blue Zones real?', subheadline: 'The debate over the age records — both sides, and what holds either way.' },
      {
        kind: 'text',
        html:
          '<p>The Blue Zones are five places — in Sardinia, Okinawa, Ikaria, Nicoya and Loma Linda — described as having unusually many people living into their nineties and beyond. The idea became books, a Netflix series and a brand. Whether those places really have exceptional longevity is now argued in public, by researchers on both sides.</p>' +
          '<h2>The critique</h2>' +
          '<p>Demographer Saul Newman has argued that records of extreme age cluster where record-keeping was poor. In his work, counts of people over 110 in US states fell sharply after birth certificates were introduced, and recorded birthdates bunch on days divisible by five — patterns he links to error and, in places, pension fraud. The work won a 2024 Ig Nobel prize. It was circulated as preprints.</p>' +
          '<h2>The response</h2>' +
          '<p>Blue Zones researchers say the ages in the original areas were checked against civil registers and church records going back to the 1800s, and that the critique looked at larger regions than the Blue Zones themselves. A 2025 paper in <em>The Gerontologist</em> (Austad &amp; Pes, “The validity of Blue Zones demography: a response to critiques”) argues the original age claims meet rigorous standards. Newman’s reply: if the first record is wrong, every later record copies it perfectly.</p>' +
          '<h2>What holds either way</h2>' +
          '<p>The debate is about whether these places live longest — not about whether the habits are good for you. Those habits have their own studies, and we grade them one by one: <a href="/blue-zones-habits-graded">the Blue Zones habits, graded</a>.</p>' +
          `<p><em>${NOT_AFFILIATED_BZ}</em></p>`,
      },
    ],
  },
  {
    slug: 'blue-zones-habits-graded',
    title: 'The Blue Zones Diet and Habits, Graded by the Evidence',
    description: 'Each Blue Zones habit — moving, purpose, plants, the 80% rule, wine, faith, social ties — graded by the studies behind it.',
    blocks: [
      { kind: 'hero', headline: 'The Blue Zones habits, graded', subheadline: 'Sensible habits, mostly observational evidence — each one graded on its own studies.' },
      {
        kind: 'text',
        html:
          '<p>The Blue Zones work distils long-lived places into a short list of habits — the “Power 9”. Most are good, ordinary advice. The question this page answers is narrower: <strong>how strong is the evidence for each one?</strong> Most of it comes from observational studies — people who do the habit compared with people who don’t — which shows a link but can’t prove the habit causes it. Our grades say so.</p>',
      },
      { kind: 'evidence', topic: 'blue-zones', claimIds: [], title: 'Each habit, graded' },
      {
        kind: 'text',
        html:
          '<h2>Not yet graded</h2>' +
          '<ul><li>Downshift (a daily routine to shed stress)</li><li>Loved ones first (family close by, committed partner)</li></ul>' +
          '<p>These have research behind them that we have not entered yet. Until we have, we don’t grade them — “not yet graded” is not the same as “no evidence”.</p>' +
          '<p>Want to test one of these habits on yourself? <a href="/blue-zones-habit-experiment">Try a habit as an experiment</a>.</p>' +
          `<p><em>${NOT_AFFILIATED_BZ}</em></p>`,
      },
    ],
  },
  {
    slug: 'blue-zones-habit-experiment',
    title: 'Try a Blue Zones Habit as an Experiment',
    description: 'Pick one habit, one thing to measure, four weeks. A simple way to test a longevity habit on yourself — and log it honestly.',
    blocks: [
      { kind: 'hero', headline: 'Try a habit as an experiment', subheadline: 'One habit, one measure, four weeks — logged honestly.' },
      {
        kind: 'text',
        html:
          '<p>Habits are the easiest longevity advice to test on yourself, because they cost nothing and you can measure something real. Here is the shape of a fair self-test:</p>' +
          '<ol><li><strong>Pick one habit</strong> — say, a walk after every meal, or one more meal a week with friends.</li><li><strong>Pick one thing to measure</strong> that you can’t talk yourself into: resting heart rate in the morning, hours of sleep from a tracker, daily steps, or a short standard mood questionnaire.</li><li><strong>Measure for a week before you start</strong>, then four weeks with the habit. Same time of day, every day.</li><li><strong>Write down your prediction first</strong> — how much you expect it to change — so the result can surprise you.</li><li><strong>Keep every reading</strong>, including the bad weeks.</li></ol>' +
          '<p>One person’s four weeks is a log, not proof. Many people logging the same habit the same way starts to say something — that is what we’re building, with HiveJournal. <strong>Not open yet</strong>; this page will say when.</p>' +
          `<p><em>${NOT_AFFILIATED_BZ}</em></p>`,
      },
    ],
  },
  {
    slug: 'urolithin-a',
    navLabel: 'Urolithin A',
    title: 'Does Urolithin A (Mitopure) Work? Every Trial, Graded',
    description: 'Urolithin A in human trials: what improved, what didn’t, and who paid — each claim graded by the same fixed rules.',
    blocks: [
      { kind: 'hero', headline: 'Does urolithin A work?', subheadline: 'Four placebo-controlled trials. Some results held, some didn’t. Each claim graded.' },
      {
        kind: 'text',
        html:
          '<p>Urolithin A is a compound your gut bacteria can make from foods like pomegranate — some people make plenty, many make little. It is sold as a supplement, mainly as <strong>Mitopure</strong>, an ingredient made by Amazentis and sold under its own brand, Timeline. The idea behind it: it helps cells clear out worn-out mitochondria, the parts that make energy.</p>' +
          '<p><strong>The short answer:</strong> it has more real human trials than most supplements — four placebo-controlled trials between 2022 and 2026. The results are mixed. Several measures improved; several main outcomes did not. Three of the four trials were paid for by the maker; we show that next to every result.</p>',
      },
      { kind: 'evidence', topic: 'urolithin-a', claimIds: [], title: 'Each claim, graded' },
      {
        kind: 'text',
        html:
          '<h2>What no trial has measured</h2>' +
          '<p>No human trial has tested whether urolithin A slows aging or adds years of life. The longest trials ran four months. Lifespan results come from animal studies only.</p>' +
          '<h2>Is it safe?</h2>' +
          '<p>Across these trials, side effects were no different from placebo at the doses tested (up to 1,000 mg a day, up to four months). Longer-term safety in people hasn’t been studied. Talk to a doctor first if you are pregnant, take other medicines, or have a medical condition.</p>' +
          '<h2>A test of our own</h2>' +
          '<p>The founder of this site is taking Mitopure and logging it on a schedule set in advance — on, off, then on again — measuring the one thing the trials found most often: muscle endurance. <a href="/my-urolithin-a-log">The log, including the weeks off</a>.</p>' +
          commissionP,
      },
    ],
  },
  {
    slug: 'my-urolithin-a-log',
    title: 'Urolithin A: One Person’s On/Off Log, Published in Full',
    description: 'The founder of this site takes Mitopure and logs grip endurance on a schedule set in advance — on, off, on — with every reading published.',
    blocks: [
      { kind: 'hero', headline: 'One person’s urolithin A log', subheadline: 'On, off, then on again. Every reading published, including the weeks off.' },
      {
        kind: 'text',
        html:
          '<p>Sandon, who runs this site, started taking Mitopure (Timeline) in mid-October 2026. There was no reading before he started, and one can’t be made after the fact — so instead of a before-and-after, this log switches it off and on again and compares the stretches.</p>' +
          '<h2>The plan, set before the first reading</h2>' +
          '<ul><li><strong>On</strong> for 6 weeks, measuring weekly.</li><li><strong>Off</strong> for 4 weeks, measuring on the same schedule.</li><li><strong>On</strong> again for 6 weeks.</li></ul>' +
          '<h2>What’s measured</h2>' +
          '<ul><li><strong>Grip endurance</strong> — repetitions to fatigue at a fixed load on a hand dynamometer. This mirrors the hand-muscle endurance result in the 2022 trial of older adults.</li><li><strong>A 6-minute walk</strong> on a measured course, monthly. That was the same trial’s main outcome, and it did not improve — it is included anyway.</li></ul>' +
          '<p>Same time of day each time, and no hard workout in the 24 hours before.</p>' +
          '<h2>The readings</h2>' +
          '<p><em>No readings yet — the first one will appear here, and every one after it, including the off weeks.</em></p>' +
          '<h2>What this can and can’t show</h2>' +
          '<p>One person who knows what he’s taking is a log, not evidence. It can’t move the grades on <a href="/urolithin-a">the urolithin A page</a>, and it isn’t a typical result. What it can do is show, in public and in advance, what an honest self-test looks like.</p>' +
          commissionP,
      },
    ],
  },
  {
    slug: 'experiments',
    navLabel: 'Experiments',
    title: 'Open Experiments: Claims Nobody Has Tested Yet',
    description: 'Popular claims with no independent test behind them — and blinded experiments anyone can run, published whichever way they come out.',
    blocks: [
      { kind: 'hero', headline: 'Open experiments', subheadline: 'Claims nobody has tested yet. Blinded tests anyone can run, published either way.' },
      {
        kind: 'text',
        html:
          '<p>Some claims have no trial behind them at all — not a bad one, none. We don’t grade those; a grade needs evidence. Instead we list the claim, who makes it, and an experiment designed to test it: pre-registered, blinded where it can be, and published whatever it shows. The experiments run on HiveJournal, where anyone can copy one and submit a result.</p>' +
          '<div class="not-prose mt-6 grid gap-4 sm:grid-cols-2">' +
          guideCard('/havn-hat', 'Open experiment · EMF clothing', 'Does the HAVN hat do anything?', 'A meter test, then 12 blinded nights against a plain beanie.') +
          guideCard('/rife-tested', 'Open experiment · frequencies', 'Rife, tested: does a frequency kill a microbe?', 'A blinded test in a dish — never on a person.') +
          guideCard('/rife-history', 'History', 'Royal Rife: the story vs the record', 'Every claim in a popular video, checked against the documents.') +
          guideCard('/mullein-study', 'Planned study', 'Mullein for smoker’s cough', 'Placebo-controlled; opens after ethics approval.') +
          guideCard('/my-urolithin-a-log', 'Self-test', 'One person’s urolithin A log', 'On, off, on — every reading published.') +
          '</div>',
      },
    ],
  },
  {
    slug: 'havn-hat',
    title: 'Does the HAVN Hat Do Anything? An Open, Blinded Experiment',
    description: 'HAVN says its WaveStopper fabric blocks over 99.7% of phone and Wi-Fi signals and helps sleep. Nobody has tested that independently. Here is the test.',
    blocks: [
      { kind: 'hero', headline: 'Does the HAVN hat do anything?', subheadline: 'The claims, what is known, and a blinded experiment anyone can run.' },
      {
        kind: 'text',
        html:
          experimentCard({
            claimBy: 'HAVN',
            claim: 'Its WaveStopper fabric blocks over 99.7% of RF from phones, Wi-Fi and Bluetooth, and it improves sleep and cognition.',
            design: 'Part one measures the radio signal reaching the head with a meter — no hat, a plain beanie, the HAVN hat. Part two is 12 nights, blinded, against an identical-looking plain beanie, with the outcome fixed in advance and a guess at which hat was which before unblinding.',
            runHref: 'https://www.hivejournal.com/dreampro/templates/193a92b0-ed8a-4c31-88fc-02ee72815a4a',
            runLabel: 'Run it yourself on HiveJournal',
          }) +
          eyebrow('What is known today') +
          '<h2>Two different claims, two different questions</h2>' +
          '<p><strong>The shielding claim is physics, and testable at home.</strong> Silver-mesh fabric can block radio signals; the question is how much, at which frequencies, and whether a hat that leaves the neck and face open changes what reaches the head. The figures in circulation — 99% in one press release, 99.7% in a listing, a per-frequency table in a review — trace back to the company; the test labs are described only as “military-grade”, and we found no named, independent report.</p>' +
          '<p><strong>The sleep and cognition claim is a health claim, and it has no controlled study</strong> that we could find — only customer reviews. A plain beanie feels the same on your head, which is exactly why part two is blinded against one.</p>' +
          '<h2>What we will and won’t do</h2>' +
          '<ul><li>We won’t say it works or doesn’t until results exist.</li><li>We don’t link to the hat with an affiliate tag — earning from a product we are testing would be a conflict.</li><li>When runs come in, this page will show them, failures included.</li></ul>',
      },
    ],
  },
  {
    slug: 'rife-tested',
    title: 'Rife, Tested: Does a Frequency Kill a Microbe in a Dish?',
    description: 'Rife-device sellers say specific frequencies destroy microbes. A blinded test in a dish — yeast, a driven coil versus an identical sham — never on a person.',
    blocks: [
      { kind: 'hero', headline: 'Rife, tested', subheadline: 'Does a frequency kill a microbe in a dish? A blinded test, never on a person.' },
      {
        kind: 'text',
        html:
          experimentCard({
            claimBy: 'sellers of Rife frequency devices',
            claim: 'A specific frequency, delivered by the device, destroys a specific microbe.',
            design: 'A blinded test in a dish: yeast cultures exposed to a driven coil or to an identical sham coil, with the counting done by someone who doesn’t know which was which. Never on a person or an animal.',
            runHref: 'https://www.hivejournal.com/rife-tested',
            runLabel: 'Read the protocol on HiveJournal',
          }) +
          eyebrow('What is known today') +
          '<h2>A long history of claims, and of regulators</h2>' +
          '<p>Rife devices are named after Royal Rife, who claimed in the 1930s that frequencies could destroy microbes. Sellers have repeated versions of that claim since. The US Federal Trade Commission sued one seller in 2001 over ads claiming protection against viruses and bacteria, and in 2020 warned another over COVID-19 claims for frequency programmes. We found no modern controlled study showing a Rife device kills microbes.</p>' +
          '<p>The full story — and which parts of it are documented — is in <a href="/rife-history">Royal Rife: the story vs the record</a>.</p>' +
          '<p>That is why this test happens in a dish and nowhere else: if a frequency did kill a microbe, a dish is the simplest place to see it, and nobody is put at risk finding out.</p>' +
          '<h2>What this page will never say</h2>' +
          '<p>That a frequency treats, prevents or cures anything in a person. Even a positive result in a dish would not show that.</p>',
      },
    ],
  },
  {
    slug: 'rife-history',
    title: 'Royal Rife: The Story vs the Record — A Timeline',
    description: 'A popular video says Royal Rife “cured cancer” and was silenced. Each claim, checked: documented, only claimed, or contradicted by the record.',
    blocks: [
      { kind: 'hero', headline: 'Royal Rife: the story vs the record', subheadline: 'Every claim in a popular video, set against what is documented.' },
      {
        kind: 'text',
        html:
          '<p>A widely shared video tells the story of Royal Raymond Rife: a brilliant scientist who built a microscope that could see viruses, found frequencies that made microbes explode, cured 14 of 16 “hopeless” cancer patients in 1934 — and was silenced by the American Medical Association. We transcribed it and checked each claim against the record.</p>' +
          '<p>Each entry below is marked <strong>documented</strong> (a record exists), <strong>claimed</strong> (the story says it; we found no record), or <strong>contradicted</strong> (a record says otherwise). Where we found nothing, we say so — that is not the same as proving it false.</p>' +
          eyebrow(`Timeline · checked ${RIFE_HISTORY_CHECKED}`) +
          historyTimeline(RIFE_HISTORY) +
          eyebrow('What this adds up to') +
          '<h2>A real inventor, a story that grew</h2>' +
          '<p>Rife was real, built real microscopes, and was covered by real newspapers. The cancer cure is not in the record: the one clinic’s results come from his own report, its records were never published, and in 1938 a newspaper that covered him noted he stopped short of claiming a cure. The suppression story — bribes, fires, poisonings — appears in retellings, mostly after a 1987 book, not in documents we could find.</p>' +
          '<p><strong>If you or someone you love has cancer, please talk to an oncologist.</strong> People have died relying on Rife devices instead of treatment.</p>' +
          '<p>Whether a frequency can kill a microbe at all is a question a dish can answer, safely. <a href="/rife-tested">That test is open to anyone</a>.</p>',
      },
    ],
  },
  {
    slug: 'how-we-grade',
    navLabel: 'How we grade',
    title: 'How We Grade Health Claims',
    description: 'The six grades, the rules that produce them, and why testimonials never count.',
    blocks: [
      { kind: 'hero', headline: 'How we grade', subheadline: opts.affiliateLinksLive ? 'Six grades, fixed rules, no exceptions for products we earn from.' : 'Six grades, fixed rules, no exceptions.' },
      {
        kind: 'text',
        html:
          '<p>Each claim lists the studies behind it. Each study is recorded with its design, size, length, funder, and whether the claim was what it set out to test. A program turns that into a grade. Nobody picks the word.</p>' +
          '<ul><li><strong>Established</strong> — two or more placebo-controlled trials found it on their main outcome, or a pooled analysis of such trials did.</li><li><strong>Promising</strong> — one placebo-controlled trial found it on its main outcome.</li><li><strong>Tested — no effect found</strong> — a placebo-controlled trial tested it as its main outcome and found nothing.</li><li><strong>Early evidence</strong> — human studies without a placebo, or a result on a measure the trial wasn’t built around.</li><li><strong>Lab studies only</strong> — animals or cells.</li><li><strong>No real evidence</strong> — testimonials, company material, tradition, or nothing.</li></ul>' +
          '<h2>The rules we hold ourselves to</h2><ul><li>Testimonials and company white papers never raise a grade.</li><li>A trial that tested a claim and found nothing outranks weaker positive results.</li><li>Who funded a study is always shown, and never changes the grade.</li><li>Every page shows the date its evidence was last checked.</li></ul>' +
          commissionP,
      },
    ],
  },
  ];
}

export const GUIDE_PAGES: GuidePage[] = guidePages({ affiliateLinksLive: AFFILIATE_LINKS_LIVE });
