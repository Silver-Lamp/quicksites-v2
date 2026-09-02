// lib/sales/lanes/geoDomainRental.ts
//
// Lane 1: renting an exact-match city-and-trade domain to one business in that town, by phone.
//
// ⚠️ EVERY CLAIM HERE IS ONE WE CAN BACK, AND THAT IS THE POINT OF THE FILE.
// These domains carry sites we built for businesses that have not agreed to anything. On
// 2026-08-19 we stripped invented promises off them — "fully licensed and insured", "we respond
// within the hour", fabricated five-star reviews. A pitch that puts those back verbally is the
// same dishonesty in the one place nothing can lint it, and it lands with the rep's name on it.
// So: the prices come from the pricing config, the exclusivity is real, and nothing in
// `trueClaims` is here because it sounds good.
//
// Real outbound history, for anyone tempted to treat the objections as theoretical: one
// salesperson, four calls, one "trial" that never billed. This is a first draft of a call, not
// a proven one — see /for-sales.
import { priceTier, formatCents } from '@/lib/outreach/geoPricing';
import type { LaneSpec } from '@/lib/sales/laneSpec';

// Towing is the flagship: premium tier, and most of the live inventory. Read from config so a
// price change is one edit and the flowchart cannot quote a stale number at a live prospect.
const TOWING = priceTier('towing');
// ⚠️ No literal price anywhere in this file, comments included — a "// $99.00" beside a
// derived constant is the same frozen number the derivation exists to avoid, and it lies the
// first time pricing changes. Run `priceTier('towing')` if you want today's figures.
export const FOUNDER_RATE = formatCents(TOWING.lockedCents); // the pre-rank founder rate
export const FULL_RATE = formatCents(TOWING.fullCents); // list price once a domain hits page 1

