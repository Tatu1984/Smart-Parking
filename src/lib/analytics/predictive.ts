/**
 * Predictive Analytics for Smart Parking
 * Uses historical data to forecast occupancy, revenue, and traffic patterns
 */

import { prisma } from '@/lib/db'

// ============================================
// OCCUPANCY PREDICTION
// ============================================

export interface OccupancyPrediction {
  timestamp: Date
  predictedOccupancy: number // 0-1
  confidenceInterval: {
    lower: number
    upper: number
  }
  confidence: number // 0-1
}

export interface OccupancyForecast {
  parkingLotId: string
  predictions: OccupancyPrediction[]
  averageConfidence: number
  modelType: 'historical_average' | 'time_series' | 'ml_model'
}

/**
 * Predict occupancy for the next N hours
 */
export async function predictOccupancy(
  parkingLotId: string,
  hoursAhead: number = 24
): Promise<OccupancyForecast> {
  // Get historical data for the same day of week and time slots
  const now = new Date()
  const dayOfWeek = now.getDay()

  // Get past 4 weeks of data for the same day
  const historicalData = await getHistoricalOccupancy(parkingLotId, dayOfWeek, 4)

  const predictions: OccupancyPrediction[] = []

  for (let h = 1; h <= hoursAhead; h++) {
    const targetTime = new Date(now.getTime() + h * 3600000)
    const hour = targetTime.getHours()

    // Get historical data for this hour
    const hourData = historicalData.filter(d => d.hour === hour)

    if (hourData.length > 0) {
      const avgOccupancy = hourData.reduce((sum, d) => sum + d.occupancyRate, 0) / hourData.length
      const stdDev = calculateStdDev(hourData.map(d => d.occupancyRate))

      predictions.push({
        timestamp: targetTime,
        predictedOccupancy: avgOccupancy,
        confidenceInterval: {
          lower: Math.max(0, avgOccupancy - 1.96 * stdDev),
          upper: Math.min(1, avgOccupancy + 1.96 * stdDev)
        },
        confidence: Math.max(0.5, 1 - stdDev * 2) // Higher std dev = lower confidence
      })
    } else {
      // No historical data, use overall average
      predictions.push({
        timestamp: targetTime,
        predictedOccupancy: 0.5,
        confidenceInterval: { lower: 0.2, upper: 0.8 },
        confidence: 0.3
      })
    }
  }

  const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length

  return {
    parkingLotId,
    predictions,
    averageConfidence: avgConfidence,
    modelType: 'historical_average'
  }
}

async function getHistoricalOccupancy(
  parkingLotId: string,
  dayOfWeek: number,
  weeksBack: number
): Promise<{ hour: number; occupancyRate: number }[]> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - weeksBack * 7)

  const analytics = await prisma.parkingAnalytics.findMany({
    where: {
      parkingLotId,
      date: { gte: startDate },
      hour: { not: null }
    },
    select: {
      date: true,
      hour: true,
      occupancyRate: true
    }
  })

  // Filter for matching day of week
  return analytics
    .filter(a => new Date(a.date).getDay() === dayOfWeek && a.hour !== null)
    .map(a => ({
      hour: a.hour!,
      occupancyRate: a.occupancyRate
    }))
}

// ============================================
// PEAK HOURS PREDICTION
// ============================================

export interface PeakHourPrediction {
  dayOfWeek: number
  peakHours: { hour: number; expectedOccupancy: number }[]
  offPeakHours: { hour: number; expectedOccupancy: number }[]
}

/**
 * Identify predicted peak hours for each day of the week
 */
export async function predictPeakHours(parkingLotId: string): Promise<PeakHourPrediction[]> {
  const predictions: PeakHourPrediction[] = []

  for (let day = 0; day < 7; day++) {
    const hourlyData = await getHistoricalOccupancy(parkingLotId, day, 8)

    // Group by hour and calculate averages
    const hourlyAverages: Map<number, number[]> = new Map()
    for (const d of hourlyData) {
      const existing = hourlyAverages.get(d.hour) || []
      existing.push(d.occupancyRate)
      hourlyAverages.set(d.hour, existing)
    }

    const avgByHour: { hour: number; avgOccupancy: number }[] = []
    hourlyAverages.forEach((values, hour) => {
      avgByHour.push({
        hour,
        avgOccupancy: values.reduce((a, b) => a + b, 0) / values.length
      })
    })

    // Sort by occupancy
    avgByHour.sort((a, b) => b.avgOccupancy - a.avgOccupancy)

    // Top 4 are peak, bottom 4 are off-peak
    const peakHours = avgByHour.slice(0, 4).map(h => ({
      hour: h.hour,
      expectedOccupancy: h.avgOccupancy
    }))

    const offPeakHours = avgByHour.slice(-4).map(h => ({
      hour: h.hour,
      expectedOccupancy: h.avgOccupancy
    }))

    predictions.push({
      dayOfWeek: day,
      peakHours,
      offPeakHours
    })
  }

  return predictions
}

