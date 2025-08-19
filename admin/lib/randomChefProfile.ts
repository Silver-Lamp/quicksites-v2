// admin/lib/randomChefProfile.ts
export type RandomChefProfile = {
    name: string;
    location: string;         // "City, ST"
    profile_image_url?: string;
    youtube_url: string;
    bio: string;
    certifications_multiline: string; // textarea-friendly
  };
  
  const first = ["Ava","Maya","Jon","Nora","Mateo","Luca","Ivy","Owen","Aria","Kai","Leah","Milo","Zoë","Theo","Ruby","Ezra","Sofia","Ada","Noah","Elena"];
  const last  = ["Nguyen","Rivera","Kim","Patel","Santos","Chen","Ali","Martinez","Singh","Brown","Lopez","Wang","Garcia","Hughes","Silva","Parker","Khan","Cohen","Harris","Diaz"];
  const cities = [
    ["Seattle","WA"],["Portland","OR"],["Austin","TX"],["Nashville","TN"],["Madison","WI"],
    ["Boise","ID"],["Tucson","AZ"],["Asheville","NC"],["Boulder","CO"],["Providence","RI"],
    ["Savannah","GA"],["Santa Fe","NM"],["San Luis Obispo","CA"],["Ann Arbor","MI"],["Spokane","WA"],
  ];
  const specialties = [
    "family-style comfort food","seasonal vegetarian plates","weeknight Thai-inspired dishes",
    "BBQ & smoked favorites","gluten-free baking","Mediterranean small plates",
    "Korean home cooking","Mexican classics","cozy soups & stews","lacto-fermented sides",
  ];
  const vibe = [
    "locally sourced", "budget-friendly", "kid-approved", "crowd-pleasing", "from-scratch",
    "farmers market", "slow-cooked", "bold & spicy", "simple, clean flavors", "big-batch"
  ];
  const demoYouTubeIds = ["r3i7tA5Gk3U","Hc9M6_8tJmM","Uj2R8lpcH3U","8p7ImH4gI3Y","L6mE6o3n8bQ"];
  const certTemplates = [
    "Food Handler Card",
    "Allergen Awareness Certificate",
    "WA Cottage Food (home kitchen) – self-certified",
    "ServSafe Manager (in progress)"
  ];
  
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  
  export function generateRandomChefProfile(): RandomChefProfile {
    const fullName = `${pick(first)} ${pick(last)}`;
    const [city, st] = pick(cities);
    const spec = pick(specialties);
    const tone = pick(vibe);
    const bio = [
      `Hi, I’m ${fullName}. I cook ${spec} from my ${tone} kitchen in ${city}.`,
      `Menus rotate weekly—small batches, labeled ingredients, and recyclable packaging.`,
      `I keep things ${pick(["simple","seasonal","hearty","fresh"])} and ${pick(["honest","affordable","delicious"])}.`
    ].join(" ");
  
    const certs = [
      certTemplates[0],
      Math.random() > 0.5 ? certTemplates[1] : undefined,
      Math.random() > 0.65 ? certTemplates[2] : undefined,
      Math.random() > 0.8 ? certTemplates[3] : undefined,
    ].filter(Boolean).join("\n");
  
    const yt = `https://www.youtube.com/watch?v=${pick(demoYouTubeIds)}`;
  
    return {
      name: fullName,
      location: `${city}, ${st}`,
      youtube_url: yt,
      bio,
      certifications_multiline: certs,
    };
  }
  