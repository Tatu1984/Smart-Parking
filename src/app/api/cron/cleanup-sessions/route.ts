/**
 * Session Cleanup Cron Job
 * Removes expired sessions from the database
 * Should be called periodically (e.g., every hour via cron or Vercel Cron)
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

// Secret key for cron authorization
const CRON_SECRET = process.env.CRON_SECRET

// GET /api/cron/cleanup-sessions - Cleanup expired sessions
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()
  const context = { correlationId: `cron-${Date.now()}` }

  try {
    // Verify cron secret in production
    if (process.env.NODE_ENV === 'production') {
      const authHeader = request.headers.get('authorization')
      const providedSecret = authHeader?.replace('Bearer ', '')

      if (!CRON_SECRET) {
        logger.error('CRON_SECRET not configured', undefined, context)
        return NextResponse.json(
          { error: 'Cron not configured' },
          { status: 500 }
        )
      }

      if (providedSecret !== CRON_SECRET) {
        logger.warn('Invalid cron secret', context)
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    logger.info('Starting session cleanup', context)

    // Delete expired sessions
    const expiredResult = await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })

    logger.info(`Deleted ${expiredResult.count} expired sessions`, context)

    // Get session limit from env
    const maxSessionsPerUser = parseInt(process.env.MAX_SESSIONS_PER_USER || '5')

    // Find users with too many sessions
    const usersWithManySessions = await prisma.session.groupBy({
      by: ['userId'],
      _count: { id: true },
      having: {
        id: { _count: { gt: maxSessionsPerUser } },
      },
    })

    let excessSessionsDeleted = 0

    // For each user with too many sessions, keep only the most recent ones
    for (const user of usersWithManySessions) {
      // Get sessions to keep (most recent)
      const sessionsToKeep = await prisma.session.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: 'desc' },
        take: maxSessionsPerUser,
        select: { id: true },
      })

      const keepIds = sessionsToKeep.map(s => s.id)

      // Delete older sessions
      const deleted = await prisma.session.deleteMany({
        where: {
          userId: user.userId,
          id: { notIn: keepIds },
        },
      })

      excessSessionsDeleted += deleted.count
    }

    if (excessSessionsDeleted > 0) {
      logger.info(`Deleted ${excessSessionsDeleted} excess sessions`, context)
    }

    // Get current session stats
    const [totalSessions, activeSessions] = await Promise.all([
      prisma.session.count(),
      prisma.session.count({
        where: { expiresAt: { gt: new Date() } },
      }),
    ])

    const duration = Date.now() - startTime

    logger.info(`Session cleanup completed in ${duration}ms`, {
      ...context,
      duration,
      expiredDeleted: expiredResult.count,
      excessDeleted: excessSessionsDeleted,
      totalSessions,
      activeSessions,
    })

    return NextResponse.json({
      success: true,
      message: 'Session cleanup completed',
      stats: {
        expiredSessionsDeleted: expiredResult.count,
        excessSessionsDeleted,
        totalSessionsRemaining: totalSessions,
        activeSessionsRemaining: activeSessions,
        durationMs: duration,
      },
    })
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Session cleanup failed', error instanceof Error ? error : undefined, {
      ...context,
      duration,
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Session cleanup failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// POST is also allowed for flexibility with different cron services
export async function POST(request: NextRequest): Promise<NextResponse> {
  return GET(request)
}
