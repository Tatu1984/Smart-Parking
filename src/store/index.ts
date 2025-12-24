import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DashboardStats, ZoneOccupancy } from '@/types'

// Auth Store
interface AuthState {
  user: {
    id: string
    email: string
    name: string
    role: string
    organization: { id: string; name: string; slug: string }
    assignedLots: { id: string; name: string; slug: string }[]
  } | null
  token: string | null
  isAuthenticated: boolean
  setUser: (user: AuthState['user'], token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setUser: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
)

// Dashboard Store
interface DashboardState {
  selectedParkingLotId: string | null
  stats: DashboardStats | null
  zoneOccupancy: ZoneOccupancy[]
  isLoading: boolean
  lastUpdated: Date | null
  setSelectedParkingLot: (id: string) => void
  setStats: (stats: DashboardStats) => void
  setZoneOccupancy: (zones: ZoneOccupancy[]) => void
  setLoading: (loading: boolean) => void
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      selectedParkingLotId: null,
      stats: null,
      zoneOccupancy: [],
      isLoading: false,
      lastUpdated: null,
      setSelectedParkingLot: (id) => set({ selectedParkingLotId: id }),
      setStats: (stats) => set({ stats, lastUpdated: new Date() }),
      setZoneOccupancy: (zones) => set({ zoneOccupancy: zones }),
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'dashboard-storage',
      partialize: (state) => ({ selectedParkingLotId: state.selectedParkingLotId }),
    }
  )
)

// UI Store
interface UIState {
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  theme: 'light' | 'dark' | 'system'
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarCollapsed: false,
      theme: 'system',
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ui-storage',
    }
  )
)

// Realtime Store for live updates
interface RealtimeState {
  connected: boolean
  events: Array<{
    id: string
    type: string
    data: any
    timestamp: Date
  }>
  setConnected: (connected: boolean) => void
  addEvent: (event: { type: string; data: any }) => void
  clearEvents: () => void
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  connected: false,
  events: [],
  setConnected: (connected) => set({ connected }),
  addEvent: (event) =>
    set((state) => ({
      events: [
        { ...event, id: crypto.randomUUID(), timestamp: new Date() },
        ...state.events.slice(0, 99), // Keep last 100 events
      ],
    })),
  clearEvents: () => set({ events: [] }),
}))
