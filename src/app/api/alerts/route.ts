/**
 * Alerts API
 * Manage alert rules and view triggered alerts
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { sendNotification } from '@/lib/notifications'
import { dispatchWebhook } from '@/lib/webhooks'

// Schema for creating/updating alert rules
const alertRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  metric: z.enum([
    'occupancy_rate',
    'camera_offline',
    'payment_failed',
    'gate_error',
    'high_traffic',
    'low_revenue',
  ]),
  operator: z.enum(['gt', 'lt', 'eq', 'gte', 'lte']),
  threshold: z.number(),
  notifyEmail: z.boolean().default(false),
  notifySms: z.boolean().default(false),
  notifyPush: z.boolean().default(false),
  webhookUrl: z.string().url().optional().nullable(),
  cooldownMinutes: z.number().min(1).max(1440).default(15),
  isActive: z.boolean().default(true),
})

// GET /api/alerts - List all alert rules
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeTriggered = searchParams.get('includeTriggered') === 'true'

    const alertRules = await prisma.alertRule.findMany({
      orderBy: { createdAt: 'desc' },
    })

    // Get recent triggered alerts if requested
    let recentAlerts: object[] = []
    if (includeTriggered) {
      recentAlerts = await prisma.alertRule.findMany({
        where: {
          lastTriggeredAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        select: {
          id: true,
          name: true,
          metric: true,
          threshold: true,
          lastTriggeredAt: true,
        },
        orderBy: { lastTriggeredAt: 'desc' },
        take: 50,
      })
    }

    return successResponse({
      rules: alertRules,
      ...(includeTriggered && { recentAlerts }),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/alerts - Create a new alert rule
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN or SUPER_ADMIN can create alerts
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = alertRuleSchema.parse(body)

    const alertRule = await prisma.alertRule.create({
      data,
    })

    return successResponse(alertRule, 'Alert rule created successfully')
  } catch (error) {
    return handleApiError(error)
  }
}

// Helper function to evaluate alert conditions (used by cron job)
export async function evaluateAlerts() {
  const rules = await prisma.alertRule.findMany({
    where: { isActive: true },
  })

  const results: { ruleId: string; triggered: boolean; value: number }[] = []

  for (const rule of rules) {
    // Skip if within cooldown period
    if (rule.lastTriggeredAt) {
      const cooldownEnd = new Date(
        rule.lastTriggeredAt.getTime() + rule.cooldownMinutes * 60 * 1000
      )
      if (new Date() < cooldownEnd) {
        continue
      }
    }

    let currentValue = 0

    switch (rule.metric) {
      case 'occupancy_rate':
        const [total, occupied] = await Promise.all([
          prisma.slot.count(),
          prisma.slot.count({ where: { isOccupied: true } }),
        ])
        currentValue = total > 0 ? (occupied / total) * 100 : 0
        break

      case 'camera_offline':
        currentValue = await prisma.camera.count({
          where: { status: 'OFFLINE' },
        })
        break

      case 'payment_failed':
        currentValue = await prisma.payment.count({
          where: {
            status: 'FAILED',
            createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
          },
        })
        break

      case 'gate_error':
        currentValue = await prisma.gate.count({
          where: { status: 'ERROR' },
        })
        break

      default:
        continue
    }

    // Evaluate condition
    let triggered = false
    switch (rule.operator) {
      case 'gt':
        triggered = currentValue > rule.threshold
        break
      case 'lt':
        triggered = currentValue < rule.threshold
        break
      case 'eq':
        triggered = currentValue === rule.threshold
        break
      case 'gte':
        triggered = currentValue >= rule.threshold
        break
      case 'lte':
        triggered = currentValue <= rule.threshold
        break
    }

    if (triggered) {
      // Update last triggered time
      await prisma.alertRule.update({
        where: { id: rule.id },
        data: { lastTriggeredAt: new Date() },
      })

      logger.info(`Alert triggered: ${rule.name}`, {
        metric: rule.metric,
        value: currentValue,
        threshold: rule.threshold,
        ruleId: rule.id,
      })

      // Send notifications to admin users
      if (rule.notifyEmail || rule.notifySms) {
        const adminUsers = await prisma.user.findMany({
          where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
          select: { id: true, email: true, phone: true },
        })

        for (const admin of adminUsers) {
          await sendNotification({
            type: 'SYSTEM_ALERT',
            userId: admin.id,
            email: rule.notifyEmail ? admin.email : undefined,
            phone: rule.notifySms && admin.phone ? admin.phone : undefined,
            title: `Alert: ${rule.name}`,
            message: `${rule.metric} has reached ${currentValue} (threshold: ${rule.threshold})`,
            data: {
              ruleId: rule.id,
              metric: rule.metric,
              value: currentValue,
              threshold: rule.threshold,
            },
          })
        }
      }

      // Dispatch webhook if configured
      if (rule.webhookUrl) {
        await dispatchWebhook('alert.triggered', 'system', {
          ruleId: rule.id,
          ruleName: rule.name,
          metric: rule.metric,
          value: currentValue,
          threshold: rule.threshold,
          operator: rule.operator,
          triggeredAt: new Date().toISOString(),
        })
      }
    }

    results.push({
      ruleId: rule.id,
      triggered,
      value: currentValue,
    })
  }

  return results
}
