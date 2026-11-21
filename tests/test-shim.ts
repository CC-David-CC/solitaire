import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

export {describe, it};

export function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      assert.strictEqual(actual, expected);
    },
    toEqual(expected: unknown) {
      assert.deepStrictEqual(actual, expected);
    },
    toHaveLength(expected: number) {
      assert.strictEqual((actual as unknown[]).length, expected);
    },
    toBeNull() {
      assert.strictEqual(actual, null);
    },
    not: {
      toBeNull() {
        assert.notStrictEqual(actual, null);
      },
    },
    toBeGreaterThanOrEqual(expected: number) {
      assert.ok((actual as number) >= expected);
    },
    toBeLessThanOrEqual(expected: number) {
      assert.ok((actual as number) <= expected);
    },
    toBeGreaterThan(expected: number) {
      assert.ok((actual as number) > expected);
    },
    toThrow(matcher?: RegExp | string) {
      if (typeof actual !== 'function') throw new Error('Expected function to throw');
      assert.throws(actual as () => void, matcher as RegExp);
    },
  };
}
