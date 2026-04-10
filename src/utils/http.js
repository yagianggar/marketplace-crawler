import { withRetry } from './retry.js';
import { DEFAULT_TIMEOUT, getRandomUserAgent } from '../config/constants.js';

/**
 * Makes an HTTP request with timeout, headers, and retry.
 * @param {string} url
 * @param {object} options
 * @param {string} options.method - HTTP method (default GET)
 * @param {object} options.headers - request headers
 * @param {*} options.body - request body (will be JSON.stringified if object)
 * @param {number} options.timeout - timeout in ms
 * @param {number} options.maxAttempts - retry attempts
 * @param {string} options.label - label for retry logging
 * @param {string} options.responseType - 'json' (default) or 'text'
 * @returns {Promise<object|string>} parsed JSON response or raw text
 */
export async function httpRequest(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = DEFAULT_TIMEOUT,
    maxAttempts,
    label = url,
    responseType = 'json',
  } = options;

  const finalHeaders = {
    'User-Agent': getRandomUserAgent(),
    ...headers,
  };

  const fetchFn = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const fetchOptions = {
        method,
        headers: finalHeaders,
        signal: controller.signal,
      };

      if (body) {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return responseType === 'text' ? await response.text() : await response.json();
    } finally {
      clearTimeout(timer);
    }
  };

  return withRetry(fetchFn, { maxAttempts, label });
}
