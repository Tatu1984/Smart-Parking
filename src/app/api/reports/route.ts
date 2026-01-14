import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  generatePDFReport,
  ReportConfig,
  ReportType,
  TransactionReportData,
  OccupancyReportData,
  RevenueReportData,
  VehiclesReportData,
  SummaryReportData
} from '@/lib/export/pdf'

/**
 * Generate PDF report
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { parkingLotId, type, startDate, endDate } = body

    if (!parkingLotId || !type || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'parkingLotId, type, startDate, and endDate are required' },
        { status: 400 }
      )
    }

    const validTypes: ReportType[] = ['transactions', 'occupancy', 'revenue', 'vehicles', 'summary']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Get parking lot info
    const parkingLot = await prisma.parkingLot.findUnique({
      where: { id: parkingLotId }
    })

    if (!parkingLot) {
      return NextResponse.json(
        { error: 'Parking lot not found' },
        { status: 404 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    const config: ReportConfig = {
      type,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Report`,
      parkingLotName: parkingLot.name,
      dateRange: { start, end },
      generatedAt: new Date(),
      generatedBy: user.name || 'System'
    }

    let reportData: TransactionReportData | OccupancyReportData | RevenueReportData | VehiclesReportData | SummaryReportData

    switch (type) {
      case 'transactions':
        reportData = await getTransactionReportData(parkingLotId, start, end)
        break
      case 'occupancy':
        reportData = await getOccupancyReportData(parkingLotId, start, end)
        break
      case 'revenue':
        reportData = await getRevenueReportData(parkingLotId, start, end)
        break
      case 'vehicles':
        reportData = await getVehiclesReportData(parkingLotId, start, end)
        break
      case 'summary':
        reportData = await getSummaryReportData(parkingLotId, start, end)
        break
      default:
        return NextResponse.json(
          { error: 'Report type not yet implemented' },
          { status: 501 }
        )
    }

    const pdfBytes = generatePDFReport(config, reportData)

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${type}-report-${start.toISOString().split('T')[0]}.pdf"`
      }
    })
  } catch (error) {
    console.error('Generate report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}

async function getTransactionReportData(
  parkingLotId: string,
  start: Date,
  end: Date
): Promise<TransactionReportData> {
  // Use a more efficient query that only fetches what we need
  const tokens = await prisma.token.findMany({
    where: {
      parkingLotId,
      entryTime: { gte: start, lte: end }
    },
    include: {
      transactions: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: {
          netAmount: true,
          paymentMethod: true
        }
      }
    },
    orderBy: { entryTime: 'desc' }
  })

  const transactions = tokens.map(t => {
    const payment = t.transactions[0]
    const entryTime = new Date(t.entryTime)
    const exitTime = t.exitTime ? new Date(t.exitTime) : undefined
    const duration = exitTime
      ? Math.round((exitTime.getTime() - entryTime.getTime()) / 60000)
      : 0

    return {
      id: t.id,
      tokenNumber: t.tokenNumber,
      entryTime,
      exitTime,
      duration,
      amount: payment?.netAmount || 0,
      paymentMethod: payment?.paymentMethod || 'N/A',
      vehiclePlate: t.licensePlate || undefined
    }
  })

  const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0)
  const totalDuration = transactions.reduce((sum, t) => sum + t.duration, 0)

  return {
    transactions,
    summary: {
      totalTransactions: transactions.length,
      totalRevenue,
      averageDuration: transactions.length > 0 ? Math.round(totalDuration / transactions.length) : 0,
      averageAmount: transactions.length > 0 ? Math.round(totalRevenue / transactions.length) : 0
    }
  }
}

async function getOccupancyReportData(
  parkingLotId: string,
  start: Date,
  end: Date
): Promise<OccupancyReportData> {
  const analytics = await prisma.parkingAnalytics.findMany({
    where: {
      parkingLotId,
      date: { gte: start, lte: end }
    },
    orderBy: { date: 'asc' }
  })

  // Group by hour
  const hourlyMap = new Map<number, {
    occupancies: number[]
    entries: number
    exits: number
  }>()

  for (let h = 0; h < 24; h++) {
    hourlyMap.set(h, { occupancies: [], entries: 0, exits: 0 })
  }

  for (const a of analytics) {
    if (a.hour !== null) {
      const hourData = hourlyMap.get(a.hour)!
      hourData.occupancies.push(a.occupancyRate)
      hourData.entries += a.totalEntries
      hourData.exits += a.totalExits
    }
  }

  const hourlyData = Array.from(hourlyMap.entries()).map(([hour, data]) => ({
    hour,
    avgOccupancy: data.occupancies.length > 0
      ? data.occupancies.reduce((a, b) => a + b, 0) / data.occupancies.length
      : 0,
    peakOccupancy: data.occupancies.length > 0
      ? Math.max(...data.occupancies)
      : 0,
    entries: data.entries,
    exits: data.exits
  }))

  // Get zone data with aggregated counts
  const zones = await prisma.zone.findMany({
    where: { parkingLotId },
    include: {
      _count: {
        select: { slots: true }
      },
      slots: {
        select: { isOccupied: true }
      }
    }
  })

  const zoneData = zones.map(z => {
    const occupiedCount = z.slots.filter(s => s.isOccupied).length
    return {
      zoneName: z.name,
      totalSlots: z._count.slots,
      avgOccupancy: z._count.slots > 0 ? occupiedCount / z._count.slots : 0,
      peakOccupancy: z._count.slots > 0 ? occupiedCount / z._count.slots : 0
    }
  })

  const allOccupancies = analytics.map(a => a.occupancyRate)
  const totalEntries = analytics.reduce((sum, a) => sum + a.totalEntries, 0)
  const totalExits = analytics.reduce((sum, a) => sum + a.totalExits, 0)

  return {
    hourlyData,
    zoneData,
    summary: {
      avgOccupancyRate: allOccupancies.length > 0
        ? allOccupancies.reduce((a, b) => a + b, 0) / allOccupancies.length
        : 0,
      peakOccupancyRate: allOccupancies.length > 0
        ? Math.max(...allOccupancies)
        : 0,
      totalEntries,
      totalExits
    }
  }
}

async function getRevenueReportData(
  parkingLotId: string,
  start: Date,
  end: Date
): Promise<RevenueReportData> {
  const analytics = await prisma.parkingAnalytics.findMany({
    where: {
      parkingLotId,
      date: { gte: start, lte: end },
      hour: null // Daily aggregates
    },
    orderBy: { date: 'asc' }
  })

  const dailyData = analytics.map(a => ({
    date: new Date(a.date).toLocaleDateString('en-IN'),
    revenue: a.totalRevenue,
    transactions: a.transactionCount,
    avgTicket: a.transactionCount > 0 ? Math.round(a.totalRevenue / a.transactionCount) : 0
  }))

  // Get payment method breakdown
  const payments = await prisma.payment.findMany({
    where: {
      parkingLotId,
      createdAt: { gte: start, lte: end },
      status: 'COMPLETED'
    }
  })

  const methodMap = new Map<string, { count: number; amount: number }>()

  for (const p of payments) {
    const method = p.paymentType || 'Other'
    const existing = methodMap.get(method) || { count: 0, amount: 0 }
    existing.count++
    existing.amount += Number(p.amount)
    methodMap.set(method, existing)
  }

  const paymentMethodBreakdown = Array.from(methodMap.entries())
    .map(([method, data]) => ({
      method,
      count: data.count,
      amount: data.amount
    }))
    .sort((a, b) => b.amount - a.amount)

  const totalRevenue = dailyData.reduce((sum, d) => sum + d.revenue, 0)
  const totalTransactions = dailyData.reduce((sum, d) => sum + d.transactions, 0)

  return {
    dailyData,
    paymentMethodBreakdown,
    summary: {
      totalRevenue,
      totalTransactions,
      avgDailyRevenue: dailyData.length > 0 ? Math.round(totalRevenue / dailyData.length) : 0,
      topPaymentMethod: paymentMethodBreakdown[0]?.method || 'N/A'
    }
  }
}

async function getVehiclesReportData(
  parkingLotId: string,
  start: Date,
  end: Date
): Promise<VehiclesReportData> {
  // Get all tokens with vehicle info for the period
  const tokens = await prisma.token.findMany({
    where: {
      parkingLotId,
      entryTime: { gte: start, lte: end }
    },
    select: {
      licensePlate: true,
      vehicleType: true,
      entryTime: true,
      exitTime: true,
      vehicle: {
        select: {
          visitCount: true,
          isVip: true,
          isBlacklisted: true
        }
      }
    }
  })

  // Vehicle type breakdown
  const vehicleTypeMap = new Map<string, number>()
  for (const t of tokens) {
    const type = t.vehicleType || 'UNKNOWN'
    vehicleTypeMap.set(type, (vehicleTypeMap.get(type) || 0) + 1)
  }

  const vehicleTypeBreakdown = Array.from(vehicleTypeMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  // Unique vehicles
  const uniquePlates = new Set(tokens.filter(t => t.licensePlate).map(t => t.licensePlate))

  // Repeat visitors (vehicles with more than 1 visit)
  const repeatVisitors = tokens.filter(t => t.vehicle && t.vehicle.visitCount > 1).length

  // VIP vehicles
  const vipVehicles = tokens.filter(t => t.vehicle?.isVip).length

  // Blacklisted vehicles detected
  const blacklistedDetected = tokens.filter(t => t.vehicle?.isBlacklisted).length

  // Average parking duration by vehicle type
  const durationByType = new Map<string, { total: number; count: number }>()
  for (const t of tokens) {
    if (t.exitTime) {
      const type = t.vehicleType || 'UNKNOWN'
      const duration = (new Date(t.exitTime).getTime() - new Date(t.entryTime).getTime()) / 60000
      const existing = durationByType.get(type) || { total: 0, count: 0 }
      existing.total += duration
      existing.count++
      durationByType.set(type, existing)
    }
  }

  const avgDurationByType = Array.from(durationByType.entries())
    .map(([type, data]) => ({
      type,
      avgDuration: Math.round(data.total / data.count)
    }))

  return {
    vehicleTypeBreakdown,
    avgDurationByType,
    summary: {
      totalVehicles: tokens.length,
      uniqueVehicles: uniquePlates.size,
      repeatVisitors,
      vipVehicles,
      blacklistedDetected
    }
  }
}

async function getSummaryReportData(
  parkingLotId: string,
  start: Date,
  end: Date
): Promise<SummaryReportData> {
  // Fetch all data in parallel for efficiency
  const [
    parkingLot,
    tokens,
    transactions,
    analytics,
    zones
  ] = await Promise.all([
    prisma.parkingLot.findUnique({
      where: { id: parkingLotId },
      include: {
        _count: {
          select: {
            zones: true,
            cameras: true,
            gates: true
          }
        }
      }
    }),
    prisma.token.count({
      where: {
        parkingLotId,
        entryTime: { gte: start, lte: end }
      }
    }),
    prisma.transaction.aggregate({
      where: {
        parkingLotId,
        createdAt: { gte: start, lte: end },
        paymentStatus: 'COMPLETED'
      },
      _sum: { netAmount: true },
      _count: true,
      _avg: { duration: true }
    }),
    prisma.parkingAnalytics.findMany({
      where: {
        parkingLotId,
        date: { gte: start, lte: end }
      }
    }),
    prisma.zone.findMany({
      where: { parkingLotId },
      include: {
        _count: { select: { slots: true } },
        slots: {
          select: { isOccupied: true, status: true }
        }
      }
    })
  ])

  // Calculate occupancy stats
  const avgOccupancy = analytics.length > 0
    ? analytics.reduce((sum, a) => sum + a.occupancyRate, 0) / analytics.length
    : 0
  const peakOccupancy = analytics.length > 0
    ? Math.max(...analytics.map(a => a.occupancyRate))
    : 0

  // Calculate total slots
  const totalSlots = zones.reduce((sum, z) => sum + z._count.slots, 0)
  const occupiedSlots = zones.reduce(
    (sum, z) => sum + z.slots.filter(s => s.isOccupied).length,
    0
  )
  const maintenanceSlots = zones.reduce(
    (sum, z) => sum + z.slots.filter(s => s.status === 'MAINTENANCE').length,
    0
  )

  // Zone summary
  const zoneSummary = zones.map(z => ({
    name: z.name,
    totalSlots: z._count.slots,
    occupiedSlots: z.slots.filter(s => s.isOccupied).length,
    availableSlots: z.slots.filter(s => !s.isOccupied && s.status === 'AVAILABLE').length
  }))

  return {
    parkingLotInfo: {
      name: parkingLot?.name || 'Unknown',
      totalSlots,
      zones: parkingLot?._count.zones || 0,
      cameras: parkingLot?._count.cameras || 0,
      gates: parkingLot?._count.gates || 0
    },
    operationalSummary: {
      totalTokens: tokens,
      completedTransactions: transactions._count,
      totalRevenue: (transactions._sum.netAmount || 0) / 100,
      avgParkingDuration: Math.round(transactions._avg.duration || 0)
    },
    occupancySummary: {
      currentOccupied: occupiedSlots,
      currentAvailable: totalSlots - occupiedSlots - maintenanceSlots,
      underMaintenance: maintenanceSlots,
      avgOccupancyRate: avgOccupancy,
      peakOccupancyRate: peakOccupancy
    },
    zoneSummary
  }
}
