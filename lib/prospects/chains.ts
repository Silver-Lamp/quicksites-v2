// lib/prospects/chains.ts
//
// A national chain is not a prospect for an ordering page: the decision is made at head office,
// the app already exists, and a rep walking into a Starbucks to pitch online ordering wastes the
// lunch. The King County sweep listed Starbucks, Jack in the Box, Papa Johns and Jersey Mike's
// as "call first — no online ordering found" because their location pages (locations.<brand>.com)
// carry no ordering link the detector recognises (2026-10-11). Pure; matched on the website's
// registrable domain OR the business name, never on prose.

const CHAIN_DOMAINS = [
  'starbucks.com', 'jackinthebox.com', 'papajohns.com', 'jerseymikes.com', 'subway.com', 'mcdonalds.com', 'dominos.com', 'pizzahut.com',
  'tacobell.com', 'wendys.com', 'burgerking.com', 'kfc.com', 'chipotle.com', 'panerabread.com', 'dunkindonuts.com', 'dunkin.com', 'dairyqueen.com',
  'arbys.com', 'littlecaesars.com', 'fiveguys.com', 'dennys.com', 'ihop.com', 'applebees.com', 'olivegarden.com', 'redrobin.com', 'chilis.com',
  'popeyes.com', 'chick-fil-a.com', 'sonicdrivein.com', 'wingstop.com', 'qdoba.com', 'pandaexpress.com', 'jamba.com', 'mod-pizza.com', 'modpizza.com',
  'redlobster.com', 'outback.com', 'buffalowildwings.com', 'carlsjr.com', 'delTaco.com', 'deltaco.com', 'firehousesubs.com', 'jimmyjohns.com',
  'einsteinbros.com', 'noodles.com', 'shakeshack.com', 'in-n-out.com', 'ivars.com', 'tacotime.com', 'tacotimenw.com', 'zoomhs.com', 'pandaexpress.com',
  'bostonpizza.com', 'roundtablepizza.com', 'pizzahut.com', 'baskinrobbins.com', 'krispykreme.com', 'tullys.com', 'peets.com', 'mcdonalds.com',
  'thehabit.com', 'blazepizza.com', 'cafe-rio.com', 'caferio.com', 'elgaucho.com', 'bjsrestaurants.com', 'cheesecakefactory.com', 'pfchangs.com',
  'dennys.com', 'sharis.com', 'blackbearDiner.com', 'blackbeardiner.com', 'wafflehouse.com', 'crackerbarrel.com', 'texasroadhouse.com',
].map((d) => d.toLowerCase());

const CHAIN_NAMES = [
  /^starbucks\b/i, /^jack in the box\b/i, /^papa john'?s\b/i, /^jersey mike'?s\b/i, /^subway\b/i, /^mcdonald'?s\b/i, /^domino'?s\b/i, /^pizza hut\b/i,
  /^taco bell\b/i, /^wendy'?s\b/i, /^burger king\b/i, /^kfc\b/i, /^chipotle\b/i, /^panera\b/i, /^dunkin'?\b/i, /^dairy queen\b/i, /^arby'?s\b/i,
  /^little caesars\b/i, /^five guys\b/i, /^denny'?s\b/i, /^ihop\b/i, /^applebee'?s\b/i, /^olive garden\b/i, /^red robin\b/i, /^chili'?s\b/i,
  /^popeyes\b/i, /^chick-fil-a\b/i, /^sonic drive/i, /^wingstop\b/i, /^qdoba\b/i, /^panda express\b/i, /^jamba\b/i, /^mod pizza\b/i, /^red lobster\b/i,
  /^outback steakhouse\b/i, /^buffalo wild wings\b/i, /^carl'?s jr\b/i, /^del taco\b/i, /^firehouse subs\b/i, /^jimmy john'?s\b/i, /^shake shack\b/i,
  /^in-n-out\b/i, /^ivar'?s\b/i, /^taco time\b/i, /^round table pizza\b/i, /^baskin[- ]robbins\b/i, /^krispy kreme\b/i, /^peet'?s coffee\b/i,
  /^the habit\b/i, /^blaze pizza\b/i, /^cafe rio\b/i, /^bj'?s restaurant/i, /^the cheesecake factory\b/i, /^p\.?f\.? chang/i, /^shari'?s\b/i,
  /^black bear diner\b/i, /^waffle house\b/i, /^cracker barrel\b/i, /^texas roadhouse\b/i,
];

function registrable(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, '').split('.');
  return parts.length >= 2 ? parts.slice(-2).join('.') : host.toLowerCase();
}

/** Is this a national chain, by its website's registrable domain or its name? */
export function isChain(input: { website?: string | null; businessName?: string | null }): boolean {
  const site = String(input.website ?? '').trim();
  if (site) {
    try {
      const host = new URL(site.startsWith('http') ? site : `https://${site}`).hostname;
      if (CHAIN_DOMAINS.includes(registrable(host))) return true;
    } catch {
      /* not a URL */
    }
  }
  const name = String(input.businessName ?? '').trim();
  return !!name && CHAIN_NAMES.some((re) => re.test(name));
}
