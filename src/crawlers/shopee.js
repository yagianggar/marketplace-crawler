import { httpRequest } from '../utils/http.js';
import { extractJsonLd } from '../utils/html.js';
import { normalizeProduct } from '../models/product.js';
import { writeJson } from '../utils/writer.js';
import { info, warn } from '../utils/logger.js';

const SHOPEE_BASE = 'https://shopee.co.id';
const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const DETAIL_CONCURRENCY = 3;

// --- Search page ---

function buildSearchUrl(query, page) {
  const params = new URLSearchParams({ keyword: query, page: String(page) });
  return `${SHOPEE_BASE}/search?${params}`;
}

async function fetchSearchPage(query, page, options = {}) {
  const url = buildSearchUrl(query, page);
  info(`Shopee search URL: ${url}`);

  const html = await httpRequest(url, {
    headers: {
      'User-Agent': GOOGLEBOT_UA,
      'Accept': 'text/html',
    },
    timeout: options.timeout,
    maxAttempts: options.maxAttempts,
    label: `Shopee search page ${page}`,
    responseType: 'text',
  });

  return html;
}

function extractProductUrls(html) {
  const blocks = extractJsonLd(html);
  const itemList = blocks.find((b) => b['@type'] === 'ItemList');
  if (!itemList || !Array.isArray(itemList.itemListElement)) return [];

  return itemList.itemListElement
    .map((item) => item.url)
    .filter(Boolean);
}

// --- Product detail page ---

async function fetchProductDetail(url, options = {}) {
  const html = await httpRequest(url, {
    headers: {
      'User-Agent': GOOGLEBOT_UA,
      'Accept': 'text/html',
    },
    timeout: options.timeout,
    maxAttempts: options.maxAttempts,
    label: `Shopee product ${url.split('-i.').pop() || url}`,
    responseType: 'text',
  });

  return parseProductDetail(html, url);
}

function parseProductDetail(html, url) {
  const blocks = extractJsonLd(html);
  const product = blocks.find((b) => b['@type'] === 'Product');
  if (!product) return null;

  const offers = product.offers;
  // Offer has "price", AggregateOffer has "lowPrice"/"highPrice"
  const rawPrice = offers?.price ?? offers?.lowPrice ?? null;
  const rating = product.aggregateRating?.ratingValue;
  const reviewCount = product.aggregateRating?.ratingCount;

  return {
    name: product.name || null,
    url: product.url || url,
    price: rawPrice != null ? Number(rawPrice) : null,
    rating: rating != null ? Number(rating) : null,
    review_count: reviewCount != null ? Number(reviewCount) : null,
  };
}

// --- Fetch details with concurrency ---

async function fetchProductDetails(urls, options = {}) {
  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < urls.length; i += DETAIL_CONCURRENCY) {
    const batch = urls.slice(i, i + DETAIL_CONCURRENCY);

    const settled = await Promise.allSettled(
      batch.map((url) => fetchProductDetail(url, options))
    );

    settled.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
        successCount++;
      } else {
        warn(`Shopee product detail failed for ${batch[idx]}`);
        failCount++;
      }
    });
  }

  info(`Shopee product details: ${successCount} fetched, ${failCount} failed`);
  return results;
}

// --- Main crawl function ---

export async function crawlShopee({ query, pages, timeout, maxAttempts, debug }) {
  info(`Shopee crawl started: query="${query}" pages=${pages}`);

  const allProducts = [];
  const rawResponses = [];

  for (let page = 0; page < pages; page++) {
    const pageNum = page + 1;
    info(`Shopee fetching search page ${pageNum}/${pages}`);

    const html = await fetchSearchPage(query, page, { timeout, maxAttempts });
    const productUrls = extractProductUrls(html);

    info(`Shopee search page ${pageNum}: found ${productUrls.length} product URLs`);

    if (productUrls.length === 0) {
      warn(`Shopee search page ${pageNum}: no products found, stopping pagination`);
      break;
    }

    // Fetch detail for each product
    info(`Shopee fetching ${productUrls.length} product details for page ${pageNum}...`);
    const details = await fetchProductDetails(productUrls, { timeout, maxAttempts });

    if (debug) rawResponses.push({ page: pageNum, productUrls, details });

    const products = details.map((detail) => normalizeProduct({
      platform: 'shopee',
      query,
      page: pageNum,
      name: detail.name,
      url: detail.url,
      price: detail.price,
      rating: detail.rating,
      review_count: detail.review_count,
      sold_count: null,
    }));

    allProducts.push(...products);
  }

  if (allProducts.length === 0) {
    warn('Shopee crawl: no products found');
    return [];
  }

  if (debug) {
    const debugPath = `output/debug_shopee_${query.replace(/\s+/g, '_')}.json`;
    await writeJson(debugPath, rawResponses);
  }

  info(`Shopee crawl completed: total_products=${allProducts.length}`);
  return allProducts;
}
