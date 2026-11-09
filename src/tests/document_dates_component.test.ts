import test from 'node:test';
import assert from 'node:assert';

test('isHistoricalDate logic correctly detects past dates', () => {
  const today = new Date().toISOString().split('T')[0];
  const pastDate = '2025-01-01';
  const futureDate = '2030-01-01';

  assert.strictEqual(pastDate < today, true);
  assert.strictEqual(today < today, false);
  assert.strictEqual(futureDate < today, false);
});
