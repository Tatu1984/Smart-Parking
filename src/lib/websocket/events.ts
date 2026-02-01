// WebSocket Events
// Event emitter and handler utilities for WebSocket communication

import type { EventCallback } from './types'

// Type-safe event emitter
export class EventEmitter<Events extends { [key: string]: unknown }> {
  private listeners: Map<keyof Events, Set<EventCallback<unknown>>> = new Map()

  on<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>)

    // Return unsubscribe function
    return () => this.off(event, callback)
  }

  off<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.delete(callback as EventCallback<unknown>)
    }
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in event handler for ${String(event)}:`, error)
        }
      })
    }
  }

  once<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>): () => void {
    const onceWrapper = (data: Events[K]) => {
      this.off(event, onceWrapper)
      callback(data)
    }
    return this.on(event, onceWrapper)
  }

  removeAllListeners(event?: keyof Events): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }

  listenerCount(event: keyof Events): number {
    return this.listeners.get(event)?.size || 0
  }
}

// Event types for the parking system
export interface ParkingEvents {
  [key: string]: unknown
  // Connection
  'connection:status': { connected: boolean; reconnecting: boolean }
  'connection:error': { message: string; code?: string }

  // Slots
  'slot:occupied': { slotId: string; zoneId: string; confidence: number }
  'slot:vacated': { slotId: string; zoneId: string }
  'slot:batch': { updates: Array<{ slotId: string; isOccupied: boolean }> }

  // Tokens
  'token:created': { id: string; tokenNumber: string; parkingLotId: string }
  'token:completed': { id: string; tokenNumber: string; duration: number }
  'token:expired': { id: string; tokenNumber: string }

  // Transactions
  'payment:received': { transactionId: string; amount: number; currency: string }
  'payment:failed': { transactionId: string; reason: string }

  // Gates
  'gate:opened': { gateId: string; triggeredBy?: string }
  'gate:closed': { gateId: string }
  'gate:error': { gateId: string; message: string }

  // Analytics
  'occupancy:update': { parkingLotId: string; rate: number; available: number }
  'revenue:update': { parkingLotId: string; today: number; currency: string }

  // Notifications
  'notification:new': { id: string; type: string; title: string; message: string }

  // Cameras
  'camera:status': { cameraId: string; status: string }
  'detection:new': { cameraId: string; type: string; confidence: number }
}

// Create a global event emitter for the parking system
export const parkingEvents = new EventEmitter<ParkingEvents>()
