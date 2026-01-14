/**
 * Metrics Endpoint for Monitoring
 * Provides system and application metrics in JSON and Prometheus format
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

// Store metrics in memory (in production, use Redis or a metrics service)
interface MetricsData {
  requests: {
    total: number
    byStatus: Record<string, number>
    byPath: Record<string, number>
  }
  parking: {
    activeSessions: number
    totalSlots: number
    occupiedSlots: number
    todayRevenue: number
    todayTransactions: number
  }
  system: {
    uptime: number
    memoryUsage: number
    activeSessions: number
  }
}

const startTime = Date.now()

// GET /api/metrics - Get application metrics
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'json'

  try {
    // Get parking metrics
    const [
      totalSlots,
      occupiedSlots,
      activeSessions,
      todayStats,
    ] = await Promise.all([
      prisma.slot.count(),
      prisma.slot.count({ where: { isOccupied: true } }),
      prisma.session.count({
        where: { expiresAt: { gt: new Date() } },
      }),
      prisma.transaction.aggregate({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          paymentStatus: 'COMPLETED',
        },
        _sum: { netAmount: true },
        _count: true,
      }),
    ])

    const mem = process.memoryUsage()

    const metrics: MetricsData = {
      requests: {
        total: 0, // Would track this with middleware
        byStatus: {},
        byPath: {},
      },
      parking: {
        activeSessions: await prisma.token.count({
          where: { status: 'ACTIVE' },
        }),
        totalSlots,
        occupiedSlots,
        todayRevenue: todayStats._sum.netAmount || 0,
        todayTransactions: todayStats._count,
      },
      system: {
        uptime: Math.floor((Date.now() - startTime) / 1000),
        memoryUsage: Math.round(mem.heapUsed / 1024 / 1024),
        activeSessions,
      },
    }

    // Return in requested format
    if (format === 'prometheus') {
      const prometheusMetrics = generatePrometheusMetrics(metrics)
      return new NextResponse(prometheusMetrics, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      })
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics,
    })
  } catch (error) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch metrics',
      },
      { status: 500 }
    )
  }
}

function generatePrometheusMetrics(metrics: MetricsData): string {
  const lines: string[] = []

  // System metrics
  lines.push('# HELP sparking_uptime_seconds Server uptime in seconds')
  lines.push('# TYPE sparking_uptime_seconds gauge')
  lines.push(`sparking_uptime_seconds ${metrics.system.uptime}`)

  lines.push('# HELP sparking_memory_usage_mb Memory usage in megabytes')
  lines.push('# TYPE sparking_memory_usage_mb gauge')
  lines.push(`sparking_memory_usage_mb ${metrics.system.memoryUsage}`)

  lines.push('# HELP sparking_active_user_sessions Active user sessions')
  lines.push('# TYPE sparking_active_user_sessions gauge')
  lines.push(`sparking_active_user_sessions ${metrics.system.activeSessions}`)

  // Parking metrics
  lines.push('# HELP sparking_slots_total Total parking slots')
  lines.push('# TYPE sparking_slots_total gauge')
  lines.push(`sparking_slots_total ${metrics.parking.totalSlots}`)

  lines.push('# HELP sparking_slots_occupied Occupied parking slots')
  lines.push('# TYPE sparking_slots_occupied gauge')
  lines.push(`sparking_slots_occupied ${metrics.parking.occupiedSlots}`)

  lines.push('# HELP sparking_occupancy_rate Current occupancy rate')
  lines.push('# TYPE sparking_occupancy_rate gauge')
  const occupancyRate = metrics.parking.totalSlots > 0
    ? (metrics.parking.occupiedSlots / metrics.parking.totalSlots) * 100
    : 0
  lines.push(`sparking_occupancy_rate ${occupancyRate.toFixed(2)}`)

  lines.push('# HELP sparking_active_parking_sessions Active parking sessions')
  lines.push('# TYPE sparking_active_parking_sessions gauge')
  lines.push(`sparking_active_parking_sessions ${metrics.parking.activeSessions}`)

  lines.push('# HELP sparking_today_revenue_total Today revenue in paisa')
  lines.push('# TYPE sparking_today_revenue_total counter')
  lines.push(`sparking_today_revenue_total ${metrics.parking.todayRevenue}`)

  lines.push('# HELP sparking_today_transactions_total Today transaction count')
  lines.push('# TYPE sparking_today_transactions_total counter')
  lines.push(`sparking_today_transactions_total ${metrics.parking.todayTransactions}`)

  return lines.join('\n')
}
