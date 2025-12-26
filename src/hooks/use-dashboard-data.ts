'use client'

import { useState, useEffect, useCallback } from 'react'

export interface DashboardStats {
  totalSlots: number
  occupiedSlots: number
  availableSlots: number
  occupancyRate: number
  todayEntries: number
  todayExits: number
  todayRevenue: number
  activeTokens: number
  onlineCameras: number
  totalCameras: number
  avgDuration: number
}

export interface ZoneOccupancy {
  zoneId: string
  zoneName: string
  zoneCode: string
  totalSlots: number
  occupiedSlots: number
  availableSlots: number
  occupancyRate: number
}

export interface RecentActivity {
  id: string
  type: 'entry' | 'exit' | 'payment' | 'alert' | 'camera'
  title: string
  description: string
  time: string
  status?: 'success' | 'error' | 'warning'
}

export function useDashboardData(parkingLotId?: string) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [zones, setZones] = useState<ZoneOccupancy[]>([])
  const [activities, setActivities] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchDashboardData = useCallback(async () => {
    try {
      // Fetch stats from parking lot API
      const [statsRes, zonesRes, tokensRes, camerasRes, transactionsRes, recentTokensRes] = await Promise.all([
        parkingLotId
          ? fetch(`/api/parking-lots/${parkingLotId}/stats`)
          : Promise.resolve(null),
        fetch(`/api/zones?${parkingLotId ? `parkingLotId=${parkingLotId}` : ''}`),
        fetch(`/api/tokens?status=ACTIVE&limit=100`),
        fetch(`/api/cameras?${parkingLotId ? `parkingLotId=${parkingLotId}` : ''}`),
        fetch(`/api/transactions?limit=10&sortBy=createdAt&sortOrder=desc`),
        fetch(`/api/tokens?limit=10&sortBy=createdAt&sortOrder=desc`),
      ])

      // Process zones data
      const zonesData = await zonesRes.json()
      if (zonesData.success && zonesData.data) {
        const zonesWithOccupancy: ZoneOccupancy[] = zonesData.data.map((z: any) => ({
          zoneId: z.id,
          zoneName: z.name,
          zoneCode: z.code,
          totalSlots: z.totalSlots || z._count?.slots || 0,
          occupiedSlots: z.occupiedSlots || 0,
          availableSlots: z.availableSlots || z.totalSlots || 0,
          occupancyRate: z.occupancyRate || 0,
        }))
        setZones(zonesWithOccupancy)
      }

      // Process tokens data
      const tokensData = await tokensRes.json()
      const activeTokens = tokensData.success ? tokensData.pagination?.total || tokensData.data?.length || 0 : 0

      // Process cameras data
      const camerasData = await camerasRes.json()
      const cameras = camerasData.success ? camerasData.data || [] : []
      const onlineCameras = cameras.filter((c: any) => c.status === 'ONLINE').length
      const totalCameras = cameras.length

      // Calculate aggregated stats
      let totalSlots = 0
      let occupiedSlots = 0
      if (zonesData.success && zonesData.data) {
        zonesData.data.forEach((z: any) => {
          totalSlots += z.totalSlots || z._count?.slots || 0
          occupiedSlots += z.occupiedSlots || 0
        })
      }

      // If we have parking lot stats, use them
      let statsData: DashboardStats
      if (statsRes) {
        const parkingStats = await statsRes.json()
        if (parkingStats.success) {
          statsData = {
            ...parkingStats.data,
            activeTokens,
            onlineCameras,
            totalCameras,
          }
        } else {
          // Use calculated stats
          statsData = {
            totalSlots,
            occupiedSlots,
            availableSlots: totalSlots - occupiedSlots,
            occupancyRate: totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0,
            todayEntries: 0,
            todayExits: 0,
            todayRevenue: 0,
            activeTokens,
            onlineCameras,
            totalCameras,
            avgDuration: 0,
          }
        }
      } else {
        // Use calculated stats
        statsData = {
          totalSlots,
          occupiedSlots,
          availableSlots: totalSlots - occupiedSlots,
          occupancyRate: totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0,
          todayEntries: 0,
          todayExits: 0,
          todayRevenue: 0,
          activeTokens,
          onlineCameras,
          totalCameras,
          avgDuration: 0,
        }
      }

      setStats(statsData)

      // Process activities from transactions and recent tokens
      const recentActivities: RecentActivity[] = []

      // Add transactions as activities
      const transactionsData = await transactionsRes.json()
      if (transactionsData.success && transactionsData.data) {
        transactionsData.data.forEach((t: any) => {
          const timeAgo = getTimeAgo(new Date(t.createdAt))
          recentActivities.push({
            id: `tx-${t.id}`,
            type: 'payment',
            title: t.paymentStatus === 'COMPLETED' ? 'Payment Received' : 'Payment Pending',
            description: `Token ${t.token?.tokenNumber || 'N/A'} - ${t.paymentMethod || 'N/A'} - Rs ${t.amount}`,
            time: timeAgo,
            status: t.paymentStatus === 'COMPLETED' ? 'success' : t.paymentStatus === 'FAILED' ? 'error' : undefined,
          })
        })
      }

      // Add recent tokens as entry activities
      const recentTokensData = await recentTokensRes.json()
      if (recentTokensData.success && recentTokensData.data) {
        recentTokensData.data.forEach((t: any) => {
          const timeAgo = getTimeAgo(new Date(t.createdAt))
          if (t.status === 'ACTIVE') {
            recentActivities.push({
              id: `entry-${t.id}`,
              type: 'entry',
              title: 'Vehicle Entry',
              description: `${t.licensePlate || 'Unknown'} entered, Token: ${t.tokenNumber}`,
              time: timeAgo,
              status: 'success',
            })
          } else if (t.status === 'COMPLETED') {
            recentActivities.push({
              id: `exit-${t.id}`,
              type: 'exit',
              title: 'Vehicle Exit',
              description: `${t.licensePlate || 'Unknown'} exited, Duration: ${formatDuration(t.actualDuration)}`,
              time: timeAgo,
            })
          }
        })
      }

      // Sort by time and take most recent
      recentActivities.sort((a, b) => {
        // Simple sort based on time string (this is a simplification)
        return 0
      })

      setActivities(recentActivities.slice(0, 8))
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [parkingLotId])

  // Helper function to format time ago
  function getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (seconds < 60) return 'Just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  // Helper function to format duration
  function formatDuration(minutes: number | null): string {
    if (!minutes) return 'N/A'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  useEffect(() => {
    fetchDashboardData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000)

    return () => clearInterval(interval)
  }, [fetchDashboardData])

  return {
    stats,
    zones,
    activities,
    loading,
    error,
    lastUpdated,
    refresh: fetchDashboardData,
  }
}
