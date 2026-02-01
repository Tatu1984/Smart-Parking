// Token Model Types
// Domain models for parking tokens and sessions

import type { VehicleType } from './ParkingLot'

export interface Token {
  id: string
  parkingLotId: string
  tokenNumber: string
  tokenType: TokenType
  qrCode?: string | null
  barcode?: string | null
  rfidTag?: string | null
  allocatedSlotId?: string | null
  vehicleId?: string | null
  licensePlate?: string | null
  vehicleType?: VehicleType | null
  entryTime: Date | string
  exitTime?: Date | string | null
  expectedDuration?: number | null
  status: TokenStatus
  entryImageUrl?: string | null
  exitImageUrl?: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

export type TokenType = 'QR_CODE' | 'RFID' | 'BARCODE' | 'ANPR' | 'MANUAL'

export type TokenStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'LOST' | 'CANCELLED'

export interface Vehicle {
  id: string
  licensePlate: string
  vehicleType: VehicleType
  make?: string | null
  model?: string | null
  color?: string | null
  ownerName?: string | null
  ownerPhone?: string | null
  ownerEmail?: string | null
  isBlacklisted: boolean
  isWhitelisted: boolean
  isVip: boolean
  membershipId?: string | null
  visitCount: number
  lastVisitAt?: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
}

// DTOs
export interface CreateTokenInput {
  parkingLotId: string
  tokenType?: TokenType
  licensePlate?: string
  vehicleType?: VehicleType
  allocatedSlotId?: string
}

export interface CompleteTokenInput {
  tokenId: string
  exitTime?: Date | string
  paymentMethod?: string
}
