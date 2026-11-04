import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export class InMemoryRateLimitStore {
  private readonly records = new Map<string, RateLimitRecord>();
  private nextCleanupTime = 0;

  constructor(
    private readonly maxEntries = 10_000,
    private readonly cleanupIntervalMs = 60_000
  ) {}

  consume(
    key: string,
    now: number,
    maxRequests: number,
    windowMs: number
  ): { allowed: boolean; retryAfterMs: number } {
    if (now >= this.nextCleanupTime) {
      for (const [recordKey, record] of this.records) {
        if (now >= record.resetTime) this.records.delete(recordKey);
      }
      this.nextCleanupTime = now + this.cleanupIntervalMs;
    }

    const record = this.records.get(key);
    if (!record || now >= record.resetTime) {
      if (this.records.size >= this.maxEntries) this.evictSoonestExpiring();
      this.records.set(key, { count: 1, resetTime: now + windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }

    if (record.count >= maxRequests) {
      return { allowed: false, retryAfterMs: record.resetTime - now };
    }

    record.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  get size(): number {
    return this.records.size;
  }

  private evictSoonestExpiring(): void {
    let soonestKey: string | undefined;
    let soonestReset = Number.POSITIVE_INFINITY;
    for (const [key, record] of this.records) {
      if (record.resetTime < soonestReset) {
        soonestKey = key;
        soonestReset = record.resetTime;
      }
    }
    if (soonestKey !== undefined) this.records.delete(soonestKey);
  }
}

const rateLimitStore = new InMemoryRateLimitStore();

/**
 * Basic in-memory rate limiter middleware: max 120 requests per minute
 */
export const rateLimiter = (maxRequests = 120, windowMs = 60 * 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip in test environment
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const result = rateLimitStore.consume(key, now, maxRequests, windowMs);
    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil(result.retryAfterMs / 1000));
      return res.status(429).json({
        success: false,
        error: {
          message: 'Too many requests. Please try again after a minute.',
          statusCode: 429,
        },
      });
    }

    return next();
  };
};
