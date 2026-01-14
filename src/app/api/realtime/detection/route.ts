import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, handleApiError } from '@/lib/utils/api'
import { detectionEventSchema } from '@/lib/validators'

const DETECTION_API_KEY = process.env.DETECTION_API_KEY
const DEV_API_KEY = 'dev-detection-api-key' // Development-only fallback

// POST /api/realtime/detection - Receive detection events from AI pipeline
export async function POST(request: NextRequest) {
  try {
    // Validate API key from AI pipeline
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '')

    // In production, require proper API key
    if (process.env.NODE_ENV === 'production') {
      if (!DETECTION_API_KEY) {
        console.error('DETECTION_API_KEY not configured')
        return NextResponse.json(
          { error: 'Detection endpoint not configured' },
          { status: 500 }
        )
      }

      if (!apiKey || apiKey !== DETECTION_API_KEY) {
        return NextResponse.json(
          { error: 'Unauthorized - Invalid or missing API key' },
          { status: 401 }
        )
      }
    } else {
      // Development mode: allow dev key or configured key
      const validKey = DETECTION_API_KEY || DEV_API_KEY
      if (apiKey && apiKey !== validKey && apiKey !== DEV_API_KEY) {
        return NextResponse.json(
          { error: 'Unauthorized - Invalid API key' },
          { status: 401 }
        )
      }
      // In dev, allow requests without API key for easier testing
      if (!apiKey) {
        console.warn('WARNING: Detection request without API key (allowed in development)')
      }
    }

    const body = await request.json()
    const data = detectionEventSchema.parse(body)

    // Store the detection event
    const event = await prisma.detectionEvent.create({
      data: {
        cameraId: data.cameraId,
        eventType: data.eventType,
        objectType: data.objectType,
        confidence: data.confidence,
        bbox: data.bbox,
        trackingId: data.trackingId,
        vehicleType: data.vehicleType,
        vehicleColor: data.vehicleColor,
        licensePlate: data.licensePlate,
        frameUrl: data.frameUrl,
      },
    })

    // Process slot occupancy changes
    if (data.eventType === 'SLOT_OCCUPIED' || data.eventType === 'SLOT_VACATED') {
      await processSlotOccupancyChange(data)
    }

    // Process license plate detection
    if (data.eventType === 'LICENSE_PLATE_READ' && data.licensePlate) {
      await processLicensePlateDetection(data)
    }

    return successResponse({ eventId: event.id }, 'Detection event processed')
  } catch (error) {
    return handleApiError(error)
  }
}

async function processSlotOccupancyChange(data: {
  cameraId: string
  eventType: string
  confidence: number
  bbox: { x: number; y: number; width: number; height: number }
  trackingId?: string
  vehicleType?: string
  licensePlate?: string
}) {
  // Find slot by camera and bounding box
  const camera = await prisma.camera.findUnique({
    where: { id: data.cameraId },
    include: {
      slots: {
        select: {
          id: true,
          slotNumber: true,
          detectionBounds: true,
          isOccupied: true,
        },
      },
    },
  })

  if (!camera) return

  // Find matching slot based on bounding box overlap
  type SlotData = {
    id: string
    slotNumber: string
    detectionBounds: unknown
    isOccupied: boolean
  }
  const matchingSlot = camera.slots.find((slot: SlotData) => {
    if (!slot.detectionBounds) return false
    const bounds = slot.detectionBounds as {
      x: number
      y: number
      width: number
      height: number
    }
    return isOverlapping(data.bbox, bounds)
  })

  if (!matchingSlot) return

  const isOccupied = data.eventType === 'SLOT_OCCUPIED'

  // Only update if state changed and confidence is high enough
  if (matchingSlot.isOccupied !== isOccupied && data.confidence >= 0.7) {
    await prisma.slot.update({
      where: { id: matchingSlot.id },
      data: {
        isOccupied,
        confidence: data.confidence,
        lastDetectedAt: new Date(),
        status: isOccupied ? 'OCCUPIED' : 'AVAILABLE',
      },
    })

    // Create occupancy record
    if (isOccupied) {
      await prisma.slotOccupancy.create({
        data: {
          slotId: matchingSlot.id,
          entryConfidence: data.confidence,
        },
      })
    } else {
      // End active occupancy
      await prisma.slotOccupancy.updateMany({
        where: {
          slotId: matchingSlot.id,
          endTime: null,
        },
        data: {
          endTime: new Date(),
          exitConfidence: data.confidence,
        },
      })
    }
  }
}

async function processLicensePlateDetection(data: {
  cameraId: string
  licensePlate?: string
  confidence: number
}) {
  if (!data.licensePlate) return

  const normalizedPlate = data.licensePlate.toUpperCase().replace(/[^A-Z0-9]/g, '')

  // Check if this is a new vehicle entry
  const camera = await prisma.camera.findUnique({
    where: { id: data.cameraId },
    include: {
      parkingLot: {
        include: {
          gates: {
            where: { gateType: 'ENTRY' },
          },
        },
      },
    },
  })

  if (!camera) return

  // Update or create vehicle record
  await prisma.vehicle.upsert({
    where: { licensePlate: normalizedPlate },
    create: {
      licensePlate: normalizedPlate,
      visitCount: 1,
      lastVisitAt: new Date(),
    },
    update: {
      visitCount: { increment: 1 },
      lastVisitAt: new Date(),
    },
  })

  // Check for active token without license plate
  const activeToken = await prisma.token.findFirst({
    where: {
      parkingLotId: camera.parkingLotId,
      status: 'ACTIVE',
      licensePlate: null,
      entryTime: {
        gte: new Date(Date.now() - 5 * 60 * 1000), // Within last 5 minutes
      },
    },
    orderBy: { entryTime: 'desc' },
  })

  if (activeToken) {
    await prisma.token.update({
      where: { id: activeToken.id },
      data: { licensePlate: normalizedPlate },
    })
  }
}

function isOverlapping(
  box1: { x: number; y: number; width: number; height: number },
  box2: { x: number; y: number; width: number; height: number }
): boolean {
  const overlap =
    box1.x < box2.x + box2.width &&
    box1.x + box1.width > box2.x &&
    box1.y < box2.y + box2.height &&
    box1.y + box1.height > box2.y

  if (!overlap) return false

  // Calculate overlap area
  const overlapX = Math.max(0, Math.min(box1.x + box1.width, box2.x + box2.width) - Math.max(box1.x, box2.x))
  const overlapY = Math.max(0, Math.min(box1.y + box1.height, box2.y + box2.height) - Math.max(box1.y, box2.y))
  const overlapArea = overlapX * overlapY

  // Check if overlap is significant (at least 50% of the slot area)
  const slotArea = box2.width * box2.height
  return overlapArea / slotArea >= 0.5
}
