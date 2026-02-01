// useParking Hook
// Handles parking lot, zone, and slot operations

import { useState, useCallback, useEffect } from 'react'
import { parkingService, ParkingLotFilters, ParkingLotStatus } from '@/services/parking.service'
import type { ParkingLot, Zone, Slot, Token, PaginatedResponse } from '@/lib/api/types'

// Hook for parking lots
interface UseParkingLotsReturn {
  parkingLots: PaginatedResponse<ParkingLot> | null
  loading: boolean
  error: string | null
  fetchParkingLots: (filters?: ParkingLotFilters) => Promise<void>
  refetch: () => Promise<void>
}

export function useParkingLots(initialFilters?: ParkingLotFilters): UseParkingLotsReturn {
  const [parkingLots, setParkingLots] = useState<PaginatedResponse<ParkingLot> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState(initialFilters)

  const fetchParkingLots = useCallback(async (newFilters?: ParkingLotFilters) => {
    try {
      setLoading(true)
      setError(null)
      const appliedFilters = newFilters || filters
      if (newFilters) setFilters(newFilters)
      const data = await parkingService.listParkingLots(appliedFilters)
      setParkingLots(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch parking lots'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [filters])

  const refetch = useCallback(() => fetchParkingLots(filters), [fetchParkingLots, filters])

  useEffect(() => {
    fetchParkingLots()
  }, [])

  return {
    parkingLots,
    loading,
    error,
    fetchParkingLots,
    refetch,
  }
}

// Hook for a single parking lot
interface UseParkingLotReturn {
  parkingLot: ParkingLot | null
  status: ParkingLotStatus | null
  zones: Zone[]
  loading: boolean
  error: string | null
  fetchParkingLot: () => Promise<void>
  fetchStatus: () => Promise<void>
  fetchZones: () => Promise<void>
}

export function useParkingLot(parkingLotId: string | null): UseParkingLotReturn {
  const [parkingLot, setParkingLot] = useState<ParkingLot | null>(null)
  const [status, setStatus] = useState<ParkingLotStatus | null>(null)
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchParkingLot = useCallback(async () => {
    if (!parkingLotId) return
    try {
      setLoading(true)
      setError(null)
      const data = await parkingService.getParkingLotById(parkingLotId)
      setParkingLot(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch parking lot'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [parkingLotId])

  const fetchStatus = useCallback(async () => {
    if (!parkingLotId) return
    try {
      const data = await parkingService.getParkingLotStatus(parkingLotId)
      setStatus(data)
    } catch (err) {
      console.error('Failed to fetch parking lot status:', err)
    }
  }, [parkingLotId])

  const fetchZones = useCallback(async () => {
    if (!parkingLotId) return
    try {
      const data = await parkingService.listZones({ parkingLotId })
      setZones(data)
    } catch (err) {
      console.error('Failed to fetch zones:', err)
    }
  }, [parkingLotId])

  useEffect(() => {
    if (parkingLotId) {
      fetchParkingLot()
      fetchStatus()
      fetchZones()
    }
  }, [parkingLotId, fetchParkingLot, fetchStatus, fetchZones])

  return {
    parkingLot,
    status,
    zones,
    loading,
    error,
    fetchParkingLot,
    fetchStatus,
    fetchZones,
  }
}

// Hook for slots
interface UseSlotsReturn {
  slots: Slot[]
  loading: boolean
  error: string | null
  fetchSlots: (filters?: { parkingLotId?: string; zoneId?: string }) => Promise<void>
  updateSlot: (id: string, data: Partial<Slot>) => Promise<void>
}

export function useSlots(initialFilters?: { parkingLotId?: string; zoneId?: string }): UseSlotsReturn {
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSlots = useCallback(async (filters?: { parkingLotId?: string; zoneId?: string }) => {
    try {
      setLoading(true)
      setError(null)
      const data = await parkingService.listSlots(filters || initialFilters)
      setSlots(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch slots'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [initialFilters])

  const updateSlot = useCallback(async (id: string, data: Partial<Slot>) => {
    try {
      await parkingService.updateSlot(id, data)
      setSlots(prev => prev.map(s => s.id === id ? { ...s, ...data } : s))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update slot'
      setError(message)
      throw err
    }
  }, [])

  useEffect(() => {
    if (initialFilters) {
      fetchSlots(initialFilters)
    }
  }, [initialFilters?.parkingLotId, initialFilters?.zoneId])

  return {
    slots,
    loading,
    error,
    fetchSlots,
    updateSlot,
  }
}

// Hook for tokens
interface UseTokensReturn {
  tokens: PaginatedResponse<Token> | null
  loading: boolean
  error: string | null
  fetchTokens: (filters?: { parkingLotId?: string; status?: string }) => Promise<void>
  createToken: (data: { parkingLotId: string; licensePlate?: string }) => Promise<Token>
  completeToken: (id: string) => Promise<void>
}

export function useTokens(parkingLotId?: string): UseTokensReturn {
  const [tokens, setTokens] = useState<PaginatedResponse<Token> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTokens = useCallback(async (filters?: { parkingLotId?: string; status?: string }) => {
    try {
      setLoading(true)
      setError(null)
      const data = await parkingService.listTokens(filters || { parkingLotId })
      setTokens(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tokens'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [parkingLotId])

  const createToken = useCallback(async (data: { parkingLotId: string; licensePlate?: string }) => {
    setLoading(true)
    try {
      const token = await parkingService.createToken(data)
      // Refresh tokens list
      await fetchTokens()
      return token
    } finally {
      setLoading(false)
    }
  }, [fetchTokens])

  const completeToken = useCallback(async (id: string) => {
    try {
      await parkingService.completeToken(id)
      await fetchTokens()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete token'
      setError(message)
      throw err
    }
  }, [fetchTokens])

  useEffect(() => {
    if (parkingLotId) {
      fetchTokens({ parkingLotId })
    }
  }, [parkingLotId, fetchTokens])

  return {
    tokens,
    loading,
    error,
    fetchTokens,
    createToken,
    completeToken,
  }
}
