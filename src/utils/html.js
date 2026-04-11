/**
 * Extracts JSON-LD blocks from an HTML string.
 * @param {string} html - raw HTML
 * @returns {object[]} parsed JSON-LD objects
 */
export function extractJsonLd(html) {
  const results = [];
  const pattern = /type="application\/ld\+json">(.*?)<\/script>/gs;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    try {
      results.push(JSON.parse(match[1]));
    } catch {
      // skip malformed JSON-LD
    }
  }
  return results;
}

/**
 * Extracts product data from Shopee search page HTML DOM.
 * Parses product cards rendered in <li> elements.
 * @param {string} html - raw HTML from Shopee search page
 * @returns {object[]} array of { name, url, price, rating }
 */
export function extractShopeeProductCards(html) {
  const products = [];

  // Split HTML by product card list items
  const cardPattern = /<li[^>]*shopee-search-item-result__item[^>]*>(.*?)<\/li>/gs;
  let cardMatch;

  while ((cardMatch = cardPattern.exec(html)) !== null) {
    const card = cardMatch[1];

    // Extract name from aria-label="Product card: ..."
    const nameMatch = card.match(/aria-label="Product card: ([^"]+)"/);
    const name = nameMatch ? decodeHtmlEntities(nameMatch[1]) : null;

    // Extract URL from href containing -i.shopid.itemid pattern
    const urlMatch = card.match(/href="(\/[^"]*-i\.\d+\.\d+[^"]*)"/);
    const url = urlMatch ? `https://shopee.co.id${urlMatch[1].split('?')[0]}` : null;

    // Extract price from the price span
    const priceMatch = card.match(/text-base\/5 font-medium">([^<]+)<\/span>/);
    const price = priceMatch ? parseShopeePrice(priceMatch[1]) : null;

    // Extract rating from the rating div next to rating star
    const ratingMatch = card.match(/alt="rating-star-full"[^>]*\/>\s*<div[^>]*>(\d+\.?\d*)<\/div>/);
    const rating = ratingMatch ? Number(ratingMatch[1]) : null;

    if (name) {
      products.push({ name, url, price, rating });
    }
  }

  return products;
}

function parseShopeePrice(priceText) {
  if (!priceText) return null;
  const cleaned = priceText.replace(/[^0-9]/g, '');
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}
