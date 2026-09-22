import cache from "../config/cache";


/**
 * NodeCache-based throttling.
 * Manually calculates TTL.
 */
export const nodeCacheIncrementAndCheck = async (
  key: string,
  limit: number,
  windowSeconds: number
): Promise<number | null> => {

  // Get current count (default 0)
  const count = cache.get<number>(key) || 0;

  /**
   * FIRST request:
   * - Set counter to 1
   * - Attach TTL window
   */
  if (count === 0) {
    cache.set(key, 1, windowSeconds);
    return null;
  }

  /**
   * If next request would exceed the limit,
   * calculate how many seconds remain
   */
  if (count + 1 > limit) {
    const ttlMs = cache.getTtl(key);

    /**
     * Defensive fallback:
     * If TTL is missing, assume full window.
     * Prevents NaN or abuse.
     */
    if (!ttlMs) {
      return windowSeconds;
    }

    // Convert milliseconds → seconds remaining
    return Math.ceil((ttlMs - Date.now()) / 1000);
  }

  /**
   * Increment counter without resetting TTL
   */
  cache.set(key, count + 1);

  return null;
};
