// Analytics Service
// Handles analytics, reports, and dashboard data

import { apiClient, API_ENDPOINTS } from '@/lib/api'
import type { DashboardStats, OccupancyTrend, RevenueData } from '@/lib/api/types'

// Types for analytics operations
export interface AnalyticsFilters {
  parkingLotId?: string
  startDate?: string
  endDate?: string
  granularity?: 'hour' | 'day' | 'week' | 'month'
}

export interface DashboardData {
  stats: DashboardStats
  occupancyTrend: OccupancyTrend[]
  revenueData: RevenueData[]
  recentActivity: Array<{
    id: string
    type: string
    description: string
    timestamp: string
  }>
}

export interface PredictiveAnalytics {
  predictedOccupancy: Array<{
    hour: number
    predicted: number
    confidence: number
  }>
  peakHours: Array<{
    start: string
    end: string
    averageOccupancy: number
  }>
  recommendations: string[]
}

export interface ReportRequest {
  type: 'occupancy' | 'revenue' | 'transactions' | 'summary'
  parkingLotId?: string
  startDate: string
  endDate: string
  format?: 'pdf' | 'csv' | 'excel'
}

export interface Report {
  id: string
  type: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  downloadUrl?: string
  createdAt: string
}

export const analyticsService = {
  /**
   * Get dashboard stats
   */
  async getDashboardStats(parkingLotId?: string): Promise<DashboardStats> {
    return apiClient.get<DashboardStats>(API_ENDPOINTS.ANALYTICS.DASHBOARD, {
      params: parkingLotId ? { parkingLotId } : undefined,
    })
  },

  /**
   * Get full dashboard data including trends
   */
  async getDashboardData(parkingLotId?: string): Promise<DashboardData> {
    return apiClient.get<DashboardData>(API_ENDPOINTS.ANALYTICS.DASHBOARD, {
      params: {
        parkingLotId,
        includeTrends: true,
        includeActivity: true,
      },
    })
  },

  /**
   * Get occupancy trends
   */
  async getOccupancyTrends(filters?: AnalyticsFilters): Promise<OccupancyTrend[]> {
    return apiClient.get<OccupancyTrend[]>(API_ENDPOINTS.ANALYTICS.OCCUPANCY, {
      params: filters,
    })
  },

  /**
   * Get revenue data
   */
  async getRevenueData(filters?: AnalyticsFilters): Promise<RevenueData[]> {
    return apiClient.get<RevenueData[]>(API_ENDPOINTS.ANALYTICS.REVENUE, {
      params: filters,
    })
  },

  /**
   * Get predictive analytics
   */
  async getPredictiveAnalytics(parkingLotId: string): Promise<PredictiveAnalytics> {
    return apiClient.get<PredictiveAnalytics>(API_ENDPOINTS.ANALYTICS.PREDICTIVE, {
      params: { parkingLotId },
    })
  },

  /**
   * List reports
   */
  async listReports(): Promise<Report[]> {
    return apiClient.get<Report[]>(API_ENDPOINTS.REPORTS.LIST)
  },

  /**
   * Generate a report
   */
  async generateReport(request: ReportRequest): Promise<Report> {
    return apiClient.post<Report>(API_ENDPOINTS.REPORTS.GENERATE, request)
  },

  /**
   * Export data
   */
  async exportData(request: ReportRequest): Promise<{ downloadUrl: string }> {
    return apiClient.post(API_ENDPOINTS.REPORTS.EXPORT, request)
  },
}
