import { Request, Response, NextFunction } from "express";

// ─── Store abstraction ────────────────────────────────────────────
// Enables swapping the backing store (memory ↔ Redis) without touching
// the middleware factory. Implement `RateLimitStore` to add new backends.

export interface RateLimitEntry {
  count: number;
  resetAt: number; // Unix ms
}

export interface RateLimitStore {
  /** Returns the current entry for a key, or null if not found / expired. */
  get(key: string): RateLimitEntry | null | Promise<RateLimitEntry | null>;
  /** Upserts (or creates) an entry. */
  set(key: string, entry: RateLimitEntry): void | Promise<void>;
  /** Removes a single key. */
  delete(key: string): void | Promise<void>;
  /** Called once on startup — use for interval setup or connection. */
  init?(): void | Promise<void>;
  /** Called on process exit — use for cleanup / connection close. */
  destroy?(): void | Promise<void>;
}

// ─── MemoryStore ─────────────────────────────────────────────────

export class MemoryStore implements RateLimitStore {
  private readonly map = new Map<string, RateLimitEntry>();
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly cleanupIntervalMs = 5 * 60_000) {}

  init(): void {
    this.interval = setInterval(() => this.prune(), this.cleanupIntervalMs);
    this.interval.unref?.();
  }

  destroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.map.clear();
  }

  get(key: string): RateLimitEntry | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.resetAt) {
      this.map.delete(key);
      return null;
    }
    return entry;
  }

  set(key: string, entry: RateLimitEntry): void {
    this.map.set(key, entry);
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  /** Remove all expired entries. Called automatically on the cleanup interval. */
  prune(): void {
    const now = Date.now();
    for (const [k, v] of this.map) {
      if (now > v.resetAt) this.map.delete(k);
    }
  }

  get size(): number {
    return this.map.size;
  }
}

// ─── RedisStore (opt-in) ──────────────────────────────────────────
// Activated when REDIS_URL is set. Requires `ioredis` to be installed:
//   npm install ioredis
//
// TTL is managed by Redis EXPIRE so no in-process cleanup is needed.
// All state is shared across multiple server instances (horizontal scale).

export class RedisStore implements RateLimitStore {
  private client: any = null;

  async init(): Promise<void> {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is not set");
    try {
      const { default: Redis } = await import("ioredis" as any);
      this.client = new Redis(url, {
        lazyConnect: true,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
      });
      await this.client.connect();
      console.log("[RateLimit] Conectado ao Redis:", url.replace(/:\/\/.*@/, "://***@"));
    } catch (err: any) {
      console.error("[RateLimit] Falha ao conectar ao Redis:", err.message);
      throw err;
    }
  }

  async destroy(): Promise<void> {
    await this.client?.quit();
    this.client = null;
  }

  async get(key: string): Promise<RateLimitEntry | null> {
    if (!this.client) return null;
    const raw = await this.client.get(`rl:${key}`);
    if (!raw) return null;
    try { return JSON.parse(raw) as RateLimitEntry; } catch { return null; }
  }

  async set(key: string, entry: RateLimitEntry): Promise<void> {
    if (!this.client) return;
    const ttlSeconds = Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000));
    await this.client.set(`rl:${key}`, JSON.stringify(entry), "EX", ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.client?.del(`rl:${key}`);
  }
}

// ─── Store factory ────────────────────────────────────────────────

let _defaultStore: RateLimitStore | null = null;

async function getOrCreateStore(): Promise<RateLimitStore> {
  if (_defaultStore) return _defaultStore;
  if (process.env.REDIS_URL) {
    const rs = new RedisStore();
    try {
      await rs.init();
      _defaultStore = rs;
      console.log("[RateLimit] Usando RedisStore para rate limiting.");
      return rs;
    } catch {
      console.warn("[RateLimit] RedisStore falhou — usando MemoryStore como fallback.");
    }
  }
  const ms = new MemoryStore();
  ms.init();
  _defaultStore = ms;
  return ms;
}

// Initialize the default store at module load (non-blocking)
getOrCreateStore().catch(() => {});

// Graceful shutdown
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.once(sig, () => { _defaultStore?.destroy?.(); });
}

// ─── Middleware factory ───────────────────────────────────────────

export interface RateLimitOptions {
  /** Time window in milliseconds (default: 60 000 = 1 min) */
  windowMs?: number;
  /** Maximum requests allowed per window (default: 120) */
  max?: number;
  /** Key prefix to create isolated buckets per route group */
  keyPrefix?: string;
  /** Response message sent on 429 */
  message?: string;
  /** Custom store — overrides the module-level store for this limiter */
  store?: RateLimitStore;
}

export function createRateLimiter(options: RateLimitOptions = {}) {
  const {
    windowMs = 60_000,
    max = 120,
    keyPrefix = "default",
    message = "Muitas requisições. Tente novamente mais tarde.",
  } = options;

  // Each limiter gets its own in-memory fallback until the async store resolves
  const localStore = new MemoryStore();
  localStore.init();

  return async (req: Request, res: Response, next: NextFunction) => {
    const store = options.store ?? (await getOrCreateStore().catch(() => localStore));

    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    let entry = (await store.get(key)) ?? null;

    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
    } else {
      entry.count++;
    }

    await store.set(key, entry);

    const remaining = Math.max(0, max - entry.count);
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({ error: message });
    }

    next();
  };
}

// ─── Pre-built limiters ───────────────────────────────────────────

/** General API: 120 req/min */
export const defaultLimiter = createRateLimiter({
  keyPrefix: "api",
  windowMs: 60_000,
  max: 120,
});

/** Read-heavy list endpoints: 60 req/min */
export const listLimiter = createRateLimiter({
  keyPrefix: "list",
  windowMs: 60_000,
  max: 60,
});

/** Write/mutation endpoints: 40 req/min */
export const writeLimiter = createRateLimiter({
  keyPrefix: "write",
  windowMs: 60_000,
  max: 40,
});

/** Payment endpoints: 10 req/min — strict to prevent abuse */
export const paymentLimiter = createRateLimiter({
  keyPrefix: "payment",
  windowMs: 60_000,
  max: 10,
  message: "Limite de requisições de pagamento atingido. Tente em instantes.",
});

/** Receipt / AI verification: 5 req/min — expensive upstream call */
export const aiLimiter = createRateLimiter({
  keyPrefix: "ai",
  windowMs: 60_000,
  max: 5,
  message: "Limite de verificação de comprovantes atingido. Aguarde um momento.",
});