// ============================================
// REVENUE FORECASTING
// ============================================

export interface RevenueForecast {
  period: 'day' | 'week' | 'month'
  predictedRevenue: number
  confidenceInterval: {
    lower: number
    upper: number
  }
  growthRate: number // compared to previous period
  factors: {
    name: string
    impact: number // -1 to 1
  }[]
}

/**
 * Forecast revenue for upcoming period
 */
export async function forecastRevenue(
  parkingLotId: string,
  period: 'day' | 'week' | 'month' = 'week'
): Promise<RevenueForecast> {
  const now = new Date()
  const periodDays = period === 'day' ? 1 : period === 'week' ? 7 : 30

  // Get historical revenue data
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - periodDays * 8) // 8 periods back

  const analytics = await prisma.parkingAnalytics.findMany({
    where: {
      parkingLotId,
      date: { gte: startDate },
      hour: null // Daily aggregates
    },
    select: {
      date: true,
      totalRevenue: true,
      transactionCount: true
    },
    orderBy: { date: 'asc' }
  })

  // Calculate period totals
  const periodTotals: number[] = []
  for (let i = 0; i < 8; i++) {
    const periodStart = new Date(startDate)
    periodStart.setDate(periodStart.getDate() + i * periodDays)
    const periodEnd = new Date(periodStart)
    periodEnd.setDate(periodEnd.getDate() + periodDays)

    const periodRevenue = analytics
      .filter(a => {
        const date = new Date(a.date)
        return date >= periodStart && date < periodEnd
      })
      .reduce((sum, a) => sum + a.totalRevenue, 0)

    periodTotals.push(periodRevenue)
  }

  // Calculate trend
  const recentAvg = periodTotals.slice(-4).reduce((a, b) => a + b, 0) / 4
  const olderAvg = periodTotals.slice(0, 4).reduce((a, b) => a + b, 0) / 4
  const trend = olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0

  // Predict next period
  const lastPeriod = periodTotals[periodTotals.length - 1] || 0
  const predictedRevenue = lastPeriod * (1 + trend * 0.5) // Moderate the trend

  // Calculate confidence interval
  const stdDev = calculateStdDev(periodTotals)
  const margin = 1.96 * stdDev

  // Identify factors
  const factors: { name: string; impact: number }[] = []

  // Day of week factor
  const dayOfWeek = now.getDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    factors.push({ name: 'Weekend', impact: 0.2 })
  }

  // Season/month factor
  const month = now.getMonth()
  if ([10, 11, 0].includes(month)) { // Nov, Dec, Jan
    factors.push({ name: 'Holiday Season', impact: 0.15 })
  }

  // Trend factor
  if (trend > 0.1) {
    factors.push({ name: 'Growing Trend', impact: trend })
  } else if (trend < -0.1) {
    factors.push({ name: 'Declining Trend', impact: trend })
  }

  return {
    period,
    predictedRevenue: Math.max(0, predictedRevenue),
    confidenceInterval: {
      lower: Math.max(0, predictedRevenue - margin),
      upper: predictedRevenue + margin
    },
    growthRate: trend,
    factors
  }
}

// ============================================
// DEMAND PREDICTION (for dynamic pricing)
// ============================================

export interface DemandPrediction {
  timestamp: Date
  demandLevel: 'low' | 'medium' | 'high' | 'very_high'
  demandScore: number // 0-100
  suggestedPriceMultiplier: number // 0.5 to 2.0
  factors: string[]
}

/**
 * Predict demand for dynamic pricing
 */
export async function predictDemand(
  parkingLotId: string,
  targetTime?: Date
): Promise<DemandPrediction> {
  const time = targetTime || new Date()
  const hour = time.getHours()
  const dayOfWeek = time.getDay()

  // Get historical data for this time slot
  const historicalData = await getHistoricalOccupancy(parkingLotId, dayOfWeek, 8)
  const hourData = historicalData.filter(d => d.hour === hour)

  const avgOccupancy = hourData.length > 0
    ? hourData.reduce((sum, d) => sum + d.occupancyRate, 0) / hourData.length
    : 0.5

  // Calculate demand score (0-100)
  const demandScore = Math.round(avgOccupancy * 100)

  // Determine demand level
  let demandLevel: 'low' | 'medium' | 'high' | 'very_high'
  let priceMultiplier: number

  if (demandScore < 30) {
    demandLevel = 'low'
    priceMultiplier = 0.8
  } else if (demandScore < 60) {
    demandLevel = 'medium'
    priceMultiplier = 1.0
  } else if (demandScore < 85) {
    demandLevel = 'high'
    priceMultiplier = 1.3
  } else {
    demandLevel = 'very_high'
    priceMultiplier = 1.5
  }

  // Identify factors affecting demand
  const factors: string[] = []

  // Time-based factors
  if (hour >= 9 && hour <= 11) factors.push('Morning rush hour')
  if (hour >= 17 && hour <= 19) factors.push('Evening rush hour')
  if (hour >= 12 && hour <= 14) factors.push('Lunch time')

  // Day-based factors
  if (dayOfWeek === 0 || dayOfWeek === 6) factors.push('Weekend')
  if (dayOfWeek === 5) factors.push('Friday (pre-weekend)')

  // Historical pattern
  if (avgOccupancy > 0.8) factors.push('Historically high demand')
  if (avgOccupancy < 0.3) factors.push('Historically low demand')

  return {
    timestamp: time,
    demandLevel,
    demandScore,
    suggestedPriceMultiplier: priceMultiplier,
    factors
  }
}

