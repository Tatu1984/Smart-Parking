/**
 * Caching layer with Redis support and in-memory fallback
 * Provides a unified interface for caching data
 */

import { logger } from '@/lib/logger'

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

// In-memory cache for development or when Redis is not available
class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000)
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.value
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    })
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key)
  }

  async deletePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace('*', '.*'))
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const current = await this.get<number>(key)
    const newValue = (current || 0) + 1
    await this.set(key, newValue, ttlSeconds)
    return newValue
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.cache.clear()
  }
}

// Redis cache implementation using native fetch to Redis HTTP API
// For production, consider using ioredis package for full Redis protocol support
class RedisCache {
  private redisUrl: string
  private fallback: MemoryCache

  constructor(redisUrl: string) {
    this.redisUrl = redisUrl
    this.fallback = new MemoryCache()
    logger.info(`Redis cache configured`)
  }

  private async executeCommand(command: string[]): Promise<unknown> {
    // If using Upstash Redis (HTTP-based), use REST API
    if (this.redisUrl.includes('upstash')) {
      const token = this.redisUrl.split('@')[0].split('://')[1]
      const url = `https://${this.redisUrl.split('@')[1]}`

      try {
        const response = await fetch(`${url}/${command.join('/')}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        const data = await response.json()
        return data.result
      } catch (error) {
        logger.error('Redis command failed:', error instanceof Error ? error : undefined)
        throw error
      }
    }

    // For standard Redis, fall back to memory cache
    // In production with standard Redis, use ioredis package
    throw new Error('Standard Redis requires ioredis package')
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await this.executeCommand(['GET', key])
      if (result === null) return null
      return JSON.parse(result as string) as T
    } catch {
      return this.fallback.get<T>(key)
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.executeCommand(['SETEX', key, ttlSeconds.toString(), JSON.stringify(value)])
    } catch {
      await this.fallback.set(key, value, ttlSeconds)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.executeCommand(['DEL', key])
    } catch {
      await this.fallback.delete(key)
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    // Pattern deletion not supported via HTTP, use fallback
    await this.fallback.deletePattern(pattern)
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    try {
      const result = await this.executeCommand(['INCR', key])
      await this.executeCommand(['EXPIRE', key, ttlSeconds.toString()])
      return result as number
    } catch {
      return this.fallback.increment(key, ttlSeconds)
    }
  }

  destroy(): void {
    this.fallback.destroy()
  }
}

// Cache interface
interface Cache {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>
  delete(key: string): Promise<void>
  deletePattern(pattern: string): Promise<void>
  increment(key: string, ttlSeconds: number): Promise<number>
  destroy(): void
}

// Singleton cache instance
let cacheInstance: Cache | null = null

export function getCache(): Cache {
  if (!cacheInstance) {
    const redisUrl = process.env.REDIS_URL

    if (redisUrl && process.env.NODE_ENV === 'production') {
      // Use Redis in production if configured
      cacheInstance = new RedisCache(redisUrl)
      logger.info('Using Redis cache')
    } else {
      // Use memory cache in development or when Redis is not configured
      cacheInstance = new MemoryCache()
      if (process.env.NODE_ENV === 'production') {
        logger.warn('WARNING: Using in-memory cache in production. Configure REDIS_URL for distributed caching.')
      }
    }
  }

  return cacheInstance
}

// Convenience functions
export async function cacheGet<T>(key: string): Promise<T | null> {
  return getCache().get<T>(key)
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
  return getCache().set(key, value, ttlSeconds)
}

export async function cacheDelete(key: string): Promise<void> {
  return getCache().delete(key)
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  return getCache().deletePattern(pattern)
}

// Cache key builders
export const CacheKeys = {
  pricingRules: (parkingLotId: string) => `pricing:${parkingLotId}`,
  parkingLotConfig: (parkingLotId: string) => `config:lot:${parkingLotId}`,
  slotStatus: (slotId: string) => `slot:${slotId}:status`,
  userSession: (userId: string) => `session:user:${userId}`,
  rateLimit: (ip: string, path: string) => `ratelimit:${ip}:${path}`,
}

// Cache TTLs (in seconds)
export const CacheTTL = {
  PRICING_RULES: 3600, // 1 hour
  PARKING_LOT_CONFIG: 300, // 5 minutes
  SLOT_STATUS: 60, // 1 minute
  USER_SESSION: 3600, // 1 hour
  RATE_LIMIT: 60, // 1 minute
}
