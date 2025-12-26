// Socket.IO server utilities for real-time updates
// Note: The actual socket server initialization happens in a custom server.js file
// These emit functions are safe to call from API routes - they will be no-ops if the socket server isn't running

export interface ParkingEvent {
  type: 'VEHICLE_ENTRY' | 'VEHICLE_EXIT' | 'SLOT_UPDATE' | 'PAYMENT' | 'ALERT' | 'CAMERA_STATUS'
  payload: Record<string, unknown>
  timestamp: Date
  parkingLotId?: string
  zoneId?: string
}

export interface WalletEvent {
  type: 'BALANCE_UPDATE' | 'TRANSACTION' | 'DEPOSIT' | 'WITHDRAWAL' | 'PAYMENT_RECEIVED' | 'PAYMENT_SENT'
  payload: Record<string, unknown>
  timestamp: Date
  walletId: string
}

// Global reference to socket server (set by custom server)
declare global {
  // eslint-disable-next-line no-var
  var socketIO: any | undefined
}

function getIO() {
  return global.socketIO || null
}

// Emit parking event to relevant rooms
export function emitParkingEvent(event: ParkingEvent) {
  const io = getIO()
  if (!io) return

  const eventData = {
    ...event,
    timestamp: event.timestamp.toISOString(),
  }

  // Emit to specific parking lot room
  if (event.parkingLotId) {
    io.to(`parking-lot:${event.parkingLotId}`).emit('parking:event', eventData)
  }

  // Emit to specific zone room
  if (event.zoneId) {
    io.to(`zone:${event.zoneId}`).emit('parking:event', eventData)
  }

  // Emit to global dashboard listeners
  io.emit('parking:global', eventData)
}

// Emit wallet event to specific wallet room
export function emitWalletEvent(event: WalletEvent) {
  const io = getIO()
  if (!io) return

  const eventData = {
    ...event,
    timestamp: event.timestamp.toISOString(),
  }

  io.to(`wallet:${event.walletId}`).emit('wallet:event', eventData)
}

// Emit slot update for live parking map
export function emitSlotUpdate(parkingLotId: string, zoneId: string, slotData: {
  slotId: string
  slotNumber: string
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE'
  vehiclePlate?: string
}) {
  emitParkingEvent({
    type: 'SLOT_UPDATE',
    payload: slotData,
    timestamp: new Date(),
    parkingLotId,
    zoneId,
  })
}

// Emit vehicle entry event
export function emitVehicleEntry(parkingLotId: string, zoneId: string, data: {
  tokenId: string
  vehiclePlate: string
  slotNumber: string
  entryTime: Date
  vehicleType: string
}) {
  emitParkingEvent({
    type: 'VEHICLE_ENTRY',
    payload: data,
    timestamp: new Date(),
    parkingLotId,
    zoneId,
  })
}

// Emit vehicle exit event
export function emitVehicleExit(parkingLotId: string, zoneId: string, data: {
  tokenId: string
  vehiclePlate: string
  slotNumber: string
  exitTime: Date
  duration: number
  amount: number
}) {
  emitParkingEvent({
    type: 'VEHICLE_EXIT',
    payload: data,
    timestamp: new Date(),
    parkingLotId,
    zoneId,
  })
}

// Emit payment event
export function emitPaymentEvent(parkingLotId: string, data: {
  transactionId: string
  tokenId: string
  amount: number
  method: string
  status: string
}) {
  emitParkingEvent({
    type: 'PAYMENT',
    payload: data,
    timestamp: new Date(),
    parkingLotId,
  })
}

// Emit camera status change
export function emitCameraStatus(parkingLotId: string, zoneId: string, data: {
  cameraId: string
  cameraName: string
  status: 'ONLINE' | 'OFFLINE' | 'ERROR'
}) {
  emitParkingEvent({
    type: 'CAMERA_STATUS',
    payload: data,
    timestamp: new Date(),
    parkingLotId,
    zoneId,
  })
}

// Emit alert
export function emitAlert(parkingLotId: string, data: {
  alertType: 'HIGH_OCCUPANCY' | 'CAMERA_OFFLINE' | 'PAYMENT_FAILED' | 'SECURITY' | 'SYSTEM'
  message: string
  severity: 'info' | 'warning' | 'error'
  zoneId?: string
}) {
  emitParkingEvent({
    type: 'ALERT',
    payload: data,
    timestamp: new Date(),
    parkingLotId,
    zoneId: data.zoneId,
  })
}

// Emit wallet balance update
export function emitBalanceUpdate(walletId: string, data: {
  newBalance: number
  currency: string
  changeAmount: number
  changeType: 'credit' | 'debit'
}) {
  emitWalletEvent({
    type: 'BALANCE_UPDATE',
    payload: data,
    timestamp: new Date(),
    walletId,
  })
}

// Emit wallet transaction
export function emitWalletTransaction(walletId: string, data: {
  transactionId: string
  amount: number
  txnType: string
  status: string
  description: string
  counterparty?: string
}) {
  emitWalletEvent({
    type: 'TRANSACTION',
    payload: data,
    timestamp: new Date(),
    walletId,
  })
}
