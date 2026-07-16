import { Request, Response, NextFunction } from "express";

// ─── In-memory store ─────────────────────────────────────────────
// Map<key, { count, resetAt }>  — key = ip[:route-group]
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Prune expired entries every 5 minutes so the map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60_000).unref();

// ─── Factory ─────────────────────────────────────────────────────

export interface RateLimitOptions {
  /** Time window in milliseconds (default: 60 000 = 1 min) */
  windowMs?: number;
  /** Maximum requests allowed per window (default: 120) */
  max?: number;
  /** Key suffix to create isolated buckets per route group */
  keyPrefix?: string;
  /** Response message on 429 */
  message?: string;
}

export function createRateLimiter(options: RateLimitOptions = {}) {
  const {
    windowMs = 60_000,
    max = 120,
    keyPrefix = "default",
    message = "Muitas requisições. Tente novamente mais tarde.",
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    let entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
      store.set(key, entry);
    } else {
      entry.count++;
    }

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
