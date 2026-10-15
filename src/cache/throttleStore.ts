import { nodeCacheIncrementAndCheck } from "./nodeCacheThrottle";

/**
 * Unified throttle interface
 *
 * Middleware uses this to check limits against NodeCache.
 */
export const incrementAndCheck = async (
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<number | null> => {
  return nodeCacheIncrementAndCheck(key, limit, windowSeconds);
};
