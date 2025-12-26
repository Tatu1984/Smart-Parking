'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

export interface ParkingEvent {
  type: 'VEHICLE_ENTRY' | 'VEHICLE_EXIT' | 'SLOT_UPDATE' | 'PAYMENT' | 'ALERT' | 'CAMERA_STATUS'
  payload: Record<string, unknown>
  timestamp: string
  parkingLotId?: string
  zoneId?: string
}

export interface WalletEvent {
  type: 'BALANCE_UPDATE' | 'TRANSACTION' | 'DEPOSIT' | 'WITHDRAWAL' | 'PAYMENT_RECEIVED' | 'PAYMENT_SENT'
  payload: Record<string, unknown>
  timestamp: string
  walletId: string
}

interface UseSocketOptions {
  autoConnect?: boolean
  token?: string
  parkingLotId?: string
  walletId?: string
}

export function useSocket(options: UseSocketOptions = {}) {
  const { autoConnect = true, token, parkingLotId, walletId } = options
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const listenersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map())

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin

    socketRef.current = io(socketUrl, {
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    socketRef.current.on('connect', () => {
      setConnected(true)
      setError(null)

      // Auto-join rooms if IDs provided
      if (parkingLotId) {
        socketRef.current?.emit('join:parking-lot', parkingLotId)
      }
      if (walletId) {
        socketRef.current?.emit('join:wallet', walletId)
      }
    })

    socketRef.current.on('disconnect', () => {
      setConnected(false)
    })

    socketRef.current.on('connect_error', (err) => {
      setError(err.message)
      setConnected(false)
    })

    socketRef.current.on('error', (data: { message: string }) => {
      setError(data.message)
    })
  }, [token, parkingLotId, walletId])

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [])

  const joinParkingLot = useCallback((lotId: string) => {
    socketRef.current?.emit('join:parking-lot', lotId)
  }, [])

  const leaveParkingLot = useCallback((lotId: string) => {
    socketRef.current?.emit('leave:parking-lot', lotId)
  }, [])

  const joinZone = useCallback((zoneId: string) => {
    socketRef.current?.emit('join:zone', zoneId)
  }, [])

  const leaveZone = useCallback((zoneId: string) => {
    socketRef.current?.emit('leave:zone', zoneId)
  }, [])

  const joinWallet = useCallback((walletId: string) => {
    socketRef.current?.emit('join:wallet', walletId)
  }, [])

  const leaveWallet = useCallback((walletId: string) => {
    socketRef.current?.emit('leave:wallet', walletId)
  }, [])

  const on = useCallback(<T = unknown>(event: string, callback: (data: T) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set())
    }
    listenersRef.current.get(event)?.add(callback as (data: unknown) => void)

    socketRef.current?.on(event, callback as (data: unknown) => void)

    return () => {
      listenersRef.current.get(event)?.delete(callback as (data: unknown) => void)
      socketRef.current?.off(event, callback as (data: unknown) => void)
    }
  }, [])

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data)
  }, [])

  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  return {
    socket: socketRef.current,
    connected,
    error,
    connect,
    disconnect,
    joinParkingLot,
    leaveParkingLot,
    joinZone,
    leaveZone,
    joinWallet,
    leaveWallet,
    on,
    emit,
  }
}

// Hook specifically for parking lot real-time updates
export function useParkingUpdates(parkingLotId?: string) {
  const [events, setEvents] = useState<ParkingEvent[]>([])
  const [latestEvent, setLatestEvent] = useState<ParkingEvent | null>(null)
  const { connected, error, on, joinParkingLot, leaveParkingLot } = useSocket({
    parkingLotId,
  })

  useEffect(() => {
    const unsubscribe = on<ParkingEvent>('parking:event', (event) => {
      setLatestEvent(event)
      setEvents((prev) => [event, ...prev.slice(0, 99)]) // Keep last 100 events
    })

    return unsubscribe
  }, [on])

  useEffect(() => {
    if (parkingLotId) {
      joinParkingLot(parkingLotId)
      return () => leaveParkingLot(parkingLotId)
    }
  }, [parkingLotId, joinParkingLot, leaveParkingLot])

  const clearEvents = useCallback(() => {
    setEvents([])
    setLatestEvent(null)
  }, [])

  return {
    connected,
    error,
    events,
    latestEvent,
    clearEvents,
  }
}

// Hook specifically for wallet real-time updates
export function useWalletUpdates(walletId?: string, token?: string) {
  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<WalletEvent[]>([])
  const [latestEvent, setLatestEvent] = useState<WalletEvent | null>(null)
  const { connected, error, on, joinWallet, leaveWallet } = useSocket({
    walletId,
    token,
  })

  useEffect(() => {
    const unsubscribe = on<WalletEvent>('wallet:event', (event) => {
      setLatestEvent(event)

      if (event.type === 'BALANCE_UPDATE') {
        const payload = event.payload as { newBalance: number }
        setBalance(payload.newBalance)
      }

      setTransactions((prev) => [event, ...prev.slice(0, 49)]) // Keep last 50 transactions
    })

    return unsubscribe
  }, [on])

  useEffect(() => {
    if (walletId) {
      joinWallet(walletId)
      return () => leaveWallet(walletId)
    }
  }, [walletId, joinWallet, leaveWallet])

  return {
    connected,
    error,
    balance,
    transactions,
    latestEvent,
  }
}

// Hook for live slot updates on parking map
export function useLiveSlotUpdates(parkingLotId?: string, zoneId?: string) {
  const [slots, setSlots] = useState<Map<string, {
    status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE'
    vehiclePlate?: string
    updatedAt: string
  }>>(new Map())

  const { connected, error, on, joinParkingLot, joinZone, leaveZone } = useSocket({
    parkingLotId,
  })

  useEffect(() => {
    const unsubscribe = on<ParkingEvent>('parking:event', (event) => {
      if (event.type === 'SLOT_UPDATE') {
        const payload = event.payload as {
          slotId: string
          status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE'
          vehiclePlate?: string
        }

        setSlots((prev) => {
          const newSlots = new Map(prev)
          newSlots.set(payload.slotId, {
            status: payload.status,
            vehiclePlate: payload.vehiclePlate,
            updatedAt: event.timestamp,
          })
          return newSlots
        })
      }
    })

    return unsubscribe
  }, [on])

  useEffect(() => {
    if (zoneId) {
      joinZone(zoneId)
      return () => leaveZone(zoneId)
    }
  }, [zoneId, joinZone, leaveZone])

  const getSlotStatus = useCallback((slotId: string) => {
    return slots.get(slotId)
  }, [slots])

  return {
    connected,
    error,
    slots,
    getSlotStatus,
  }
}
