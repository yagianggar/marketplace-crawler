import { program } from 'commander';
import { crawlTokopedia } from './crawlers/tokopedia.js';
import { crawlShopee } from './crawlers/shopee.js';
import { writeJson } from './utils/writer.js';
import { info, error as logError } from './utils/logger.js';
import { DEFAULT_PAGES, DEFAULT_TIMEOUT, DEFAULT_RETRIES } from './config/constants.js';

program
  .requiredOption('--platform <platform>', 'Platform to crawl (tokopedia, shopee)')
  .requiredOption('--query <query>', 'Search keyword')
  .option('--pages <number>', 'Number of pages to crawl', String(DEFAULT_PAGES))
  .option('--output <path>', 'Output JSON file path')
  .option('--timeout <ms>', 'Request timeout in ms', String(DEFAULT_TIMEOUT))
  .option('--retries <number>', 'Max retry attempts', String(DEFAULT_RETRIES))
  .option('--debug', 'Save raw API responses to a debug JSON file')
  .parse();

const opts = program.opts();

// Validate
const platform = opts.platform.toLowerCase();
const validPlatforms = ['tokopedia', 'shopee'];

if (!validPlatforms.includes(platform)) {
  logError(`Invalid platform "${platform}". Must be one of: ${validPlatforms.join(', ')}`);
  process.exit(1);
}

const pages = parseInt(opts.pages, 10);
if (!Number.isInteger(pages) || pages < 1) {
  logError('--pages must be a positive integer');
  process.exit(1);
}

const query = opts.query.trim();
if (!query) {
  logError('--query must not be empty');
  process.exit(1);
}

const timeout = parseInt(opts.timeout, 10);
const maxAttempts = parseInt(opts.retries, 10);
const debug = opts.debug || false;
const output = opts.output || `output/${platform}_${query.replace(/\s+/g, '_')}.json`;

// Crawler registry
const crawlers = {
  tokopedia: crawlTokopedia,
  shopee: crawlShopee,
};

async function main() {
  info(`Starting crawl: platform=${platform} query="${query}" pages=${pages}`);

  const crawler = crawlers[platform];
  if (!crawler) {
    logError(`Crawler for "${platform}" is not yet implemented`);
    process.exit(1);
  }

  try {
    const products = await crawler({ query, pages, timeout, maxAttempts, debug });
    await writeJson(output, products);
    info(`Crawl finished: ${products.length} products saved to ${output}`);
  } catch (err) {
    logError(`Crawl failed: ${err.message}`);
    process.exit(1);
  }
}

main();
