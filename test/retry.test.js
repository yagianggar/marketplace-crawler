import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from '../src/utils/retry.js';

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const result = await withRetry(() => Promise.resolve('ok'), {
      maxAttempts: 3,
      delay: 10,
      label: 'test',
    });

    assert.strictEqual(result, 'ok');
  });

  it('retries and succeeds on second attempt', async () => {
    let attempt = 0;
    const result = await withRetry(() => {
      attempt++;
      if (attempt < 2) throw new Error('fail');
      return Promise.resolve('recovered');
    }, {
      maxAttempts: 3,
      delay: 10,
      label: 'test',
    });

    assert.strictEqual(result, 'recovered');
    assert.strictEqual(attempt, 2);
  });

  it('throws after all attempts exhausted', async () => {
    let attempt = 0;
    await assert.rejects(
      () => withRetry(() => {
        attempt++;
        throw new Error('always fails');
      }, {
        maxAttempts: 3,
        delay: 10,
        label: 'test',
      }),
      { message: 'always fails' }
    );

    assert.strictEqual(attempt, 3);
  });

  it('respects maxAttempts setting', async () => {
    let attempt = 0;
    await assert.rejects(
      () => withRetry(() => {
        attempt++;
        throw new Error('fail');
      }, {
        maxAttempts: 2,
        delay: 10,
        label: 'test',
      })
    );

    assert.strictEqual(attempt, 2);
  });
});
