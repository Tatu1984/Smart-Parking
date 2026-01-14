/**
 * Alert Evaluation Cron Job
 * Evaluates alert rules and triggers notifications
 * Should be called periodically (e.g., every 5 minutes via Vercel Cron)
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { evaluateAlerts } from '@/app/api/alerts/route'

// Secret key for cron authorization
const CRON_SECRET = process.env.CRON_SECRET

// GET /api/cron/evaluate-alerts - Evaluate all active alert rules
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()
  const context = { correlationId: `cron-alerts-${Date.now()}` }

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

    logger.info('Starting alert evaluation', context)

    const results = await evaluateAlerts()

    const triggeredCount = results.filter(r => r.triggered).length
    const duration = Date.now() - startTime

    logger.info(`Alert evaluation completed in ${duration}ms`, {
      ...context,
      duration,
      rulesEvaluated: results.length,
      alertsTriggered: triggeredCount,
    })

    return NextResponse.json({
      success: true,
      message: 'Alert evaluation completed',
      stats: {
        rulesEvaluated: results.length,
        alertsTriggered: triggeredCount,
        durationMs: duration,
      },
      results,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Alert evaluation failed', error instanceof Error ? error : undefined, {
      ...context,
      duration,
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Alert evaluation failed',
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