export const GEO_DOMAIN_RENTAL_LANE: LaneSpec = {
  id: 'geo-domain-rental',
  label: 'Renting an exact-match city domain, by phone',
  sells: `One business per city and trade rents the exact domain people type — renton-towing.com — for ${FOUNDER_RATE}/month.`,
  goal: 'They give you a number and an email, and agree to receive a checkout link today.',
  groundingLabel: 'what the rep can actually prove about this domain and its price',

  trueClaims: [
    'The domain exists, is live, and has a working site on it right now — they can open it while you talk.',
    'It is exclusive: one business per city and trade, so a competitor down the road cannot also have it.',
    `The rate is locked at signup. The list price becomes ${FULL_RATE}/month once a domain reaches page one; whoever rented at ${FOUNDER_RATE} stays at ${FOUNDER_RATE}.`,
    'Their phone number and business name go on the site, same day.',
    'Month to month. No contract, cancel whenever.',
  ],

  steps: [
    {
      id: 'open',
      label: 'Open',
      goal: 'Earn fifteen seconds by not sounding like a website pitch.',
      say: "Is this the owner? This'll take a minute and it's not a website pitch. Do you have a browser in front of you?",
    },
    {
      id: 'look',
      label: 'Get them looking',
      goal: 'Stop pitching. Put the thing on their screen — it stops being a call and starts being a page they are reading.',
      say: 'Type in renton-towing.com. That one is ours, and nobody has it yet.',
    },
    {
      id: 'offer',
      label: 'The offer',
      goal: 'Name the three true things: exclusive, theirs, locked price.',
      say: "It's the exact name people type when they need a tow in Renton. Rent it and it's your number on it, and no other tow company in town can have it.",
    },
    {
      id: 'objection',
      label: 'They push back',
      goal: 'Answer the one they raised, then go back to asking. Do not stack answers.',
    },
    {
      id: 'close',
      label: 'Close',
      goal: 'Get a number and an email. The card comes later, on a link.',
      say: "Give me the number you want calls going to and an email — I'll send a link, you put a card in, and your details are on the site today.",
    },
    {
      id: 'callback',
      label: 'Not today',
      goal: 'Take the callback and write it down. Do not manufacture urgency to save the call.',
      say: "That's fine — when's better? It's first-come on the domain, but I'm not going to invent a deadline for you.",
    },
  ],

  archetypes: [
    {
      id: 'towing-no-website',
      label: 'Towing operator, no website',
      traits: ['answers from the truck', 'prices by feel', 'gets ten spam calls a day'],
      mood: 'busy',
      openingState: 'Expects a robocall. Will hang up on anything that sounds read.',
    },
    {
      id: 'burned-by-seo',
      label: 'Burned by an SEO agency',
      traits: ['paid a monthly retainer for a year', 'never saw a report he understood', 'now assumes everyone is that'],
      mood: 'skeptical',
      openingState: 'Waiting for you to say the thing the last guy said, so he can hang up.',
    },
    {
      id: 'has-a-site-nephew-built',
      label: 'Already has a website',
      traits: ['someone in the family built it', 'quietly proud of it', 'not looking to replace it'],
      mood: 'friendly',
      openingState: 'Hears "website" and starts composing a polite no.',
    },
    {
      id: 'gatekeeper',
      label: 'Not the owner',
      traits: ['dispatcher or spouse answering', 'protective of the owner’s time'],
      mood: 'skeptical',
      openingState: 'Deciding in four seconds whether to pass you along.',
    },
  ],

  objections: [
    {
      id: 'already_have_site',
      says: 'I already have a website.',
      goodMove: 'Good — this is not a replacement. It is a second front door on the name people type, and it can point at the site they already have.',
      trap: 'Arguing their site is bad. They built it, or someone in their family did.',
    },
    {
      id: 'does_it_rank',
      says: 'Does it come up on Google?',
      goodMove: `Not yet, it's new, and say so plainly — then the real close: ${FOUNDER_RATE} now, ${FULL_RATE} once one reaches page one, and their rate is locked either way.`,
      trap: 'Any version of "it will rank." You do not know that, and it is the promise that ends up in a complaint.',
    },
    {
      id: 'what_am_i_paying_for',
      says: 'Ninety-nine for what, exactly?',
      goodMove: 'The name, exclusively, in their town — and let them do the one-job-pays-for-it math out loud themselves.',
      trap: 'Doing that math for them, in calls per week. That is a result promise wearing arithmetic.',
    },
    {
      id: 'burned_before',
      says: 'I paid an SEO guy for a year and got nothing.',
      goodMove: 'Agree — that is why this is rent on a specific name they can look at, not a retainer for work they cannot see. Month to month, cancel whenever.',
      trap: 'Defending the industry, or implying the last guy was a crook. He might have been their brother-in-law.',
    },
    {
      id: 'competitor_too',
      says: 'What stops you renting it to the guy across town?',
      goodMove: 'Nothing does, until they take it — one per city and trade is the product, and that is exactly why it is worth having.',
      trap: 'Turning a true fact into a fake deadline. First-come is real; "I have someone else on the line" is not.',
    },
    {
      id: 'contract',
      says: 'Am I locked into something?',
      goodMove: 'No. Month to month, cancel whenever — and their rate stays theirs for as long as they keep it.',
      trap: 'Overselling the lock-in as a favour. It is simply true; say it and move on.',
    },
    {
      id: 'call_me_back',
      says: 'Call me back later.',
      goodMove: 'Take it, name a time, write it down. Then actually call.',
      trap: 'Inventing a deadline to stop them going. Never do this.',
    },
    {
      id: 'who_are_you',
      says: 'Who are you people?',
      goodMove: 'A small studio that builds these — send them quicksites.ai and let them look while you are on the line.',
      trap: 'Inflating the company. The site is small and honest; being caught padding it costs the call.',
    },
    {
      id: 'send_me_email',
      says: 'Just send me an email.',
      goodMove: 'Fine — get the address, send it while still on the phone, and ask them to open it now so the domain is on their screen before you hang up.',
      trap: 'Accepting the email as a win. An unopened email is a no with a delay.',
    },
    {
      id: 'not_the_owner',
      says: "I'm not the owner.",
      goodMove: 'Ask when the owner is around and whether it is worth a call back then — briefly, without pitching the gatekeeper.',
      trap: 'Pitching anyway. They cannot buy, and a bad summary is what reaches the owner instead of you.',
    },
  ],

  honestyRules: [
    {
      id: 'no_ranking_promise',
      rule: 'Never promise a ranking, a call volume, or a result.',
      why: 'Nobody knows. A promise like that ends up in a complaint with the rep’s name on it, and it is the single rule the whole brief is strict about.',
      violatingExamples: [
        "this'll get you on page one",
        "you'll get five calls a week",
        'you will rank for towing in Renton',
        'it pays for itself in the first month',
      ],
    },
    {
      id: 'no_invented_urgency',
      rule: 'Never invent a deadline, a competing buyer, or a price that is about to expire.',
      why: 'First-come is true; a countdown is not. A fake deadline is the fastest way to turn a real advantage into a lie.',
      violatingExamples: [
        'I have another towing company looking at this one right now',
        'this price ends Friday',
        'if you do not take it today I have to release it',
      ],
    },
    {
      id: 'no_claims_on_their_behalf',
      rule: 'Never add claims about their business that they have not made — licensing, insurance, response times, reviews.',
      why: 'We spent a day stripping exactly those invented lines off these sites. Saying them out loud puts them back where nothing can catch them.',
      violatingExamples: [
        "we'll put licensed and insured on there for you",
        "it says you respond within the hour",
        "I'll add some reviews to fill it out",
      ],
    },
  ],
};
