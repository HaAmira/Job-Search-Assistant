import { describe, expect, it } from 'vitest';
import { InMemoryRateLimitStore } from '../src/middleware/rateLimiter';

describe('InMemoryRateLimitStore', () => {
  it('expires request records after their window', () => {
    const store = new InMemoryRateLimitStore(10, 1);
    expect(store.consume('client', 100, 1, 50).allowed).toBe(true);
    expect(store.consume('client', 101, 1, 50).allowed).toBe(false);
    expect(store.consume('client', 151, 1, 50).allowed).toBe(true);
  });

  it('bounds the number of retained client records', () => {
    const store = new InMemoryRateLimitStore(2, 1);
    store.consume('one', 100, 10, 1000);
    store.consume('two', 100, 10, 1000);
    store.consume('three', 100, 10, 1000);
    expect(store.size).toBe(2);
  });
});
