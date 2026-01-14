/**
 * Rate Limiting with Redis support and in-memory fallback
 * Provides distributed rate limiting for production environments
 */

import { getCache, CacheKeys, CacheTTL } from '../cache'

interface RateLimitResult {
  limited: boolean
  remaining: number
  resetIn: number // seconds
  limit: number
}

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
}

// Default configuration
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
}

// Route-specific limits
const ROUTE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/auth/login': { windowMs: 60000, maxRequests: 5 }, // 5 per minute
  '/api/auth/register': { windowMs: 60000, maxRequests: 3 }, // 3 per minute
  '/api/payments': { windowMs: 60000, maxRequests: 20 }, // 20 per minute
  '/api/realtime/detection': { windowMs: 1000, maxRequests: 100 }, // 100 per second (for AI pipeline)
}

/**
 * Get rate limit configuration for a path
 */
function getConfigForPath(path: string): RateLimitConfig {
  // Check for exact match first
  if (ROUTE_LIMITS[path]) {
    return ROUTE_LIMITS[path]
  }

  // Check for prefix match
  for (const [route, config] of Object.entries(ROUTE_LIMITS)) {
    if (path.startsWith(route)) {
      return config
    }
  }

  return DEFAULT_CONFIG
}

/**
 * Get client identifier from request
 */
export function getClientIdentifier(
  ip: string | null,
  userId?: string | null
): string {
  // Prefer user ID if available (authenticated requests)
  if (userId) {
    return `user:${userId}`
  }

  // Fall back to IP
  return `ip:${ip || 'unknown'}`
}

/**
 * Check if request is rate limited
 */
export async function checkRateLimit(
  identifier: string,
  path: string
): Promise<RateLimitResult> {
  const config = getConfigForPath(path)
  const cache = getCache()
  const key = CacheKeys.rateLimit(identifier, path)
  const windowSeconds = Math.ceil(config.windowMs / 1000)

  try {
    // Increment counter
    const count = await cache.increment(key, windowSeconds)

    const limited = count > config.maxRequests
    const remaining = Math.max(0, config.maxRequests - count)

    return {
      limited,
      remaining,
      resetIn: windowSeconds,
      limit: config.maxRequests,
    }
  } catch (error) {
    // If cache fails, allow the request (fail open)
    console.error('Rate limit check failed:', error)
    return {
      limited: false,
      remaining: config.maxRequests,
      resetIn: windowSeconds,
      limit: config.maxRequests,
    }
  }
}

/**
 * Rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetIn.toString(),
  }
}

/**
 * Create rate limited response
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: result.resetIn,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': result.resetIn.toString(),
        ...getRateLimitHeaders(result),
      },
    }
  )
}

/**
 * Sliding window rate limiter for more accurate limiting
 * Uses a sliding window algorithm instead of fixed windows
 */
export class SlidingWindowRateLimiter {
  private windowMs: number
  private maxRequests: number
  private requests: Map<string, number[]> = new Map()

  constructor(config: RateLimitConfig = DEFAULT_CONFIG) {
    this.windowMs = config.windowMs
    this.maxRequests = config.maxRequests

    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000)
  }

  async check(identifier: string): Promise<RateLimitResult> {
    const now = Date.now()
    const windowStart = now - this.windowMs

    // Get existing timestamps
    let timestamps = this.requests.get(identifier) || []

    // Filter to only include timestamps in current window
    timestamps = timestamps.filter((t) => t > windowStart)

    // Check if limited
    const limited = timestamps.length >= this.maxRequests

    if (!limited) {
      // Add current request
      timestamps.push(now)
      this.requests.set(identifier, timestamps)
    }

    const remaining = Math.max(0, this.maxRequests - timestamps.length)
    const oldestTimestamp = timestamps[0] || now
    const resetIn = Math.ceil((oldestTimestamp + this.windowMs - now) / 1000)

    return {
      limited,
      remaining,
      resetIn: Math.max(1, resetIn),
      limit: this.maxRequests,
    }
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs

    for (const [key, timestamps] of this.requests.entries()) {
      const filtered = timestamps.filter((t) => t > cutoff)
      if (filtered.length === 0) {
        this.requests.delete(key)
      } else {
        this.requests.set(key, filtered)
      }
    }
  }
}

// Export default instance for simple use cases
export const rateLimiter = new SlidingWindowRateLimiter()
