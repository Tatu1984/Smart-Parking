// Analytics Model Types
// Domain models for analytics and reporting

export interface DashboardStats {
  totalSlots: number
  occupiedSlots: number
  availableSlots: number
  occupancyRate: number
  todayRevenue: number
  activeTokens: number
  todayTransactions: number
  currency: string
}

export interface ZoneOccupancy {
  zoneId: string
  zoneName: string
  zoneCode: string
  total: number
  occupied: number
  available: number
  occupancyRate: number
}

export interface OccupancyTrend {
  hour: string
  occupancy: number
  predicted?: number
}

export interface RevenueData {
  date: string
  revenue: number
  transactions?: number
}

export interface ParkingAnalytics {
  id: string
  parkingLotId: string
  date: Date | string
  hour?: number | null
  totalSlots: number
  occupiedSlots: number
  availableSlots: number
  occupancyRate: number
  peakOccupancy: number
  totalEntries: number
  totalExits: number
  totalRevenue: number
  transactionCount: number
  averageTicket: number
  avgDuration?: number | null
  createdAt: Date | string
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

export interface ReportConfig {
  type: ReportType
  parkingLotId?: string
  startDate: string
  endDate: string
  format: ReportFormat
}

export type ReportType = 'occupancy' | 'revenue' | 'transactions' | 'summary'
export type ReportFormat = 'pdf' | 'csv' | 'excel'

export interface Report {
  id: string
  type: ReportType
  status: 'pending' | 'processing' | 'completed' | 'failed'
  downloadUrl?: string
  createdAt: Date | string
}
