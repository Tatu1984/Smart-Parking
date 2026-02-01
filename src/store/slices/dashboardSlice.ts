// Dashboard Store Slice
// Manages dashboard state including selected parking lot and stats

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DashboardStats, ZoneOccupancy } from '@/types'

interface DashboardState {
  selectedParkingLotId: string | null
  stats: DashboardStats | null
  zoneOccupancy: ZoneOccupancy[]
  isLoading: boolean
  lastUpdated: Date | null
  setSelectedParkingLot: (id: string | null) => void
  setStats: (stats: DashboardStats | null) => void
  setZoneOccupancy: (zones: ZoneOccupancy[]) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

const initialState = {
  selectedParkingLotId: null,
  stats: null,
  zoneOccupancy: [],
  isLoading: false,
  lastUpdated: null,
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      ...initialState,
      setSelectedParkingLot: (id) => set({ selectedParkingLotId: id }),
      setStats: (stats) => set({ stats, lastUpdated: new Date() }),
      setZoneOccupancy: (zones) => set({ zoneOccupancy: zones }),
      setLoading: (loading) => set({ isLoading: loading }),
      reset: () => set(initialState),
    }),
    {
      name: 'dashboard-storage',
      partialize: (state) => ({ selectedParkingLotId: state.selectedParkingLotId }),
    }
  )
)
