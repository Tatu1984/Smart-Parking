// Realtime Store Slice
// Manages real-time connection state and events

import { create } from 'zustand'
import type { ConnectionStatus } from '@/lib/websocket/types'

interface RealtimeEvent {
  id: string
  type: string
  data: unknown
  timestamp: Date
}

interface RealtimeState {
  // Connection
  connected: boolean
  status: ConnectionStatus
  reconnectAttempts: number
  setConnected: (connected: boolean) => void
  setStatus: (status: ConnectionStatus) => void
  setReconnectAttempts: (attempts: number) => void

  // Events
  events: RealtimeEvent[]
  addEvent: (event: { type: string; data: unknown }) => void
  clearEvents: () => void

  // Subscriptions
  subscribedRooms: Set<string>
  addRoom: (room: string) => void
  removeRoom: (room: string) => void
  clearRooms: () => void
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  // Connection
  connected: false,
  status: 'disconnected',
  reconnectAttempts: 0,
  setConnected: (connected) => set({ connected }),
  setStatus: (status) => set({ status }),
  setReconnectAttempts: (attempts) => set({ reconnectAttempts: attempts }),

  // Events
  events: [],
  addEvent: (event) =>
    set((state) => ({
      events: [
        { ...event, id: crypto.randomUUID(), timestamp: new Date() },
        ...state.events.slice(0, 99), // Keep last 100 events
      ],
    })),
  clearEvents: () => set({ events: [] }),

  // Subscriptions
  subscribedRooms: new Set(),
  addRoom: (room) =>
    set((state) => ({
      subscribedRooms: new Set([...state.subscribedRooms, room]),
    })),
  removeRoom: (room) =>
    set((state) => {
      const rooms = new Set(state.subscribedRooms)
      rooms.delete(room)
      return { subscribedRooms: rooms }
    }),
  clearRooms: () => set({ subscribedRooms: new Set() }),
}))
