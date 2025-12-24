// Re-export Prisma types
export type {
  Organization,
  OrganizationSettings,
  User,
  Session,
  ParkingLot,
  Zone,
  Slot,
  SlotOccupancy,
  Camera,
  Gate,
  GateEvent,
  Display,
  Token,
  Vehicle,
  PricingRule,
  Transaction,
  DetectionEvent,
  ParkingAnalytics,
  AuditLog,
  SystemConfig,
  AlertRule,
} from '@prisma/client'

export {
  UserRole,
  UserStatus,
  VenueType,
  ParkingLotStatus,
  ZoneType,
  ZoneStatus,
  SlotType,
  VehicleType,
  SlotStatus,
  CameraStatus,
  GateType,
  GateStatus,
  GateAction,
  DisplayType,
  DisplayStatus,
  TokenType,
  TokenStatus,
  PricingModel,
  PaymentStatus,
  PaymentMethod,
  DetectionEventType,
} from '@prisma/client'

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Dashboard Types
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
}

export interface OccupancyTrend {
  timestamp: string
  occupancyRate: number
  occupied: number
  available: number
}

export interface RevenueData {
  date: string
  revenue: number
  transactions: number
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

// Real-time Event Types
export interface SlotUpdateEvent {
  type: 'SLOT_UPDATE'
  slotId: string
  zoneId: string
  parkingLotId: string
  isOccupied: boolean
  confidence: number
  timestamp: string
}

export interface TokenEvent {
  type: 'TOKEN_CREATED' | 'TOKEN_COMPLETED' | 'TOKEN_EXPIRED'
  tokenId: string
  tokenNumber: string
  parkingLotId: string
  timestamp: string
}

export interface CameraStatusEvent {
  type: 'CAMERA_STATUS'
  cameraId: string
  status: 'ONLINE' | 'OFFLINE' | 'ERROR'
  timestamp: string
}

export interface GateEventData {
  type: 'GATE_EVENT'
  gateId: string
  action: 'OPENED' | 'CLOSED'
  tokenId?: string
  timestamp: string
}

export type RealtimeEvent = SlotUpdateEvent | TokenEvent | CameraStatusEvent | GateEventData

// Slot Allocation Types
export interface SlotAllocationRequest {
  parkingLotId: string
  vehicleType?: string
  preferredZoneType?: string
  isAccessible?: boolean
  needsEvCharging?: boolean
}

export interface SlotAllocationResult {
  success: boolean
  slot?: {
    id: string
    slotNumber: string
    zoneName: string
    zoneCode: string
    level: number
    directions?: string
  }
  reason?: string
}

// Detection Event from AI Pipeline
export interface AIDetectionEvent {
  cameraId: string
  timestamp: string
  eventType: string
  objectType: string
  confidence: number
  bbox: {
    x: number
    y: number
    width: number
    height: number
  }
  trackingId?: string
  vehicleType?: string
  vehicleColor?: string
  licensePlate?: string
  frameUrl?: string
}

// Map/Visual Editor Types
export interface SlotPosition {
  id: string
  slotNumber: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  isOccupied: boolean
  status: string
}

export interface ZoneLayout {
  id: string
  name: string
  code: string
  level: number
  color: string
  slots: SlotPosition[]
}

export interface ParkingLotLayout {
  id: string
  name: string
  zones: ZoneLayout[]
}
