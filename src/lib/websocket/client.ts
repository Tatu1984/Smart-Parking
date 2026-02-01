// WebSocket Client
// Real-time communication client using Socket.IO

import { io, Socket } from 'socket.io-client'
import { getWebSocketUrl } from '@/config/api.config'
import { APP_CONFIG } from '@/config/app.config'
import { WS_EVENTS, ConnectionStatus } from './types'
import { parkingEvents } from './events'

class WebSocketClient {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = APP_CONFIG.REALTIME_MAX_RECONNECT_ATTEMPTS
  private reconnectDelay = APP_CONFIG.REALTIME_RECONNECT_DELAY_MS
  private connectionStatus: ConnectionStatus = 'disconnected'
  private rooms: Set<string> = new Set()

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.connectionStatus
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionStatus === 'connected' && this.socket?.connected === true
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket
    }

    this.connectionStatus = 'connecting'

    this.socket = io(getWebSocketUrl(), {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: this.reconnectDelay * 4,
      reconnectionAttempts: this.maxReconnectAttempts,
      withCredentials: true, // Send cookies for authentication
    })

    this.setupEventHandlers()
    return this.socket
  }

  /**
   * Setup internal event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return

    this.socket.on(WS_EVENTS.CONNECT, () => {
      console.log('[WS] Connected')
      this.connectionStatus = 'connected'
      this.reconnectAttempts = 0

      // Rejoin rooms after reconnection
      this.rooms.forEach(room => {
        this.socket?.emit(WS_EVENTS.JOIN_ROOM, room)
      })

      parkingEvents.emit('connection:status', { connected: true, reconnecting: false })
    })

    this.socket.on(WS_EVENTS.DISCONNECT, (reason) => {
      console.log('[WS] Disconnected:', reason)
      this.connectionStatus = 'disconnected'
      parkingEvents.emit('connection:status', { connected: false, reconnecting: true })
    })

    this.socket.on(WS_EVENTS.CONNECT_ERROR, (error) => {
      console.error('[WS] Connection error:', error.message)
      this.connectionStatus = 'error'
      parkingEvents.emit('connection:error', { message: error.message })
    })

    this.socket.on(WS_EVENTS.RECONNECT_ATTEMPT, (attempt) => {
      console.log(`[WS] Reconnect attempt ${attempt}/${this.maxReconnectAttempts}`)
      this.reconnectAttempts = attempt
      this.connectionStatus = 'connecting'
    })

    // Business events
    this.socket.on(WS_EVENTS.SLOT_STATUS, (data) => {
      if (data.isOccupied) {
        parkingEvents.emit('slot:occupied', {
          slotId: data.slotId,
          zoneId: data.zoneId,
          confidence: data.confidence,
        })
      } else {
        parkingEvents.emit('slot:vacated', {
          slotId: data.slotId,
          zoneId: data.zoneId,
        })
      }
    })

    this.socket.on(WS_EVENTS.TOKEN_UPDATE, (data) => {
      if (data.type === 'TOKEN_CREATED') {
        parkingEvents.emit('token:created', {
          id: data.token.id,
          tokenNumber: data.token.tokenNumber,
          parkingLotId: data.token.parkingLotId,
        })
      } else if (data.type === 'TOKEN_COMPLETED') {
        parkingEvents.emit('token:completed', {
          id: data.token.id,
          tokenNumber: data.token.tokenNumber,
          duration: 0, // Calculate from entry/exit time
        })
      }
    })

    this.socket.on(WS_EVENTS.ANALYTICS_UPDATE, (data) => {
      parkingEvents.emit('occupancy:update', {
        parkingLotId: data.parkingLotId,
        rate: data.occupancyRate,
        available: data.availableSlots,
      })
    })

    this.socket.on(WS_EVENTS.NOTIFICATION, (data) => {
      parkingEvents.emit('notification:new', {
        id: data.id,
        type: data.type,
        title: data.title,
        message: data.message,
      })
    })
  }

  /**
   * Subscribe to a specific event
   */
  on<T = unknown>(event: string, callback: (data: T) => void): void {
    this.socket?.on(event, callback)
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback?: (...args: unknown[]) => void): void {
    this.socket?.off(event, callback)
  }

  /**
   * Emit an event
   */
  emit(event: string, data?: unknown): void {
    this.socket?.emit(event, data)
  }

  /**
   * Join a room for scoped updates
   */
  joinRoom(room: string): void {
    this.rooms.add(room)
    if (this.socket?.connected) {
      this.socket.emit(WS_EVENTS.JOIN_ROOM, room)
    }
  }

  /**
   * Leave a room
   */
  leaveRoom(room: string): void {
    this.rooms.delete(room)
    if (this.socket?.connected) {
      this.socket.emit(WS_EVENTS.LEAVE_ROOM, room)
    }
  }

  /**
   * Join a parking lot room for updates
   */
  joinParkingLot(parkingLotId: string): void {
    this.joinRoom(`parking-lot:${parkingLotId}`)
  }

  /**
   * Leave a parking lot room
   */
  leaveParkingLot(parkingLotId: string): void {
    this.leaveRoom(`parking-lot:${parkingLotId}`)
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.rooms.clear()
      this.socket.disconnect()
      this.socket = null
      this.connectionStatus = 'disconnected'
    }
  }
}

// Singleton instance
export const wsClient = new WebSocketClient()
