'use client'

import { useState, useEffect, useCallback } from 'react'

export interface OccupancyDataPoint {
  hour: string
  occupancy: number
  entries: number
  exits: number
}

export interface RevenueDataPoint {
  date: string
  revenue: number
  transactions: number
}

export interface VehicleTypeData {
  type: string
  count: number
  color: string
}

export interface ZonePerformance {
  zone: string
  zoneId: string
  occupancy: number
  revenue: number
}

export interface PeakHourData {
  hour: string
  entries: number
}

export interface AnalyticsSummary {
  totalRevenue: number
  totalVehicles: number
  avgDuration: number
  peakOccupancy: number
  peakHour: string
  revenueChange: number
  vehicleChange: number
  durationChange: number
}

export function useAnalyticsData(period: string = '7d') {
  const [occupancyData, setOccupancyData] = useState<OccupancyDataPoint[]>([])
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([])
  const [vehicleTypeData, setVehicleTypeData] = useState<VehicleTypeData[]>([])
  const [zonePerformance, setZonePerformance] = useState<ZonePerformance[]>([])
  const [peakHoursData, setPeakHoursData] = useState<PeakHourData[]>([])
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const vehicleTypeColors: Record<string, string> = {
    CAR: '#3b82f6',
    SUV: '#22c55e',
    MOTORCYCLE: '#f59e0b',
    VAN: '#8b5cf6',
    BUS: '#ef4444',
    TRUCK: '#06b6d4',
    BICYCLE: '#84cc16',
    ANY: '#6b7280',
  }

  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch analytics data from API
      const [analyticsRes, zonesRes, transactionsRes, tokensRes] = await Promise.all([
        fetch(`/api/analytics?period=${period}`),
        fetch('/api/zones'),
        fetch(`/api/transactions?limit=1000&period=${period}`),
        fetch(`/api/tokens?limit=1000&period=${period}`),
      ])

      // Process analytics data
      const analyticsData = await analyticsRes.json()
      if (analyticsData.success && analyticsData.data) {
        // Process hourly occupancy data
        if (analyticsData.data.hourly) {
          const hourlyData: OccupancyDataPoint[] = analyticsData.data.hourly.map((h: { hour: number; occupancyRate: number; entries?: number; exits?: number }) => ({
            hour: `${String(h.hour).padStart(2, '0')}:00`,
            occupancy: Math.round((h.occupancyRate || 0) * 100),
            entries: h.entries || 0,
            exits: h.exits || 0,
          }))
          setOccupancyData(hourlyData)

          // Calculate peak hours
          const peakHours = hourlyData
            .filter(h => h.entries > 0)
            .sort((a, b) => b.entries - a.entries)
            .slice(0, 9)
          setPeakHoursData(peakHours)
        }

        // Process daily revenue data
        if (analyticsData.data.daily) {
          const dailyData: RevenueDataPoint[] = analyticsData.data.daily.map((d: { date: string; revenue: number; transactionCount: number }) => ({
            date: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
            revenue: d.revenue / 100, // Convert from paisa
            transactions: d.transactionCount,
          }))
          setRevenueData(dailyData)
        }

        // Set summary stats
        if (analyticsData.data.summary) {
          const s = analyticsData.data.summary
          setSummary({
            totalRevenue: s.totalRevenue / 100,
            totalVehicles: s.totalVehicles || 0,
            avgDuration: s.avgDuration || 0,
            peakOccupancy: Math.round((s.peakOccupancy || 0) * 100),
            peakHour: s.peakHour ? `${s.peakHour}:00` : 'N/A',
            revenueChange: s.revenueChange || 0,
            vehicleChange: s.vehicleChange || 0,
            durationChange: s.durationChange || 0,
          })
        }
      }

      // Process zones data for zone performance
      const zonesData = await zonesRes.json()
      if (zonesData.success && zonesData.data) {
        const zonePerf: ZonePerformance[] = zonesData.data.map((z: { id: string; name: string; occupancyRate?: number; revenue?: number }) => ({
          zoneId: z.id,
          zone: z.name,
          occupancy: Math.round((z.occupancyRate || 0) * 100),
          revenue: (z.revenue || 0) / 100,
        }))
        setZonePerformance(zonePerf)
      }

      // Process tokens data for vehicle types
      const tokensData = await tokensRes.json()
      if (tokensData.success && tokensData.data) {
        const vehicleCounts: Record<string, number> = {}
        tokensData.data.forEach((t: { vehicleType?: string }) => {
          const type = t.vehicleType || 'CAR'
          vehicleCounts[type] = (vehicleCounts[type] || 0) + 1
        })

        const vehicleTypes: VehicleTypeData[] = Object.entries(vehicleCounts).map(([type, count]) => ({
          type: type.charAt(0) + type.slice(1).toLowerCase(),
          count,
          color: vehicleTypeColors[type] || '#6b7280',
        }))
        setVehicleTypeData(vehicleTypes)
      }

      setError(null)
    } catch (err) {
      setError('Failed to load analytics data')
      // Set empty arrays on error
      setOccupancyData([])
      setRevenueData([])
      setVehicleTypeData([])
      setZonePerformance([])
      setPeakHoursData([])
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchAnalyticsData()
  }, [fetchAnalyticsData])

  return {
    occupancyData,
    revenueData,
    vehicleTypeData,
    zonePerformance,
    peakHoursData,
    summary,
    loading,
    error,
    refresh: fetchAnalyticsData,
  }
}
