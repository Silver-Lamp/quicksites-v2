// lib/dev/random-meal.ts
import { slugify } from '@/lib/slug';

const ADJ = ['Signature','Smoky','Crispy','Herb-Roasted','Zesty','Umami','Silky','Caramelized','Spicy','Lemon-Pepper','Miso-Ginger','Maple'];
const PROTEIN = ['Chicken','Salmon','Tofu','Mushroom','Shrimp','Pork','Lamb','Chickpeas','Jackfruit','Eggplant','Beef'];
const METHOD = ['Grilled','Roasted','Braised','Seared','Slow-Cooked','Pan-Fried'];
const FLAVOR = ['Chimichurri','Harissa','Gochujang','Pesto','Tikka Masala','Teriyaki','Lemon Caper','Garlic-Herb','Citrus Glaze','Black Pepper Sauce'];
const SIDE = ['Herbed Rice','Roasted Veggies','Quinoa Salad','Garlic Noodles','Creamy Polenta','Sesame Greens','Warm Couscous'];

const HASHPOOL = ['#glutenfree','#dairyfree','#spicy','#vegan','#vegetarian','#highprotein','#comfortfood','#seasonal'];

const r = (n: number) => Math.random() * n;
const ri = (min: number, max: number) => Math.floor(min + r(max - min + 1));
const pick = <T,>(arr: T[]) => arr[ri(0, arr.length - 1)];
const sample = <T,>(arr: T[], k: number) => {
  const a = [...arr], out: T[] = [];
  for (let i = 0; i < k && a.length; i++) out.push(a.splice(ri(0, a.length - 1), 1)[0]);
  return out;
};
const toLocalDatetimeInput = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
};

export type RandomMeal = {
  title: string;
  description: string;
  priceUsd: string;
  imageUrl: string;
  availableFrom: string; // datetime-local value
  availableTo: string;
  maxPerOrder: string;
  qtyAvailable: string;
  cuisines: string[];
  autoDeactivate: boolean;
  slug: string;
  hashtags: string;
  hashtagsMode: 'append' | 'replace';
};

export function generateRandomMeal(opts?: { cuisinesPool?: string[]; seed?: string }): RandomMeal {
  const cuisinesPool = (opts?.cuisinesPool?.length ? opts.cuisinesPool : ['american','italian','japanese','mexican','thai','middle eastern','indian','korean']) as string[];
  const title = `${pick(ADJ)} ${pick(METHOD)} ${pick(PROTEIN)} with ${pick(FLAVOR)}${Math.random() < 0.6 ? ` & ${pick(SIDE)}` : ''}`;

  const sentences = [
    `Chef’s ${title.toLowerCase()} made fresh today.`,
    `Served with ${pick(SIDE).toLowerCase()}.`,
    `Small batch, limited portions.`,
  ];
  const description = sentences.join(' ');

  const priceUsd = (Math.round(ri(11, 24) + (Math.random() < 0.4 ? 0.5 : 0)) ).toFixed(2); // e.g. 12.00 or 12.50
  const slug = `${slugify(title)}-${ri(100, 999)}`;

  const now = new Date();
  const from = new Date(now.getTime() + ri(30, 180) * 60_000);   // 30–180 mins from now
  const to   = new Date(from.getTime() + ri(8, 72) * 60 * 60_000); // 8–72 hours window

  const cuisines = sample(cuisinesPool, ri(1, Math.min(3, cuisinesPool.length)));
  const hashtags = sample(HASHPOOL, ri(2, 4)).join(' ');

  const imageUrl = `https://placehold.co/800x600/png?text=${encodeURIComponent(title)}`;

  return {
    title,
    description,
    priceUsd,
    imageUrl,
    availableFrom: toLocalDatetimeInput(from),
    availableTo: toLocalDatetimeInput(to),
    maxPerOrder: String(ri(1, 5)),
    qtyAvailable: String(ri(8, 30)),
    cuisines,
    autoDeactivate: Math.random() < 0.85,
    slug,
    hashtags,
    hashtagsMode: 'append',
  };
}
