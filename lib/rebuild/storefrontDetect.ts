// lib/rebuild/storefrontDetect.ts
//
// "Is the site we just scraped a STORE?" — decided from the static HTML, before any AI call.
//
// ⚠️ WHY THIS EXISTS. The rebuild pipeline only knew a site was a store when it could READ the
// catalog (Shopify /products.json, or Product JSON-LD on the homepage). A store whose catalog is
// rendered client-side — FOYTEA on Shoptop, 2026-09-15, the first thing a prospective white-label
// partner ever built here — came out as a services brochure: hero, "services", story, FAQ. Nothing
// on the draft said "this was a shop and we couldn't read it". The absence of a Shop section is
// indistinguishable from a brochure site, which is exactly the class of silent failure CLAUDE.md
// §7 warns about (graceful degradation and silent failure are one mechanism seen from two sides).
//
// So detection is separated from import. Detection is cheap and static; import may fail. When a
// store is detected and nothing imports, assembleDraft still puts an EMPTY Shop block on the draft
// and records the gap in meta.ecom, and the rebuild summary tells the person what we could not do.
//
// Platform markers are CODE/CDN signatures, never a brand name in prose: hicustom.com (a POD
// supplier, not a store) says "Shopify" in a checkbox label and must not detect as one.
//
// Pure (no I/O). Exported for tests.

export type StorefrontDetection = {
  detected: boolean;
  /** Platform id when a code/CDN signature identified one, else null (heuristic-only detection). */
  platform: string | null;
  /** Which signals fired, for the summary + analytics. Stable identifiers, not prose. */
  signals: string[];
};

/** Code/CDN signatures. Order matters only for the reported `platform` when several match. */
const PLATFORM_MARKERS: ReadonlyArray<readonly [string, RegExp]> = [
  ['shopify', /cdn\.shopify\.com|Shopify\.theme|shopify-section|Shopify\.shop\b/i],
  ['shoptop', /static\.shoptop\.com|assets\.shoptop\.com|window\.SHOPTOP\b|ishoptop\.com/i],
  ['shoplazza', /shoplazza\.com|window\.SHOPLAZZA\b/i],
  ['shopline', /myshopline\.com|shoplineapp\.com|shoplinestatic/i],
  ['woocommerce', /woocommerce/i],
  ['bigcommerce', /bigcommerce\.com|cdn\d*\.bigcommerce/i],
  ['squarespace_commerce', /sqs-add-to-cart-button|squarespace-commerce/i],
  ['wix_stores', /wixstores|wix-stores|_api\/wix-ecommerce/i],
  ['magento', /Magento_Ui|mage\/cookies|Magento_Theme/i],
  ['prestashop', /prestashop/i],
  ['ecwid', /ecwid\.com|ecwid-/i],
  ['ueeshop', /ueeshop/i],
];

/** A link path that names a product, a collection, or the cart. */
const PRODUCT_PATH_RE = /\/(?:products?|item|items|p|goods|spu|sku|commodity)\/[^/?#]+|(?:goods|product|spu|sku|item)_?id=/i;
const COLLECTION_PATH_RE =
  /\/(?:collections?|categor(?:y|ies)|shop|store|goods|all-?goods|productType|product-?list|catalog)(?:\/|\?|$)/i;
const CART_PATH_RE = /\/(?:cart|checkout|basket)(?:\/|$)/i;

/** "Add to cart" in the languages our prospects' stores actually use. */
const ADD_TO_CART_RE =
  /add to (?:cart|bag|basket)|加入购物车|加入購物車|añadir al carrito|ajouter au panier|in den warenkorb/i;
/** Weaker: a cart exists, even if no "add" verb is on the homepage (hicustom.com: 购物车 + a goods catalog). */
const CART_TEXT_RE = /购物车|購物車|shopping cart|view cart|my cart|shopping bag/i;

/** Product/Offer structured data anywhere in the parsed JSON-LD blocks. */
function hasProductStructuredData(structuredData: unknown[]): boolean {
  let json = '';
  try {
    json = JSON.stringify(structuredData ?? []);
  } catch {
    return false;
  }
  // "@type":"Product" or "@type":["Product", …] — a Product node, not the word in a description.
  return /"@type"\s*:\s*(?:\[[^\]]*)?"Product"/.test(json);
}

export function detectStorefront(input: {
  html: string;
  links: { href: string }[];
  structuredData?: unknown[];
  /** og:type product / product:price:amount was present on the page. */
  hasOgProduct?: boolean;
}): StorefrontDetection {
  const signals: string[] = [];
  const html = input.html || '';

  let platform: string | null = null;
  for (const [name, re] of PLATFORM_MARKERS) {
    if (re.test(html)) {
      platform = name;
      signals.push(`platform:${name}`);
      break;
    }
  }

  let productPaths = 0;
  let collectionPaths = 0;
  let cartPaths = 0;
  const seen = new Set<string>();
  for (const l of input.links ?? []) {
    let path: string;
    try {
      path = new URL(l.href).pathname;
    } catch {
      continue;
    }
    const key = path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (PRODUCT_PATH_RE.test(path)) productPaths++;
    else if (COLLECTION_PATH_RE.test(path)) collectionPaths++;
    if (CART_PATH_RE.test(path)) cartPaths++;
  }
  if (productPaths) signals.push(`product_links:${productPaths}`);
  if (collectionPaths) signals.push(`collection_links:${collectionPaths}`);
  if (cartPaths) signals.push('cart_link');

  const addToCart = ADD_TO_CART_RE.test(html);
  if (addToCart) signals.push('add_to_cart_text');
  const cartText = addToCart || CART_TEXT_RE.test(html);
  if (cartText && !addToCart) signals.push('cart_text');

  const structured = hasProductStructuredData(input.structuredData ?? []);
  if (structured) signals.push('product_jsonld');
  if (input.hasOgProduct) signals.push('og_product');

  // A platform signature or machine-readable product data is conclusive on its own. Otherwise
  // require two independent kinds of evidence, so a blog with one "/shop" link is not a store:
  // a catalog/collection path AND some cart evidence, or several product links.
  const heuristic =
    (productPaths >= 2 && (cartPaths > 0 || cartText || collectionPaths > 0)) ||
    (collectionPaths >= 1 && (cartPaths > 0 || cartText)) ||
    (productPaths + collectionPaths >= 4 && (cartPaths > 0 || cartText)) ||
    productPaths >= 6;

  const detected = platform !== null || structured || !!input.hasOgProduct || heuristic;
  return { detected, platform, signals };
}

/** Human label for a platform id (summary copy). Unknown ids fall back to the id itself. */
export function storefrontPlatformLabel(platform: string | null | undefined): string | null {
  if (!platform) return null;
  const LABEL: Record<string, string> = {
    shopify: 'Shopify',
    shoptop: 'Shoptop',
    shoplazza: 'Shoplazza',
    shopline: 'Shopline',
    woocommerce: 'WooCommerce',
    bigcommerce: 'BigCommerce',
    squarespace_commerce: 'Squarespace',
    wix_stores: 'Wix Stores',
    magento: 'Magento',
    prestashop: 'PrestaShop',
    ecwid: 'Ecwid',
    ueeshop: 'Ueeshop',
  };
  return LABEL[platform] ?? platform;
}
