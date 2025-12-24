import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, handleApiError } from '@/lib/utils/api'

// GET /api/analytics - Get analytics data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parkingLotId = searchParams.get('parkingLotId')
    const period = searchParams.get('period') || '7d' // 7d, 30d, 90d, 1y
    const type = searchParams.get('type') || 'overview' // overview, occupancy, revenue, traffic

    if (!parkingLotId) {
      return handleApiError(new Error('parkingLotId is required'))
    }

    const now = new Date()
    let startDate: Date

    switch (period) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    switch (type) {
      case 'overview':
        return successResponse(await getOverviewAnalytics(parkingLotId, startDate))
      case 'occupancy':
        return successResponse(await getOccupancyAnalytics(parkingLotId, startDate))
      case 'revenue':
        return successResponse(await getRevenueAnalytics(parkingLotId, startDate))
      case 'traffic':
        return successResponse(await getTrafficAnalytics(parkingLotId, startDate))
      default:
        return successResponse(await getOverviewAnalytics(parkingLotId, startDate))
    }
  } catch (error) {
    return handleApiError(error)
  }
}

async function getOverviewAnalytics(parkingLotId: string, startDate: Date) {
  const [
    totalTransactions,
    totalRevenue,
    avgDuration,
    peakHours,
    zonePerformance,
  ] = await Promise.all([
    // Total transactions
    prisma.transaction.count({
      where: {
        parkingLotId,
        createdAt: { gte: startDate },
        paymentStatus: 'COMPLETED',
      },
    }),

    // Total revenue
    prisma.transaction.aggregate({
      where: {
        parkingLotId,
        createdAt: { gte: startDate },
        paymentStatus: 'COMPLETED',
      },
      _sum: { netAmount: true },
    }),

    // Average duration
    prisma.transaction.aggregate({
      where: {
        parkingLotId,
        createdAt: { gte: startDate },
        duration: { not: null },
      },
      _avg: { duration: true },
    }),

    // Peak hours analysis
    prisma.$queryRaw`
      SELECT
        EXTRACT(HOUR FROM entry_time) as hour,
        COUNT(*) as count
      FROM tokens
      WHERE parking_lot_id = ${parkingLotId}
        AND entry_time >= ${startDate}
      GROUP BY EXTRACT(HOUR FROM entry_time)
      ORDER BY count DESC
      LIMIT 5
    `,

    // Zone performance
    prisma.zone.findMany({
      where: { parkingLotId },
      include: {
        slots: {
          select: { isOccupied: true },
        },
      },
    }),
  ])

  return {
    summary: {
      totalTransactions,
      totalRevenue: (totalRevenue._sum.netAmount || 0) / 100,
      avgDuration: Math.round(avgDuration._avg.duration || 0),
      avgTicketValue: totalTransactions > 0
        ? (totalRevenue._sum.netAmount || 0) / totalTransactions / 100
        : 0,
    },
    peakHours,
    zonePerformance: zonePerformance.map((zone: { id: string; name: string; code: string; slots: { isOccupied: boolean }[] }) => ({
      id: zone.id,
      name: zone.name,
      code: zone.code,
      totalSlots: zone.slots.length,
      occupiedSlots: zone.slots.filter((s: { isOccupied: boolean }) => s.isOccupied).length,
      occupancyRate: zone.slots.length > 0
        ? (zone.slots.filter((s: { isOccupied: boolean }) => s.isOccupied).length / zone.slots.length) * 100
        : 0,
    })),
  }
}

async function getOccupancyAnalytics(parkingLotId: string, startDate: Date) {
  // Get stored analytics data
  const analyticsData = await prisma.parkingAnalytics.findMany({
    where: {
      parkingLotId,
      date: { gte: startDate },
    },
    orderBy: [{ date: 'asc' }, { hour: 'asc' }],
  })

  // If no stored data, calculate from tokens
  if (analyticsData.length === 0) {
    const tokens = await prisma.token.findMany({
      where: {
        parkingLotId,
        entryTime: { gte: startDate },
      },
      select: {
        entryTime: true,
        exitTime: true,
      },
    })

    // Generate hourly occupancy data
    const hourlyData: Record<string, { entries: number; exits: number }> = {}

    for (const token of tokens) {
      const entryKey = `${token.entryTime.toISOString().split('T')[0]}-${token.entryTime.getHours()}`
      if (!hourlyData[entryKey]) {
        hourlyData[entryKey] = { entries: 0, exits: 0 }
      }
      hourlyData[entryKey].entries++

      if (token.exitTime) {
        const exitKey = `${token.exitTime.toISOString().split('T')[0]}-${token.exitTime.getHours()}`
        if (!hourlyData[exitKey]) {
          hourlyData[exitKey] = { entries: 0, exits: 0 }
        }
        hourlyData[exitKey].exits++
      }
    }

    return {
      type: 'calculated',
      data: Object.entries(hourlyData).map(([key, value]) => ({
        timestamp: key,
        ...value,
      })),
    }
  }

  return {
    type: 'stored',
    data: analyticsData.map((a: {
      date: Date
      hour: number | null
      occupancyRate: number
      totalSlots: number
      occupiedSlots: number
      totalEntries: number
      totalExits: number
    }) => ({
      date: a.date,
      hour: a.hour,
      occupancyRate: a.occupancyRate,
      totalSlots: a.totalSlots,
      occupiedSlots: a.occupiedSlots,
      entries: a.totalEntries,
      exits: a.totalExits,
    })),
  }
}

