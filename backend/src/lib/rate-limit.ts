import type { Request, Response, NextFunction } from "express";

type Entry = { count: number; resetAt: number };

export function rateLimit(max: number, windowMs: number) {
  const store = new Map<string, Entry>();

  // Prune expired entries periodically so the Map doesn't grow forever
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, Math.min(windowMs, 5 * 60_000)).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || entry.resetAt < now) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please try again later.",
      });
    }

    entry.count++;
    next();
  };
}
