import { httpRequest } from '../utils/http.js';
import { normalizeProduct } from '../models/product.js';
import { writeJson } from '../utils/writer.js';
import { info, warn } from '../utils/logger.js';

function parseNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function extractSoldCount(labelGroups) {
  if (!Array.isArray(labelGroups)) return null;
  const label = labelGroups.find((g) => g.position === 'ri_product_credibility');
  return label?.title || null;
}

const SEARCH_URL = 'https://gql.tokopedia.com/graphql/SearchProductV5Query';
const RATING_URL = 'https://gql.tokopedia.com/graphql/productRatingAndTopics';
const ROWS_PER_PAGE = 60;
const ENRICHMENT_CONCURRENCY = 5;
const GQL_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'bd-device-id': '7625897952422413841',
  'bd-web-id': '7625897952422413841',
};

// --- Search ---

function buildSearchParams(query, page, paginationParams = '') {
  const start = (page - 1) * ROWS_PER_PAGE;
  const uniqueId = [...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  let params = `device=desktop&enter_method=normal_search&l_name=sre&navsource=&ob=23&page=${page}&q=${encodeURIComponent(query)}&related=true&rows=${ROWS_PER_PAGE}&safe_search=false&sc=&scheme=https&shipping=&show_adult=false&source=search&srp_component_id=02.01.00.00&srp_page_id=&srp_page_title=&st=product&start=${start}&topads_bucket=true&unique_id=${uniqueId}&user_addressId=&user_cityId=176&user_districtId=2274&user_id=&user_lat=&user_long=&user_postCode=&user_warehouseId=&variants=&warehouses=`;

  // Page 2+ needs pagination params from previous response
  if (paginationParams) {
    params = `${paginationParams}&${params}`;
  }

  return params;
}

const SEARCH_QUERY = `query SearchProductV5Query($params: String!) {
  searchProductV5(params: $params) {
    header {
      additionalParams
    }
    data {
      products {
        id
        name
        price {
          text
          number
        }
        rating
        url
        labelGroups {
          position
          title
        }
        shop {
          name
          city
        }
      }
    }
  }
}`;

function buildSearchPayload(params) {
  return [
    {
      operationName: 'SearchProductV5Query',
      variables: { params },
      query: SEARCH_QUERY,
    },
  ];
}

async function fetchSearchPage(query, page, paginationParams, options = {}) {
  const params = buildSearchParams(query, page, paginationParams);
  info(`Tokopedia search params: ${params}`);
  const payload = buildSearchPayload(params);
  const data = await httpRequest(SEARCH_URL, {
    method: 'POST',
    headers: GQL_HEADERS,
    body: payload,
    timeout: options.timeout,
    maxAttempts: options.maxAttempts,
    label: `Tokopedia search page ${page}`,
  });

  return data;
}

function extractPaginationParams(response) {
  const root = Array.isArray(response) ? response[0] : response;
  const additionalParams = root?.data?.searchProductV5?.header?.additionalParams;
  if (!additionalParams) return '';
  return additionalParams;
}

function extractListingProducts(response, query, page) {
  // Response is an array (GraphQL batch), take the first item
  const root = Array.isArray(response) ? response[0] : response;
  const products = root?.data?.searchProductV5?.data?.products;

  if (!Array.isArray(products)) {
    warn(`Tokopedia page ${page}: unexpected response structure, no products found`);
    return [];
  }

  return products.map((item) => ({
    platform: 'tokopedia',
    query,
    page,
    product_id: item.id || null,
    name: item.name,
    url: item.url || null,
    price: item.price?.number ?? item.price?.text ?? null,
    rating: parseNumber(item.rating),
    review_count: null, // will be enriched
    sold_count: extractSoldCount(item.labelGroups),
  }));
}

// --- Rating enrichment ---

const RATING_QUERY = `query productRatingAndTopics($productID: String!) {
  productrevGetProductRatingAndTopics(productID: $productID) {
    rating {
      ratingScore
      totalRating
    }
  }
}`;

function buildRatingPayload(productId) {
  return [
    {
      operationName: 'productRatingAndTopics',
      variables: { productID: String(productId) },
      query: RATING_QUERY,
    },
  ];
}

async function fetchProductRating(productId, options = {}) {
  const payload = buildRatingPayload(productId);
  const data = await httpRequest(RATING_URL, {
    method: 'POST',
    headers: GQL_HEADERS,
    body: payload,
    timeout: options.timeout,
    maxAttempts: options.maxAttempts,
    label: `Tokopedia rating productID=${productId}`,
  });

  const root = Array.isArray(data) ? data[0] : data;
  const ratingData = root?.data?.productrevGetProductRatingAndTopics?.rating;

  if (!ratingData) return null;

  return {
    rating: parseNumber(ratingData.ratingScore),
    review_count: parseNumber(ratingData.totalRating),
  };
}

async function enrichProductsWithRatings(products, options = {}) {
  const concurrency = ENRICHMENT_CONCURRENCY;
  let enrichedCount = 0;
  let failedCount = 0;

  // Process in batches for controlled concurrency
  for (let i = 0; i < products.length; i += concurrency) {
    const batch = products.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batch.map(async (product) => {
        if (!product.product_id) return null;
        return fetchProductRating(product.product_id, options);
      })
    );

    results.forEach((result, idx) => {
      const product = products[i + idx];
      if (result.status === 'fulfilled' && result.value) {
        if (result.value.rating !== null) product.rating = result.value.rating;
        if (result.value.review_count !== null) product.review_count = result.value.review_count;
        enrichedCount++;
      } else {
        warn(`Tokopedia rating enrichment failed for productID=${product.product_id}`);
        failedCount++;
      }
    });
  }

  info(`Tokopedia rating enrichment: ${enrichedCount} enriched, ${failedCount} failed/skipped`);
  return products;
}

// --- Main crawl function ---

export async function crawlTokopedia({ query, pages, timeout, maxAttempts, debug }) {
  info(`Tokopedia crawl started: query="${query}" pages=${pages}`);

  const allProducts = [];
  const rawResponses = [];
  let paginationParams = '';

  for (let page = 1; page <= pages; page++) {
    info(`Tokopedia fetching page ${page}/${pages}`);

    const response = await fetchSearchPage(query, page, paginationParams, { timeout, maxAttempts });
    paginationParams = extractPaginationParams(response);
    if (debug) rawResponses.push({ page, response });
    const products = extractListingProducts(response, query, page);

    info(`Tokopedia page ${page} fetched: ${products.length} products`);

    if (products.length === 0) {
      warn(`Tokopedia page ${page}: empty results, stopping pagination`);
      break;
    }

    allProducts.push(...products);
  }

  if (allProducts.length === 0) {
    warn('Tokopedia crawl: no products found');
    return [];
  }

  // Enrich with ratings
  info(`Tokopedia enriching ${allProducts.length} products with ratings...`);
  await enrichProductsWithRatings(allProducts, { timeout, maxAttempts });

  // Normalize into final schema (drop internal product_id)
  const normalized = allProducts.map((p) => normalizeProduct(p));

  if (debug) {
    const debugPath = `output/debug_tokopedia_${query.replace(/\s+/g, '_')}.json`;
    await writeJson(debugPath, rawResponses);
  }

  info(`Tokopedia crawl completed: total_products=${normalized.length}`);
  return normalized;
}
