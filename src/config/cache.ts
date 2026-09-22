import NodeCache from "node-cache";

/**
 * In-memory cache used for throttling.
 * - Lives in RAM
 * - Resets on app restart
 * - Per-instance only (NOT shared across servers)
 */
const cache = new NodeCache({
  stdTTL: 0,        // TTL is set manually per key
  checkperiod: 60, // Cleanup expired keys every 60s
});

export default cache;