async function getRevenueAnalytics(parkingLotId: string, startDate: Date) {
  const transactions = await prisma.transaction.groupBy({
    by: ['createdAt'],
    where: {
      parkingLotId,
      createdAt: { gte: startDate },
      paymentStatus: 'COMPLETED',
    },
    _sum: {
      netAmount: true,
      tax: true,
      discount: true,
    },
    _count: true,
  })

  // Group by date
  const dailyRevenue: Record<string, {
    revenue: number
    tax: number
    discount: number
    transactions: number
  }> = {}

  for (const t of transactions) {
    const date = t.createdAt.toISOString().split('T')[0]
    if (!dailyRevenue[date]) {
      dailyRevenue[date] = { revenue: 0, tax: 0, discount: 0, transactions: 0 }
    }
    dailyRevenue[date].revenue += (t._sum.netAmount || 0) / 100
    dailyRevenue[date].tax += (t._sum.tax || 0) / 100
    dailyRevenue[date].discount += (t._sum.discount || 0) / 100
    dailyRevenue[date].transactions += t._count
  }

  // Payment method breakdown
  const paymentMethodBreakdown = await prisma.transaction.groupBy({
    by: ['paymentMethod'],
    where: {
      parkingLotId,
      createdAt: { gte: startDate },
      paymentStatus: 'COMPLETED',
      paymentMethod: { not: null },
    },
    _sum: { netAmount: true },
    _count: true,
  })

  return {
    daily: Object.entries(dailyRevenue)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byPaymentMethod: paymentMethodBreakdown.map((p: {
      paymentMethod: string | null
      _sum: { netAmount: number | null }
      _count: number
    }) => ({
      method: p.paymentMethod,
      amount: (p._sum.netAmount || 0) / 100,
      count: p._count,
    })),
  }
}

async function getTrafficAnalytics(parkingLotId: string, startDate: Date) {
  const tokens = await prisma.token.findMany({
    where: {
      parkingLotId,
      entryTime: { gte: startDate },
    },
    select: {
      entryTime: true,
      exitTime: true,
      vehicleType: true,
    },
  })

  // Hourly distribution
  const hourlyDistribution: Record<number, { entries: number; exits: number }> = {}
  for (let i = 0; i < 24; i++) {
    hourlyDistribution[i] = { entries: 0, exits: 0 }
  }

  // Vehicle type breakdown
  const vehicleTypes: Record<string, number> = {}

  // Daily traffic
  const dailyTraffic: Record<string, { entries: number; exits: number }> = {}

  for (const token of tokens) {
    // Hourly
    const entryHour = token.entryTime.getHours()
    hourlyDistribution[entryHour].entries++

    if (token.exitTime) {
      const exitHour = token.exitTime.getHours()
      hourlyDistribution[exitHour].exits++
    }

    // Vehicle type
    const vType = token.vehicleType || 'UNKNOWN'
    vehicleTypes[vType] = (vehicleTypes[vType] || 0) + 1

    // Daily
    const date = token.entryTime.toISOString().split('T')[0]
    if (!dailyTraffic[date]) {
      dailyTraffic[date] = { entries: 0, exits: 0 }
    }
    dailyTraffic[date].entries++
    if (token.exitTime && token.exitTime.toISOString().split('T')[0] === date) {
      dailyTraffic[date].exits++
    }
  }

  return {
    hourlyDistribution: Object.entries(hourlyDistribution).map(([hour, data]) => ({
      hour: parseInt(hour),
      ...data,
    })),
    vehicleTypes: Object.entries(vehicleTypes).map(([type, count]) => ({
      type,
      count,
    })),
    dailyTraffic: Object.entries(dailyTraffic)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  }
}
