// API Types
// Type definitions for API requests and responses

// Generic API Response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Paginated response
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

// API Error
export interface ApiError {
  status: number
  message: string
  code?: string
  details?: Record<string, unknown>
}

// Request configuration
export interface RequestConfig {
  headers?: Record<string, string>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Record<string, any>
  timeout?: number
  signal?: AbortSignal
}

// Auth Types
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: {
    id: string
    email: string
    name: string
    role: string
    organization: {
      id: string
      name: string
      slug: string
    }
    assignedLots: Array<{
      id: string
      name: string
      slug: string
    }>
  }
}

export interface MicrosoftLoginRequest {
  idToken: string
}

// User Types
export interface UserProfile {
  id: string
  email: string
  name: string
  phone?: string
  avatar?: string
  role: string
  status: string
  organizationId: string
  createdAt: string
  updatedAt: string
}

// Parking Types
export interface ParkingLot {
  id: string
  name: string
  slug: string
  venueType: string
  address?: string
  city?: string
  state?: string
  country: string
  currency: string
  totalSlots: number
  status: string
  organizationId: string
}

export interface Zone {
  id: string
  parkingLotId: string
  name: string
  code: string
  level: number
  zoneType: string
  status: string
  color: string
}

export interface Slot {
  id: string
  zoneId: string
  slotNumber: string
  slotType: string
  vehicleType: string
  status: string
  isOccupied: boolean
  confidence: number
}

// Token Types
export interface Token {
  id: string
  parkingLotId: string
  tokenNumber: string
  tokenType: string
  status: string
  entryTime: string
  exitTime?: string
  licensePlate?: string
  vehicleType?: string
}

// Transaction Types
export interface Transaction {
  id: string
  parkingLotId: string
  tokenId: string
  entryTime: string
  exitTime?: string
  duration?: number
  grossAmount: number
  discount: number
  tax: number
  netAmount: number
  currency: string
  paymentStatus: string
  paymentMethod?: string
}

// Analytics Types
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

export interface OccupancyTrend {
  hour: string
  occupancy: number
}

export interface RevenueData {
  date: string
  revenue: number
}

// Wallet Types
export interface Wallet {
  id: string
  balance: bigint
  currency: string
  walletType: string
  status: string
  isVerified: boolean
  kycLevel: string
}

export interface WalletTransaction {
  id: string
  amount: bigint
  currency: string
  txnType: string
  status: string
  description?: string
  createdAt: string
}

// Camera Types
export interface Camera {
  id: string
  parkingLotId: string
  zoneId?: string
  name: string
  rtspUrl: string
  status: string
  lastPingAt?: string
}
