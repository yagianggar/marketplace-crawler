import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonLd } from '../src/utils/html.js';

describe('extractJsonLd', () => {
  it('extracts a single JSON-LD block', () => {
    const html = '<html><head><script type="application/ld+json">{"@type":"Product","name":"Mouse"}</script></head></html>';
    const result = extractJsonLd(html);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]['@type'], 'Product');
    assert.strictEqual(result[0].name, 'Mouse');
  });

  it('extracts multiple JSON-LD blocks', () => {
    const html = `
      <script type="application/ld+json">{"@type":"WebSite","name":"Shopee"}</script>
      <script type="application/ld+json">{"@type":"Product","name":"Keyboard"}</script>
      <script type="application/ld+json">{"@type":"ItemList","itemListElement":[]}</script>
    `;
    const result = extractJsonLd(html);

    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0]['@type'], 'WebSite');
    assert.strictEqual(result[1]['@type'], 'Product');
    assert.strictEqual(result[2]['@type'], 'ItemList');
  });

  it('returns empty array when no JSON-LD exists', () => {
    const html = '<html><body><p>No structured data</p></body></html>';
    const result = extractJsonLd(html);

    assert.strictEqual(result.length, 0);
  });

  it('skips malformed JSON-LD blocks', () => {
    const html = `
      <script type="application/ld+json">{invalid json}</script>
      <script type="application/ld+json">{"@type":"Product","name":"Valid"}</script>
    `;
    const result = extractJsonLd(html);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'Valid');
  });
});
