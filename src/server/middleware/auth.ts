import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

/**
 * Optional Bearer-token authentication middleware.
 *
 * Enforcement is **opt-in**: if the `API_KEY` environment variable is not set
 * the middleware is a no-op, preserving the existing zero-config personal/dev
 * setup (Termux / Replit preview).
 *
 * To enable:
 *   1. Set `API_KEY=<your-secret>` in Replit Secrets (or .env.local).
 *   2. Send `Authorization: Bearer <your-secret>` in every frontend API call.
 *
 * Uses `crypto.timingSafeEqual` to prevent timing-based token enumeration.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = process.env.API_KEY;

  // Auth not configured — allow all requests (personal / dev mode)
  if (!apiKey) {
    return next();
  }

  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Não autorizado. Token Bearer ausente." });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  // Constant-time comparison — prevents timing attacks
  let valid = false;
  try {
    const tokenBuf = Buffer.from(token);
    const keyBuf = Buffer.from(apiKey);
    // timingSafeEqual requires buffers of equal length
    if (tokenBuf.length === keyBuf.length) {
      valid = crypto.timingSafeEqual(tokenBuf, keyBuf);
    }
  } catch {
    valid = false;
  }

  if (!valid) {
    return res.status(401).json({ error: "Token inválido." });
  }

  next();
}

/**
 * Logs requests that arrive without auth in production so you know if
 * API_KEY should be set.  Mount once in server.ts if desired:
 *   app.use(authAuditLogger);
 */
export function authAuditLogger(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  if (process.env.API_KEY && !req.headers["authorization"]) {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress;
    console.warn(
      `[Auth] Requisição sem token: ${req.method} ${req.path} — IP ${ip}`
    );
  }
  next();
}
