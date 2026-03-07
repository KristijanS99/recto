import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TtlCache } from '../cache.js';

describe('TtlCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should fetch on first access', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const cache = new TtlCache(fetcher, 5000);

    const result = await cache.get();
    expect(result).toBe('data');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('should return cached value within TTL', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const cache = new TtlCache(fetcher, 5000);

    await cache.get();
    await cache.get();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('should refetch after TTL expires', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const cache = new TtlCache(fetcher, 5000);

    await cache.get();
    vi.advanceTimersByTime(6000);
    fetcher.mockResolvedValue('new-data');
    const result = await cache.get();

    expect(result).toBe('new-data');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('should return stale value on fetch error', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const cache = new TtlCache(fetcher, 5000);

    await cache.get();
    vi.advanceTimersByTime(6000);
    fetcher.mockRejectedValue(new Error('network error'));
    const result = await cache.get();

    expect(result).toBe('data');
  });

  it('should deduplicate concurrent fetches', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const cache = new TtlCache(fetcher, 5000);

    const [r1, r2] = await Promise.all([cache.get(), cache.get()]);
    expect(r1).toBe('data');
    expect(r2).toBe('data');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('should refetch after invalidation', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const cache = new TtlCache(fetcher, 5000);

    await cache.get();
    cache.invalidate();
    fetcher.mockResolvedValue('fresh');
    const result = await cache.get();

    expect(result).toBe('fresh');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
