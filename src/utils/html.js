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
