// Parking Service
// Handles parking lots, zones, slots, and related operations

import { apiClient, API_ENDPOINTS } from '@/lib/api'
import type { ParkingLot, Zone, Slot, Token, PaginatedResponse } from '@/lib/api/types'

// Types for parking operations
export interface ParkingLotFilters {
  page?: number
  pageSize?: number
  status?: string
  venueType?: string
  organizationId?: string
}

export interface ZoneFilters {
  parkingLotId?: string
  status?: string
  zoneType?: string
}

export interface SlotFilters {
  parkingLotId?: string
  zoneId?: string
  status?: string
  isOccupied?: boolean
}

export interface TokenFilters {
  parkingLotId?: string
  status?: string
  startDate?: string
  endDate?: string
}

export interface ParkingLotStatus {
  totalSlots: number
  occupiedSlots: number
  availableSlots: number
  occupancyRate: number
  activeTokens: number
  zoneStats: Array<{
    zoneId: string
    zoneName: string
    total: number
    occupied: number
    available: number
  }>
}

export const parkingService = {
  // Parking Lots
  async listParkingLots(filters?: ParkingLotFilters): Promise<PaginatedResponse<ParkingLot>> {
    return apiClient.get<PaginatedResponse<ParkingLot>>(API_ENDPOINTS.PARKING_LOTS.LIST, {
      params: filters,
    })
  },

  async getParkingLotById(id: string): Promise<ParkingLot> {
    return apiClient.get<ParkingLot>(API_ENDPOINTS.PARKING_LOTS.BY_ID(id))
  },

  async getParkingLotStatus(id: string): Promise<ParkingLotStatus> {
    return apiClient.get<ParkingLotStatus>(API_ENDPOINTS.PARKING_LOTS.STATUS(id))
  },

  async getParkingLotStats(id: string): Promise<{ today: number; week: number; month: number }> {
    return apiClient.get(API_ENDPOINTS.PARKING_LOTS.STATS(id))
  },

  async createParkingLot(data: Partial<ParkingLot>): Promise<ParkingLot> {
    return apiClient.post<ParkingLot>(API_ENDPOINTS.PARKING_LOTS.CREATE, data)
  },

  async updateParkingLot(id: string, data: Partial<ParkingLot>): Promise<ParkingLot> {
    return apiClient.patch<ParkingLot>(API_ENDPOINTS.PARKING_LOTS.UPDATE(id), data)
  },

  async deleteParkingLot(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.PARKING_LOTS.DELETE(id))
  },

  // Zones
  async listZones(filters?: ZoneFilters): Promise<Zone[]> {
    return apiClient.get<Zone[]>(API_ENDPOINTS.ZONES.LIST, { params: filters })
  },

  async getZoneById(id: string): Promise<Zone> {
    return apiClient.get<Zone>(API_ENDPOINTS.ZONES.BY_ID(id))
  },

  async createZone(data: Partial<Zone>): Promise<Zone> {
    return apiClient.post<Zone>(API_ENDPOINTS.ZONES.CREATE, data)
  },

  async updateZone(id: string, data: Partial<Zone>): Promise<Zone> {
    return apiClient.patch<Zone>(API_ENDPOINTS.ZONES.UPDATE(id), data)
  },

  async deleteZone(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.ZONES.DELETE(id))
  },

  // Slots
  async listSlots(filters?: SlotFilters): Promise<Slot[]> {
    return apiClient.get<Slot[]>(API_ENDPOINTS.SLOTS.LIST, { params: filters })
  },

  async getSlotById(id: string): Promise<Slot> {
    return apiClient.get<Slot>(API_ENDPOINTS.SLOTS.BY_ID(id))
  },

  async createSlot(data: Partial<Slot>): Promise<Slot> {
    return apiClient.post<Slot>(API_ENDPOINTS.SLOTS.CREATE, data)
  },

  async updateSlot(id: string, data: Partial<Slot>): Promise<Slot> {
    return apiClient.patch<Slot>(API_ENDPOINTS.SLOTS.UPDATE(id), data)
  },

  async deleteSlot(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.SLOTS.DELETE(id))
  },

  async bulkUpdateSlots(updates: Array<{ id: string; data: Partial<Slot> }>): Promise<Slot[]> {
    return apiClient.post<Slot[]>(API_ENDPOINTS.SLOTS.BULK_UPDATE, { updates })
  },

  // Tokens
  async listTokens(filters?: TokenFilters): Promise<PaginatedResponse<Token>> {
    return apiClient.get<PaginatedResponse<Token>>(API_ENDPOINTS.TOKENS.LIST, { params: filters })
  },

  async getTokenById(id: string): Promise<Token> {
    return apiClient.get<Token>(API_ENDPOINTS.TOKENS.BY_ID(id))
  },

  async createToken(data: { parkingLotId: string; licensePlate?: string; vehicleType?: string }): Promise<Token> {
    return apiClient.post<Token>(API_ENDPOINTS.TOKENS.CREATE, data)
  },

  async completeToken(id: string): Promise<Token> {
    return apiClient.post<Token>(API_ENDPOINTS.TOKENS.COMPLETE(id))
  },

  // Find car
  async findCar(licensePlate: string): Promise<{ found: boolean; slot?: Slot; parkingLot?: ParkingLot }> {
    return apiClient.get(API_ENDPOINTS.FIND_CAR.SEARCH, { params: { licensePlate } })
  },
}
