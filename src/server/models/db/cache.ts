// ─── In-memory TTL cache ──────────────────────────────────────────
// Used by modelWrapper to avoid redundant DB round-trips for `find()` calls.
// Short TTL (5 s) keeps data fresh while batching rapid consecutive reads.
// All write operations (create, update, delete) call cacheInvalidate(modelName).

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 5_000;

// Prune expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now > v.expiresAt) store.delete(k);
  }
}, 60_000).unref();

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    if (entry) store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function cacheSet(key: string, data: unknown, ttlMs = DEFAULT_TTL_MS): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/** Remove all cached results for a given model (call after any write). */
export function cacheInvalidate(modelName: string): void {
  const prefix = `${modelName}:`;
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

export function cacheClear(): void {
  store.clear();
}

// ─── Caching query wrapper ────────────────────────────────────────
// Wraps a Mongoose Query so that sort/skip/limit chaining is preserved
// and the final resolved value is stored in the cache.

export function createCachingQuery(modelName: string, baseQuery: any) {
  let sortArg: any = null;
  let skipArg: number | null = null;
  let limitArg: number | null = null;

  const exec = async (): Promise<any[]> => {
    const key = `${modelName}:find:${JSON.stringify({ s: sortArg, sk: skipArg, l: limitArg })}`;
    const cached = cacheGet<any[]>(key);
    if (cached) return cached;

    let q = baseQuery;
    if (sortArg !== null) q = q.sort(sortArg);
    if (skipArg !== null) q = q.skip(skipArg);
    if (limitArg !== null) q = q.limit(limitArg);

    const results: any[] = await q;
    cacheSet(key, results);
    return results;
  };

  const proxy: any = {
    sort:  (arg: any)  => { sortArg  = arg; return proxy; },
    skip:  (n: number) => { skipArg  = n;   return proxy; },
    limit: (n: number) => { limitArg = n;   return proxy; },
    then:  (res: any, rej: any) => exec().then(res, rej),
    catch: (rej: any)           => exec().catch(rej),
  };

  return proxy;
}
