import { warn, error as logError } from './logger.js';
import { DEFAULT_RETRIES, DEFAULT_RETRY_DELAY } from '../config/constants.js';

/**
 * Retries an async function with simple backoff.
 * @param {Function} fn - async function to retry
 * @param {object} options
 * @param {number} options.maxAttempts - max retry attempts
 * @param {number} options.delay - base delay in ms (doubles each retry)
 * @param {string} options.label - label for log messages
 * @returns {Promise<*>}
 */
export async function withRetry(fn, options = {}) {
  const {
    maxAttempts = DEFAULT_RETRIES,
    delay = DEFAULT_RETRY_DELAY,
    label = 'request',
  } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) {
        logError(`${label} failed after ${maxAttempts} attempts: ${err.message}`);
        throw err;
      }
      const waitTime = delay * Math.pow(2, attempt - 1);
      warn(`${label} failed (attempt ${attempt}/${maxAttempts}), retrying in ${waitTime}ms: ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
}
