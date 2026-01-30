import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  predictOccupancy,
  predictPeakHours,
  forecastRevenue,
  predictDemand,
  detectAnomalies,
  analyzeCapacity
} from '@/lib/analytics/predictive'
import { logger } from '@/lib/logger'

/**
 * Get predictive analytics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parkingLotId = searchParams.get('parkingLotId')
    const type = searchParams.get('type') || 'occupancy'
    const hoursAhead = parseInt(searchParams.get('hoursAhead') || '24')
    const period = searchParams.get('period') as 'day' | 'week' | 'month' || 'week'

    if (!parkingLotId) {
      return NextResponse.json(
        { error: 'parkingLotId is required' },
        { status: 400 }
      )
    }

    let data: unknown

    switch (type) {
      case 'occupancy':
        data = await predictOccupancy(parkingLotId, hoursAhead)
        break

      case 'peak-hours':
        data = await predictPeakHours(parkingLotId)
        break

      case 'revenue':
        data = await forecastRevenue(parkingLotId, period)
        break

      case 'demand':
        const targetTime = searchParams.get('targetTime')
        data = await predictDemand(
          parkingLotId,
          targetTime ? new Date(targetTime) : undefined
        )
        break

      case 'anomalies':
        data = await detectAnomalies(parkingLotId)
        break

      case 'capacity':
        data = await analyzeCapacity(parkingLotId)
        break

      case 'all':
        // Return all analytics types
        const [occupancy, peakHours, revenue, demand, anomalies, capacity] = await Promise.all([
          predictOccupancy(parkingLotId, 24),
          predictPeakHours(parkingLotId),
          forecastRevenue(parkingLotId, 'week'),
          predictDemand(parkingLotId),
          detectAnomalies(parkingLotId),
          analyzeCapacity(parkingLotId)
        ])

        data = {
          occupancy,
          peakHours,
          revenue,
          demand,
          anomalies,
          capacity
        }
        break

      default:
        return NextResponse.json(
          { error: 'Invalid type. Must be: occupancy, peak-hours, revenue, demand, anomalies, capacity, or all' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      type,
      parkingLotId,
      generatedAt: new Date().toISOString(),
      data
    })
  } catch (error) {
    logger.error('Predictive analytics error', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to generate predictions' },
      { status: 500 }
    )
  }
}
