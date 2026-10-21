// lib/guide/triedAndGraded.ts — the copy and page list for the evidence guide site (working name
// "Tried & Graded"; owner chose "a separate guide site", 2026-10-21; docs/LONGEVITY_PLAN.md §12,
// docs/longevity/MULLEIN_PAGES.md). Built into a QuickSites template by
// scripts/guide/build-tried-and-graded.mts. Kept in code so lib/guide/__tests__ can hold every page
// to the copy rules before anything ships — a health page is the one place a phrase is a claim.
//
// Grades are NEVER written here: pages embed an `evidence_claims` block and the grade is derived
// from lib/evidence/topics at render.

export const GUIDE_NAME = 'Tried & Graded';
export const QUIT_LINE = 'Free help to stop smoking: <a href="https://smokefree.gov">smokefree.gov</a> · 1-800-QUIT-NOW (1-800-784-8669).';
export const COMMISSION_LINE = 'We earn a commission if you buy through links on this site. It never changes a grade — grades are calculated from the studies by fixed rules.';

export type GuideBlock =
  | { kind: 'hero'; headline: string; subheadline: string }
  | { kind: 'text'; html: string }
  | { kind: 'evidence'; topic: string; claimIds: string[]; title?: string };

export type GuidePage = { slug: string; navLabel?: string; title: string; description: string; blocks: GuideBlock[] };

const STUDY_PENDING =
  '<p><strong>The study is not open yet.</strong> It opens only after an independent ethics board approves the plan, and the plan is registered publicly before anyone joins. This page will say when.</p>';

export const GUIDE_PAGES: GuidePage[] = [
  {
    slug: 'home',
    title: 'Tried & Graded — health claims, graded by the evidence',
    description: 'Popular supplements and therapies, graded by what the studies actually show — and tested ourselves where nobody has.',
    blocks: [
      { kind: 'hero', headline: 'Health claims, graded by the evidence', subheadline: 'What the studies show, what they don’t, and a study of our own where nobody has run one.' },
      {
        kind: 'text',
        html:
          '<h2>How this site works</h2>' +
          '<p>Every claim gets a grade, and nobody here types it. We record each study — its design, its size, who paid for it, and whether the claim was what the study set out to test — and a fixed set of rules turns that into one of six grades. To change a grade, the evidence has to change. <a href="/how-we-grade">How we grade</a>.</p>' +
          '<p>Where a popular claim has never been tested, we say so, and where we can, we run the test — registered in advance, published whatever it shows.</p>' +
          `<p><em>${COMMISSION_LINE}</em></p>` +
          '<h2>Guides</h2>' +
          '<ul><li><a href="/mullein-for-smokers">Mullein for smokers: what the evidence says</a></li><li><a href="/does-mullein-work">Does mullein work?</a></li><li><a href="/does-mullein-detox-your-lungs">Does mullein detox your lungs?</a></li><li><a href="/smoking-mullein">Smoking mullein</a></li><li><a href="/mullein-drops-gummies-capsules-tea">Mullein drops, gummies, capsules or tea</a></li><li><a href="/mullein-study">Our mullein study</a></li></ul>',
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
          `<p><em>${COMMISSION_LINE}</em></p>` +
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
          `<h2>Our conflict</h2><p>${COMMISSION_LINE} That is why the plan, the measure and the analysis are fixed and published before the study starts.</p>`,
      },
    ],
  },
  {
    slug: 'how-we-grade',
    navLabel: 'How we grade',
    title: 'How We Grade Health Claims',
    description: 'The six grades, the rules that produce them, and why testimonials never count.',
    blocks: [
      { kind: 'hero', headline: 'How we grade', subheadline: 'Six grades, fixed rules, no exceptions for products we earn from.' },
      {
        kind: 'text',
        html:
          '<p>Each claim lists the studies behind it. Each study is recorded with its design, size, length, funder, and whether the claim was what it set out to test. A program turns that into a grade. Nobody picks the word.</p>' +
          '<ul><li><strong>Established</strong> — two or more placebo-controlled trials found it on their main outcome, or a pooled analysis of such trials did.</li><li><strong>Promising</strong> — one placebo-controlled trial found it on its main outcome.</li><li><strong>Tested — no effect found</strong> — a placebo-controlled trial tested it as its main outcome and found nothing.</li><li><strong>Early evidence</strong> — human studies without a placebo, or a result on a measure the trial wasn’t built around.</li><li><strong>Lab studies only</strong> — animals or cells.</li><li><strong>No real evidence</strong> — testimonials, company material, tradition, or nothing.</li></ul>' +
          '<h2>The rules we hold ourselves to</h2><ul><li>Testimonials and company white papers never raise a grade.</li><li>A trial that tested a claim and found nothing outranks weaker positive results.</li><li>Who funded a study is always shown, and never changes the grade.</li><li>Every page shows the date its evidence was last checked.</li></ul>' +
          `<p><em>${COMMISSION_LINE}</em></p>`,
      },
    ],
  },
];
