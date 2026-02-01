// WebSocket Types
// Type definitions for WebSocket events and messages

// Connection status
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

// Detection event from AI pipeline
export interface DetectionEvent {
  cameraId: string
  slotId?: string
  eventType: 'VEHICLE_DETECTED' | 'VEHICLE_ENTERED_SLOT' | 'VEHICLE_LEFT_SLOT' | 'SLOT_OCCUPIED' | 'SLOT_VACATED' | 'LICENSE_PLATE_READ' | 'ANOMALY_DETECTED'
  confidence: number
  vehicleType?: string
  vehicleColor?: string
  licensePlate?: string
  timestamp: string
}

// Slot status update
export interface SlotStatusUpdate {
  slotId: string
  zoneId: string
  parkingLotId: string
  isOccupied: boolean
  confidence: number
  vehicleType?: string
  timestamp: string
}

// Token event
export interface TokenEvent {
  type: 'TOKEN_CREATED' | 'TOKEN_COMPLETED' | 'TOKEN_CANCELLED'
  token: {
    id: string
    tokenNumber: string
    parkingLotId: string
    entryTime: string
    exitTime?: string
    licensePlate?: string
    status: string
  }
}

// Transaction event
export interface TransactionEvent {
  type: 'TRANSACTION_CREATED' | 'TRANSACTION_COMPLETED' | 'PAYMENT_RECEIVED'
  transaction: {
    id: string
    tokenId: string
    parkingLotId: string
    amount: number
    currency: string
    status: string
  }
}

// Gate event
export interface GateEvent {
  type: 'GATE_OPENED' | 'GATE_CLOSED' | 'GATE_ERROR'
  gateId: string
  parkingLotId: string
  action: string
  triggeredBy?: string
}

// Analytics update
export interface AnalyticsUpdate {
  parkingLotId: string
  occupancyRate: number
  availableSlots: number
  occupiedSlots: number
  timestamp: string
}

// Notification
export interface RealtimeNotification {
  id: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
  createdAt: string
}

// All event types
export type WebSocketEvent =
  | { event: 'detection'; data: DetectionEvent }
  | { event: 'slot:status'; data: SlotStatusUpdate }
  | { event: 'token:update'; data: TokenEvent }
  | { event: 'transaction:update'; data: TransactionEvent }
  | { event: 'gate:event'; data: GateEvent }
  | { event: 'analytics:update'; data: AnalyticsUpdate }
  | { event: 'notification'; data: RealtimeNotification }

// Event callback types
export type EventCallback<T = unknown> = (data: T) => void

// WebSocket event names
export const WS_EVENTS = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  RECONNECT: 'reconnect',
  RECONNECT_ATTEMPT: 'reconnect_attempt',

  // Business events
  DETECTION: 'detection',
  SLOT_STATUS: 'slot:status',
  TOKEN_UPDATE: 'token:update',
  TRANSACTION_UPDATE: 'transaction:update',
  GATE_EVENT: 'gate:event',
  ANALYTICS_UPDATE: 'analytics:update',
  NOTIFICATION: 'notification',

  // Room events
  JOIN_ROOM: 'join:room',
  LEAVE_ROOM: 'leave:room',
} as const
