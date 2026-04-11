import { httpRequest } from '../utils/http.js';
import { extractShopeeProductCards, extractJsonLd } from '../utils/html.js';
import { normalizeProduct } from '../models/product.js';
import { writeJson } from '../utils/writer.js';
import { info, warn } from '../utils/logger.js';

const SHOPEE_BASE = 'https://shopee.co.id';
const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const ENRICHMENT_CONCURRENCY = 10;

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

// --- Review count enrichment ---

async function fetchReviewCount(url, options = {}) {
  const html = await httpRequest(url, {
    headers: {
      'User-Agent': GOOGLEBOT_UA,
      'Accept': 'text/html',
    },
    timeout: options.timeout,
    maxAttempts: options.maxAttempts,
    label: `Shopee detail ${url.split('-i.').pop() || url}`,
    responseType: 'text',
  });

  const blocks = extractJsonLd(html);
  const product = blocks.find((b) => b['@type'] === 'Product');
  if (!product?.aggregateRating?.ratingCount) return null;
  return Number(product.aggregateRating.ratingCount);
}

async function enrichWithReviewCounts(products, options = {}) {
  let enrichedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < products.length; i += ENRICHMENT_CONCURRENCY) {
    const batch = products.slice(i, i + ENRICHMENT_CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map((product) => {
        if (!product.url) return Promise.resolve(null);
        return fetchReviewCount(product.url, options);
      })
    );

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value != null) {
        products[i + idx].review_count = result.value;
        enrichedCount++;
      } else {
        warn(`Shopee review enrichment failed for ${batch[idx]?.url || 'unknown'}`);
        failedCount++;
      }
    });
  }

  info(`Shopee review enrichment: ${enrichedCount} enriched, ${failedCount} failed/skipped`);
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
    const productCards = extractShopeeProductCards(html);

    info(`Shopee search page ${pageNum}: found ${productCards.length} products`);

    if (productCards.length === 0) {
      warn(`Shopee search page ${pageNum}: no products found, stopping pagination`);
      break;
    }

    if (debug) {
      rawResponses.push({ page: pageNum, products: productCards });
      // Save raw HTML separately for debugging
      const htmlPath = `output/debug_shopee_page${pageNum}_raw.html`;
      const { writeFile } = await import('node:fs/promises');
      await writeFile(htmlPath, html, 'utf-8');
      info(`Saved raw HTML to ${htmlPath}`);
    }

    const products = productCards.map((card) => normalizeProduct({
      platform: 'shopee',
      query,
      page: pageNum,
      name: card.name,
      url: card.url,
      price: card.price,
      rating: card.rating,
      review_count: null,
      sold_count: null,
    }));

    allProducts.push(...products);
  }

  if (allProducts.length === 0) {
    warn('Shopee crawl: no products found');
    return [];
  }

  // Enrich with review counts from detail pages
  info(`Shopee enriching ${allProducts.length} products with review counts...`);
  await enrichWithReviewCounts(allProducts, { timeout, maxAttempts });

  if (debug) {
    const debugPath = `output/debug_shopee_${query.replace(/\s+/g, '_')}.json`;
    await writeJson(debugPath, rawResponses);
  }

  info(`Shopee crawl completed: total_products=${allProducts.length}`);
  return allProducts;
}
