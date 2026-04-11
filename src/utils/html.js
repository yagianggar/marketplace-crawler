import * as cheerio from 'cheerio';

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
 * Extracts product data from Shopee search page HTML DOM using Cheerio.
 * @param {string} html - raw HTML from Shopee search page
 * @returns {object[]} array of { name, url, price, rating }
 */
export function extractShopeeProductCards(html) {
  const $ = cheerio.load(html);
  const products = [];

  $('li.shopee-search-item-result__item').each((i, el) => {
    const card = $(el);

    // Name from aria-label="Product card: ..."
    const ariaLabel = card.find('[role="group"][aria-label^="Product card:"]').attr('aria-label');
    const name = ariaLabel ? ariaLabel.replace('Product card: ', '') : null;

    // URL from href containing -i.shopid.itemid
    const link = card.find('a[href*="-i."]').attr('href');
    const url = link ? `https://shopee.co.id${link.split('?')[0]}` : null;

    // Price from the price display span
    const priceText = card.find('.text-base\\/5.font-medium').first().text().trim();
    const price = priceText ? parseShopeePrice(priceText) : null;

    // Rating from the rating value next to star icon
    const ratingEl = card.find('img[alt="rating-star-full"]').parent().find('div');
    const ratingText = ratingEl.text().trim();
    const rating = ratingText ? Number(ratingText) : null;

    if (name) {
      products.push({ name, url, price, rating: Number.isNaN(rating) ? null : rating });
    }
  });

  return products;
}

function parseShopeePrice(priceText) {
  if (!priceText) return null;
  const cleaned = priceText.replace(/[^0-9]/g, '');
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}
