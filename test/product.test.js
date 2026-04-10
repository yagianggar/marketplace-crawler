import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProduct } from '../src/models/product.js';

describe('normalizeProduct', () => {
  it('normalizes a complete product', () => {
    const result = normalizeProduct({
      platform: 'tokopedia',
      query: 'mouse',
      page: 1,
      name: 'Logitech Mouse',
      url: 'https://tokopedia.com/product/123',
      price: 125000,
      rating: 4.9,
      review_count: 230,
      sold_count: '10rb+ terjual',
    });

    assert.deepStrictEqual(result, {
      platform: 'tokopedia',
      query: 'mouse',
      page: 1,
      name: 'Logitech Mouse',
      url: 'https://tokopedia.com/product/123',
      price: 125000,
      rating: 4.9,
      review_count: 230,
      sold_count: '10rb+ terjual',
    });
  });

  it('parses price string like "Rp125.000" to number', () => {
    const result = normalizeProduct({
      platform: 'shopee',
      query: 'keyboard',
      page: 1,
      name: 'Keyboard',
      price: 'Rp125.000',
      rating: null,
      review_count: null,
    });

    assert.strictEqual(result.price, 125000);
  });

  it('keeps price as number when already a number', () => {
    const result = normalizeProduct({
      platform: 'tokopedia',
      query: 'mouse',
      page: 1,
      name: 'Mouse',
      price: 99000,
    });

    assert.strictEqual(result.price, 99000);
  });

  it('sets null for missing optional fields', () => {
    const result = normalizeProduct({
      platform: 'tokopedia',
      query: 'mouse',
      page: 1,
      name: 'Mouse',
      price: 50000,
    });

    assert.strictEqual(result.rating, null);
    assert.strictEqual(result.review_count, null);
    assert.strictEqual(result.url, null);
    assert.strictEqual(result.sold_count, null);
  });

  it('sets name to "Unknown" when missing', () => {
    const result = normalizeProduct({
      platform: 'tokopedia',
      query: 'mouse',
      page: 1,
      name: '',
      price: 50000,
    });

    assert.strictEqual(result.name, 'Unknown');
  });

  it('returns null price when price is null', () => {
    const result = normalizeProduct({
      platform: 'shopee',
      query: 'mouse',
      page: 1,
      name: 'Mouse',
      price: null,
    });

    assert.strictEqual(result.price, null);
  });

  it('rejects non-numeric rating', () => {
    const result = normalizeProduct({
      platform: 'tokopedia',
      query: 'mouse',
      page: 1,
      name: 'Mouse',
      price: 50000,
      rating: 'good',
      review_count: 'many',
    });

    assert.strictEqual(result.rating, null);
    assert.strictEqual(result.review_count, null);
  });
});
