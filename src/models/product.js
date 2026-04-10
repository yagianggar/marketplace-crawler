/**
 * Normalizes a raw product into the standard output schema.
 * @param {object} raw
 * @param {string} raw.platform
 * @param {string} raw.query
 * @param {number} raw.page
 * @param {string} raw.name
 * @param {number|string} raw.price
 * @param {number|null} raw.rating
 * @param {number|null} raw.review_count
 * @returns {object} normalized product
 */
export function normalizeProduct(raw) {
  return {
    platform: raw.platform,
    query: raw.query,
    page: raw.page,
    name: raw.name || 'Unknown',
    url: raw.url || null,
    price: normalizePrice(raw.price),
    rating: typeof raw.rating === 'number' ? raw.rating : null,
    review_count: typeof raw.review_count === 'number' ? raw.review_count : null,
    sold_count: raw.sold_count || null,
  };
}

function normalizePrice(price) {
  if (typeof price === 'number') return price;
  if (typeof price === 'string') {
    const cleaned = price.replace(/[^0-9]/g, '');
    const parsed = Number(cleaned);
    return Number.isNaN(parsed) ? price : parsed;
  }
  return null;
}
