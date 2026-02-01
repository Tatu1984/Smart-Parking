// useWebSocket Hook
// Handles WebSocket connection and real-time events

import { useEffect, useState, useCallback } from 'react'
import { wsClient, parkingEvents, ConnectionStatus } from '@/lib/websocket'
import type { ParkingEvents } from '@/lib/websocket/events'

interface UseWebSocketReturn {
  connected: boolean
  status: ConnectionStatus
  connect: () => void
  disconnect: () => void
  joinParkingLot: (parkingLotId: string) => void
  leaveParkingLot: (parkingLotId: string) => void
}

export function useWebSocket(): UseWebSocketReturn {
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')

  useEffect(() => {
    // Subscribe to connection status changes
    const unsubscribe = parkingEvents.on('connection:status', ({ connected: isConnected }) => {
      setConnected(isConnected)
      setStatus(isConnected ? 'connected' : 'disconnected')
    })

    // Connect on mount
    wsClient.connect()
    setStatus(wsClient.getStatus())
    setConnected(wsClient.isConnected())

    return () => {
      unsubscribe()
      // Don't disconnect on unmount - let the singleton manage the connection
    }
  }, [])

  const connect = useCallback(() => {
    wsClient.connect()
  }, [])

  const disconnect = useCallback(() => {
    wsClient.disconnect()
  }, [])

  const joinParkingLot = useCallback((parkingLotId: string) => {
    wsClient.joinParkingLot(parkingLotId)
  }, [])

  const leaveParkingLot = useCallback((parkingLotId: string) => {
    wsClient.leaveParkingLot(parkingLotId)
  }, [])

  return {
    connected,
    status,
    connect,
    disconnect,
    joinParkingLot,
    leaveParkingLot,
  }
}

// Hook for subscribing to specific events
interface UseRealtimeEventsOptions<K extends keyof ParkingEvents> {
  event: K
  callback: (data: ParkingEvents[K]) => void
  enabled?: boolean
}

export function useRealtimeEvent<K extends keyof ParkingEvents>(
  options: UseRealtimeEventsOptions<K>
): void {
  const { event, callback, enabled = true } = options

  useEffect(() => {
    if (!enabled) return

    const unsubscribe = parkingEvents.on(event, callback)
    return unsubscribe
  }, [event, callback, enabled])
}

// Hook for slot updates
interface UseSlotUpdatesReturn {
  lastUpdate: { slotId: string; isOccupied: boolean; timestamp: Date } | null
}

export function useSlotUpdates(parkingLotId?: string): UseSlotUpdatesReturn {
  const [lastUpdate, setLastUpdate] = useState<UseSlotUpdatesReturn['lastUpdate']>(null)

  useEffect(() => {
    if (parkingLotId) {
      wsClient.joinParkingLot(parkingLotId)
    }

    const unsubOccupied = parkingEvents.on('slot:occupied', ({ slotId }) => {
      setLastUpdate({ slotId, isOccupied: true, timestamp: new Date() })
    })

    const unsubVacated = parkingEvents.on('slot:vacated', ({ slotId }) => {
      setLastUpdate({ slotId, isOccupied: false, timestamp: new Date() })
    })

    return () => {
      unsubOccupied()
      unsubVacated()
      if (parkingLotId) {
        wsClient.leaveParkingLot(parkingLotId)
      }
    }
  }, [parkingLotId])

  return { lastUpdate }
}

// Hook for notifications
interface UseNotificationsReturn {
  notifications: Array<{ id: string; type: string; title: string; message: string; createdAt: Date }>
  clearNotifications: () => void
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<UseNotificationsReturn['notifications']>([])

  useEffect(() => {
    const unsubscribe = parkingEvents.on('notification:new', (notification) => {
      setNotifications(prev => [
        { ...notification, createdAt: new Date() },
        ...prev.slice(0, 49), // Keep last 50 notifications
      ])
    })

    return unsubscribe
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  return { notifications, clearNotifications }
}
