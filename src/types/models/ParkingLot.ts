// ParkingLot Model Types
// Domain models for parking-related entities

export interface ParkingLot {
  id: string
  organizationId: string
  name: string
  slug: string
  venueType: VenueType
  address?: string | null
  city?: string | null
  state?: string | null
  country: string
  currency: string
  postalCode?: string | null
  latitude?: number | null
  longitude?: number | null
  timezone: string
  status: ParkingLotStatus
  totalSlots: number
  operatingHours?: Record<string, { open: string; close: string }> | null
  hasEvCharging: boolean
  hasValetService: boolean
  hasMultiLevel: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

export type VenueType =
  | 'AIRPORT'
  | 'MALL'
  | 'CINEMA'
  | 'COMMERCIAL'
  | 'HOSPITAL'
  | 'STADIUM'
  | 'HOTEL'
  | 'RESIDENTIAL'
  | 'OTHER'

export type ParkingLotStatus = 'ACTIVE' | 'MAINTENANCE' | 'CLOSED' | 'COMING_SOON'

export interface Zone {
  id: string
  parkingLotId: string
  name: string
  code: string
  level: number
  zoneType: ZoneType
  description?: string | null
  color: string
  sortOrder: number
  status: ZoneStatus
  createdAt: Date | string
  updatedAt: Date | string
}

export type ZoneType =
  | 'GENERAL'
  | 'VIP'
  | 'EV_CHARGING'
  | 'DISABLED'
  | 'STAFF'
  | 'VISITOR'
  | 'SHORT_TERM'
  | 'LONG_TERM'
  | 'TWO_WHEELER'
  | 'VALET'
  | 'RESERVED'

export type ZoneStatus = 'ACTIVE' | 'MAINTENANCE' | 'CLOSED'

export interface Slot {
  id: string
  zoneId: string
  slotNumber: string
  positionX: number
  positionY: number
  width: number
  height: number
  rotation: number
  detectionBounds?: Record<string, number> | null
  cameraId?: string | null
  slotType: SlotType
  vehicleType: VehicleType
  status: SlotStatus
  isOccupied: boolean
  confidence: number
  lastDetectedAt?: Date | string | null
  hasEvCharger: boolean
  hasRoof: boolean
  isAccessible: boolean
  isUnderMaintenance: boolean
  maintenanceNote?: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

export type SlotType =
  | 'STANDARD'
  | 'COMPACT'
  | 'LARGE'
  | 'HANDICAPPED'
  | 'EV_CHARGING'
  | 'MOTORCYCLE'
  | 'VIP'
  | 'RESERVED'

export type VehicleType =
  | 'CAR'
  | 'SUV'
  | 'MOTORCYCLE'
  | 'BUS'
  | 'TRUCK'
  | 'VAN'
  | 'BICYCLE'
  | 'ANY'

export type SlotStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE' | 'BLOCKED'

// DTOs
export interface CreateParkingLotInput {
  organizationId: string
  name: string
  slug: string
  venueType: VenueType
  address?: string
  city?: string
  state?: string
  country?: string
  currency?: string
  timezone?: string
}

export interface CreateZoneInput {
  parkingLotId: string
  name: string
  code: string
  level?: number
  zoneType?: ZoneType
  color?: string
}

export interface CreateSlotInput {
  zoneId: string
  slotNumber: string
  slotType?: SlotType
  vehicleType?: VehicleType
}
