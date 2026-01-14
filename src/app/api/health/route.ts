import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCache } from '@/lib/cache'

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  uptime: number
  environment: string
  checks: {
    database: {
      status: 'up' | 'down'
      latency?: number
      error?: string
    }
    cache: {
      status: 'up' | 'down' | 'not_configured'
      type: 'redis' | 'memory'
      latency?: number
      error?: string
    }
    memory: {
      heapUsed: number
      heapTotal: number
      rss: number
      percentUsed: number
    }
  }
}

const startTime = Date.now()

export async function GET() {
  const health: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    environment: process.env.NODE_ENV || 'development',
    checks: {
      database: {
        status: 'down',
      },
      cache: {
        status: 'not_configured',
        type: process.env.REDIS_URL ? 'redis' : 'memory',
      },
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        rss: 0,
        percentUsed: 0,
      },
    },
  }

  // Check database connectivity
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    health.checks.database = {
      status: 'up',
      latency: Date.now() - dbStart,
    }
  } catch (error) {
    health.checks.database = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    health.status = 'unhealthy'
  }

  // Check cache connectivity
  try {
    const cache = getCache()
    const cacheStart = Date.now()
    const testKey = `health-check-${Date.now()}`
    await cache.set(testKey, 'ok', 10)
    const result = await cache.get<string>(testKey)
    await cache.delete(testKey)

    health.checks.cache = {
      status: result === 'ok' ? 'up' : 'down',
      type: process.env.REDIS_URL ? 'redis' : 'memory',
      latency: Date.now() - cacheStart,
    }
  } catch (error) {
    health.checks.cache = {
      status: 'down',
      type: process.env.REDIS_URL ? 'redis' : 'memory',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    // Cache failure is a degraded state, not unhealthy
    if (health.status === 'healthy') {
      health.status = 'degraded'
    }
  }

  // Memory usage (Node.js environment)
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const mem = process.memoryUsage()
    const heapUsed = Math.round(mem.heapUsed / 1024 / 1024)
    const heapTotal = Math.round(mem.heapTotal / 1024 / 1024)

    health.checks.memory = {
      heapUsed,
      heapTotal,
      rss: Math.round(mem.rss / 1024 / 1024),
      percentUsed: Math.round((heapUsed / heapTotal) * 100),
    }

    // Warn if memory usage is high
    if (health.checks.memory.percentUsed > 90) {
      if (health.status === 'healthy') {
        health.status = 'degraded'
      }
    }
  }

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503

  return NextResponse.json(health, { status: statusCode })
}