// ============================================
// ANOMALY DETECTION
// ============================================

export interface Anomaly {
  type: 'occupancy_spike' | 'occupancy_drop' | 'revenue_anomaly' | 'traffic_anomaly'
  severity: 'low' | 'medium' | 'high'
  timestamp: Date
  description: string
  deviation: number // Standard deviations from mean
  suggestedAction?: string
}

/**
 * Detect anomalies in recent data
 */
export async function detectAnomalies(parkingLotId: string): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = []
  const now = new Date()

  // Get recent analytics
  const recentData = await prisma.parkingAnalytics.findMany({
    where: {
      parkingLotId,
      date: {
        gte: new Date(now.getTime() - 24 * 3600000) // Last 24 hours
      }
    },
    orderBy: { date: 'desc' }
  })

  if (recentData.length === 0) return anomalies

  // Get baseline data (past 30 days)
  const baselineData = await prisma.parkingAnalytics.findMany({
    where: {
      parkingLotId,
      date: {
        gte: new Date(now.getTime() - 30 * 24 * 3600000),
        lt: new Date(now.getTime() - 24 * 3600000)
      },
      hour: { not: null }
    }
  })

  // Calculate baseline statistics
  const baselineOccupancy = baselineData.map(d => d.occupancyRate)
  const meanOccupancy = baselineOccupancy.reduce((a, b) => a + b, 0) / baselineOccupancy.length || 0.5
  const stdDevOccupancy = calculateStdDev(baselineOccupancy)

  // Check for anomalies in recent data
  for (const data of recentData) {
    const zScore = (data.occupancyRate - meanOccupancy) / (stdDevOccupancy || 0.1)

    if (Math.abs(zScore) > 2) {
      const severity = Math.abs(zScore) > 3 ? 'high' : 'medium'
      const type = zScore > 0 ? 'occupancy_spike' : 'occupancy_drop'

      anomalies.push({
        type,
        severity,
        timestamp: new Date(data.date),
        description: zScore > 0
          ? `Unusually high occupancy (${(data.occupancyRate * 100).toFixed(0)}%)`
          : `Unusually low occupancy (${(data.occupancyRate * 100).toFixed(0)}%)`,
        deviation: zScore,
        suggestedAction: zScore > 0
          ? 'Consider dynamic pricing increase or overflow management'
          : 'Investigate potential issues or run promotional campaign'
      })
    }
  }

  return anomalies
}

// ============================================
// CAPACITY PLANNING
// ============================================

export interface CapacityRecommendation {
  currentCapacity: number
  predictedPeakDemand: number
  utilizationRate: number
  recommendation: 'adequate' | 'expand' | 'optimize' | 'reduce'
  details: string
  projectedROI?: number
}

/**
 * Provide capacity planning recommendations
 */
export async function analyzeCapacity(parkingLotId: string): Promise<CapacityRecommendation> {
  // Get parking lot info
  const lot = await prisma.parkingLot.findUnique({
    where: { id: parkingLotId },
    include: {
      zones: {
        include: {
          slots: true
        }
      }
    }
  })

  if (!lot) {
    throw new Error('Parking lot not found')
  }

  const currentCapacity = lot.zones.reduce((sum, z) => sum + z.slots.length, 0)

  // Get peak demand from historical data
  const peakData = await prisma.parkingAnalytics.findFirst({
    where: { parkingLotId },
    orderBy: { peakOccupancy: 'desc' }
  })

  const predictedPeakDemand = peakData?.peakOccupancy || 0
  const utilizationRate = currentCapacity > 0 ? predictedPeakDemand / currentCapacity : 0

  let recommendation: 'adequate' | 'expand' | 'optimize' | 'reduce'
  let details: string

  if (utilizationRate > 0.95) {
    recommendation = 'expand'
    details = 'Peak demand frequently exceeds capacity. Consider adding more slots or implementing reservation system.'
  } else if (utilizationRate > 0.8) {
    recommendation = 'optimize'
    details = 'Good utilization but approaching capacity. Implement dynamic pricing and improve turnover.'
  } else if (utilizationRate > 0.5) {
    recommendation = 'adequate'
    details = 'Capacity is well-matched to demand with room for growth.'
  } else {
    recommendation = 'reduce'
    details = 'Significant underutilization. Consider repurposing space or aggressive marketing.'
  }

  return {
    currentCapacity,
    predictedPeakDemand,
    utilizationRate,
    recommendation,
    details
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0

  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length

  return Math.sqrt(avgSquaredDiff)
}
