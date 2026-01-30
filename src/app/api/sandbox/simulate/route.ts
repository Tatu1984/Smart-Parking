/**
 * Sandbox Event Simulation API
 * Generates simulated parking events for demo/testing
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db'
import { isSandboxMode, getSandboxConfig, DEMO_VEHICLES } from '@/lib/sandbox'
import { v4 as uuid } from 'uuid'
import { logger } from '@/lib/logger'

// POST /api/sandbox/simulate - Simulate parking events
export async function POST(request: NextRequest) {
  if (!isSandboxMode()) {
    return NextResponse.json(
      { error: 'Sandbox mode is not enabled' },
      { status: 400 }
    )
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { eventType, parkingLotId, count = 1 } = body

    const results: object[] = []

    switch (eventType) {
      case 'vehicle_entry':
        for (let i = 0; i < Math.min(count, 10); i++) {
          const result = await simulateVehicleEntry(parkingLotId)
          results.push(result)
        }
        break

      case 'vehicle_exit':
        for (let i = 0; i < Math.min(count, 10); i++) {
          const result = await simulateVehicleExit(parkingLotId)
          results.push(result)
        }
        break

      case 'detection':
        for (let i = 0; i < Math.min(count, 50); i++) {
          const result = await simulateDetectionEvent(parkingLotId)
          results.push(result)
        }
        break

      case 'camera_status':
        const result = await simulateCameraStatusChange(parkingLotId)
        results.push(result)
        break

      case 'occupancy_update':
        const occupancyResult = await simulateOccupancyUpdate(parkingLotId)
        results.push(occupancyResult)
        break

      case 'gate_event':
        const gateResult = await simulateGateEvent(parkingLotId, body.gateId, body.action)
        results.push(gateResult)
        break

      default:
        return NextResponse.json(
          { error: `Unknown event type: ${eventType}` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      eventType,
      count: results.length,
      results,
      sandbox: true,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Simulation error:', error instanceof Error ? error : undefined)
    return NextResponse.json(
      {
        success: false,
        error: 'Simulation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

async function simulateVehicleEntry(parkingLotId: string) {
  // Find available slot
  const availableSlot = await prisma.slot.findFirst({
    where: {
      zone: { parkingLotId },
      isOccupied: false,
      status: 'AVAILABLE',
    },
    include: { zone: true },
  })

  if (!availableSlot) {
    return { success: false, message: 'No available slots' }
  }

  const vehicle = DEMO_VEHICLES[Math.floor(Math.random() * DEMO_VEHICLES.length)]
  const tokenNumber = `SIM-${Date.now()}-${Math.floor(Math.random() * 1000)}`

  // Create token
  const token = await prisma.token.create({
    data: {
      parkingLotId,
      tokenNumber,
      tokenType: 'QR_CODE',
      qrCode: `QR-${tokenNumber}`,
      allocatedSlotId: availableSlot.id,
      licensePlate: vehicle.plate,
      vehicleType: vehicle.type as any,
      entryTime: new Date(),
      status: 'ACTIVE',
    },
  })

  // Update slot
  await prisma.slot.update({
    where: { id: availableSlot.id },
    data: {
      isOccupied: true,
      confidence: 0.92 + Math.random() * 0.08,
      lastDetectedAt: new Date(),
    },
  })

  // Create detection event
  const camera = await prisma.camera.findFirst({
    where: { zoneId: availableSlot.zoneId },
  })

  if (camera) {
    await prisma.detectionEvent.create({
      data: {
        cameraId: camera.id,
        eventType: 'VEHICLE_ENTERED_SLOT',
        objectType: 'vehicle',
        confidence: 0.94,
        bbox: { x: 0.2, y: 0.3, width: 0.15, height: 0.2 },
        vehicleType: vehicle.type,
        vehicleColor: vehicle.color,
        licensePlate: vehicle.plate,
      },
    })
  }

  return {
    success: true,
    event: 'vehicle_entry',
    token: {
      id: token.id,
      number: tokenNumber,
      licensePlate: vehicle.plate,
      vehicleType: vehicle.type,
    },
    slot: {
      id: availableSlot.id,
      number: availableSlot.slotNumber,
      zone: availableSlot.zone.name,
    },
  }
}

async function simulateVehicleExit(parkingLotId: string) {
  // Find active token
  const activeToken = await prisma.token.findFirst({
    where: {
      parkingLotId,
      status: 'ACTIVE',
    },
    include: {
      allocatedSlot: {
        include: { zone: true },
      },
    },
    orderBy: { entryTime: 'asc' },
  })

  if (!activeToken) {
    return { success: false, message: 'No active tokens found' }
  }

  const duration = Math.ceil((Date.now() - activeToken.entryTime.getTime()) / (1000 * 60))
  const amount = calculateParkingFee(duration, activeToken.vehicleType || 'CAR')

  // Update token
  await prisma.token.update({
    where: { id: activeToken.id },
    data: {
      status: 'COMPLETED',
      exitTime: new Date(),
    },
  })

  // Update slot
  if (activeToken.allocatedSlotId) {
    await prisma.slot.update({
      where: { id: activeToken.allocatedSlotId },
      data: {
        isOccupied: false,
        confidence: 0,
        lastDetectedAt: new Date(),
      },
    })
  }

  // Create transaction
  await prisma.transaction.create({
    data: {
      parkingLotId,
      tokenId: activeToken.id,
      entryTime: activeToken.entryTime,
      exitTime: new Date(),
      duration,
      grossAmount: amount,
      netAmount: amount,
      currency: 'INR',
      paymentStatus: 'COMPLETED',
      paymentMethod: 'CASH',
      paidAt: new Date(),
      receiptNumber: `RCP-SIM-${Date.now()}`,
    },
  })

  return {
    success: true,
    event: 'vehicle_exit',
    token: {
      id: activeToken.id,
      number: activeToken.tokenNumber,
      licensePlate: activeToken.licensePlate,
    },
    duration: `${duration} minutes`,
    amount: `₹${(amount / 100).toFixed(2)}`,
    slot: activeToken.allocatedSlot
      ? {
          id: activeToken.allocatedSlot.id,
          number: activeToken.allocatedSlot.slotNumber,
        }
      : null,
  }
}

async function simulateDetectionEvent(parkingLotId: string) {
  const camera = await prisma.camera.findFirst({
    where: { parkingLotId, status: 'ONLINE' },
    orderBy: { lastPingAt: 'desc' },
  })

  if (!camera) {
    return { success: false, message: 'No online cameras found' }
  }

  const eventTypes = [
    'VEHICLE_DETECTED',
    'SLOT_OCCUPIED',
    'SLOT_VACATED',
    'LICENSE_PLATE_READ',
  ] as const

  const event = await prisma.detectionEvent.create({
    data: {
      cameraId: camera.id,
      eventType: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      objectType: 'vehicle',
      confidence: 0.85 + Math.random() * 0.15,
      bbox: {
        x: Math.random() * 0.5,
        y: Math.random() * 0.5,
        width: 0.1 + Math.random() * 0.1,
        height: 0.15 + Math.random() * 0.1,
      },
      vehicleType: ['CAR', 'SUV', 'MOTORCYCLE'][Math.floor(Math.random() * 3)],
      vehicleColor: ['White', 'Black', 'Silver', 'Red', 'Blue'][Math.floor(Math.random() * 5)],
      licensePlate: DEMO_VEHICLES[Math.floor(Math.random() * DEMO_VEHICLES.length)].plate,
    },
  })

  return {
    success: true,
    event: 'detection',
    detectionId: event.id,
    eventType: event.eventType,
    confidence: event.confidence,
    camera: camera.name,
  }
}

async function simulateCameraStatusChange(parkingLotId: string) {
  const cameras = await prisma.camera.findMany({
    where: { parkingLotId },
  })

  if (cameras.length === 0) {
    return { success: false, message: 'No cameras found' }
  }

  const camera = cameras[Math.floor(Math.random() * cameras.length)]
  const newStatus = camera.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE'

  await prisma.camera.update({
    where: { id: camera.id },
    data: {
      status: newStatus,
      lastPingAt: new Date(),
    },
  })

  return {
    success: true,
    event: 'camera_status',
    camera: {
      id: camera.id,
      name: camera.name,
      previousStatus: camera.status,
      newStatus,
    },
  }
}

async function simulateOccupancyUpdate(parkingLotId: string) {
  const slots = await prisma.slot.findMany({
    where: { zone: { parkingLotId } },
    take: 20,
    orderBy: { updatedAt: 'asc' },
  })

  let updated = 0
  for (const slot of slots) {
    // 30% chance to toggle occupancy
    if (Math.random() < 0.3) {
      await prisma.slot.update({
        where: { id: slot.id },
        data: {
          isOccupied: !slot.isOccupied,
          confidence: !slot.isOccupied ? 0.9 + Math.random() * 0.1 : 0,
          lastDetectedAt: new Date(),
        },
      })
      updated++
    }
  }

  const totalSlots = await prisma.slot.count({
    where: { zone: { parkingLotId } },
  })
  const occupiedSlots = await prisma.slot.count({
    where: { zone: { parkingLotId }, isOccupied: true },
  })

  return {
    success: true,
    event: 'occupancy_update',
    slotsUpdated: updated,
    currentOccupancy: {
      total: totalSlots,
      occupied: occupiedSlots,
      available: totalSlots - occupiedSlots,
      rate: ((occupiedSlots / totalSlots) * 100).toFixed(1) + '%',
    },
  }
}

async function simulateGateEvent(parkingLotId: string, gateId?: string, action?: string) {
  let gate
  if (gateId) {
    gate = await prisma.gate.findUnique({ where: { id: gateId } })
  } else {
    gate = await prisma.gate.findFirst({ where: { parkingLotId } })
  }

  if (!gate) {
    return { success: false, message: 'Gate not found' }
  }

  const gateAction = (action as any) || (gate.status === 'OPEN' ? 'CLOSED' : 'OPENED')

  await prisma.gate.update({
    where: { id: gate.id },
    data: {
      status: gateAction === 'OPENED' ? 'OPEN' : 'CLOSED',
      lastActionAt: new Date(),
    },
  })

  await prisma.gateEvent.create({
    data: {
      gateId: gate.id,
      action: gateAction,
      triggeredBy: 'sandbox-simulation',
    },
  })

  return {
    success: true,
    event: 'gate_event',
    gate: {
      id: gate.id,
      name: gate.name,
      type: gate.gateType,
      action: gateAction,
    },
  }
}

function calculateParkingFee(durationMinutes: number, vehicleType: string): number {
  // Simple fee calculation in paisa
  if (vehicleType === 'MOTORCYCLE') {
    return 2000 // ₹20 flat
  }

  const hours = Math.ceil(durationMinutes / 60)
  if (hours <= 2) return 4000 // ₹40
  if (hours <= 4) return 6000 // ₹60
  if (hours <= 8) return 10000 // ₹100
  return Math.min(20000, 4000 + (hours - 2) * 2000) // Max ₹200
}

// GET /api/sandbox/simulate - Get available simulation types
export async function GET() {
  return NextResponse.json({
    success: true,
    sandbox: true,
    availableEvents: [
      {
        type: 'vehicle_entry',
        description: 'Simulate a vehicle entering the parking lot',
        params: { parkingLotId: 'required' },
      },
      {
        type: 'vehicle_exit',
        description: 'Simulate a vehicle exiting (pays and leaves)',
        params: { parkingLotId: 'required' },
      },
      {
        type: 'detection',
        description: 'Simulate AI detection events from cameras',
        params: { parkingLotId: 'required', count: 'optional (1-50)' },
      },
      {
        type: 'camera_status',
        description: 'Toggle camera online/offline status',
        params: { parkingLotId: 'required' },
      },
      {
        type: 'occupancy_update',
        description: 'Randomly update slot occupancy',
        params: { parkingLotId: 'required' },
      },
      {
        type: 'gate_event',
        description: 'Simulate gate open/close events',
        params: { parkingLotId: 'required', gateId: 'optional', action: 'optional (OPENED/CLOSED)' },
      },
    ],
    usage: {
      method: 'POST',
      body: {
        eventType: 'string (required)',
        parkingLotId: 'string (required)',
        count: 'number (optional)',
      },
    },
  })
}
