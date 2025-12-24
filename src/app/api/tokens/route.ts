import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, paginatedResponse, handleApiError, parseQueryParams } from '@/lib/utils/api'
import { createTokenSchema, slotAllocationSchema } from '@/lib/validators'
import { v4 as uuidv4 } from 'uuid'
import QRCode from 'qrcode'

// GET /api/tokens - List all tokens
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, search } = parseQueryParams(searchParams)
    const parkingLotId = searchParams.get('parkingLotId')
    const status = searchParams.get('status')

    const where = {
      ...(parkingLotId && { parkingLotId }),
      ...(status && { status: status as any }),
      ...(search && {
        OR: [
          { tokenNumber: { contains: search, mode: 'insensitive' as const } },
          { licensePlate: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const [tokens, total] = await Promise.all([
      prisma.token.findMany({
        where,
        include: {
          parkingLot: {
            select: { id: true, name: true },
          },
          allocatedSlot: {
            select: {
              id: true,
              slotNumber: true,
              zone: {
                select: { id: true, name: true, code: true, level: true },
              },
            },
          },
          vehicle: {
            select: { id: true, licensePlate: true, vehicleType: true },
          },
          transactions: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { entryTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.token.count({ where }),
    ])

    // Calculate duration for active tokens
    const enrichedTokens = tokens.map((token: typeof tokens[number]) => {
      const duration = token.exitTime
        ? Math.round((token.exitTime.getTime() - token.entryTime.getTime()) / 60000)
        : Math.round((Date.now() - token.entryTime.getTime()) / 60000)

      return {
        ...token,
        duration, // in minutes
      }
    })

    return paginatedResponse(enrichedTokens, page, limit, total)
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/tokens - Create a new token (entry)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = createTokenSchema.parse(body)

    // Generate unique token number
    const tokenNumber = generateTokenNumber()

    // Allocate a slot
    const allocationData = slotAllocationSchema.parse({
      parkingLotId: data.parkingLotId,
      vehicleType: data.vehicleType,
    })
    const allocatedSlot = await allocateSlot(allocationData)

    // Generate QR code
    const qrCodeData = await QRCode.toDataURL(tokenNumber, {
      width: 200,
      margin: 2,
    })

    // Find or create vehicle if license plate provided
    let vehicleId: string | undefined
    if (data.licensePlate) {
      const vehicle = await prisma.vehicle.upsert({
        where: { licensePlate: data.licensePlate.toUpperCase() },
        create: {
          licensePlate: data.licensePlate.toUpperCase(),
          vehicleType: data.vehicleType || 'CAR',
        },
        update: {
          visitCount: { increment: 1 },
          lastVisitAt: new Date(),
        },
      })
      vehicleId = vehicle.id
    }

    const token = await prisma.token.create({
      data: {
        parkingLotId: data.parkingLotId,
        tokenNumber,
        tokenType: data.tokenType,
        qrCode: qrCodeData,
        allocatedSlotId: allocatedSlot?.id,
        vehicleId,
        licensePlate: data.licensePlate?.toUpperCase(),
        vehicleType: data.vehicleType,
        expectedDuration: data.expectedDuration,
      },
      include: {
        parkingLot: {
          select: { id: true, name: true },
        },
        allocatedSlot: {
          select: {
            id: true,
            slotNumber: true,
            zone: {
              select: { id: true, name: true, code: true, level: true },
            },
          },
        },
      },
    })

    // Mark slot as reserved/occupied
    if (allocatedSlot) {
      await prisma.slot.update({
        where: { id: allocatedSlot.id },
        data: {
          status: 'RESERVED',
          isOccupied: false,
        },
      })
    }

    return successResponse(token, 'Token created successfully')
  } catch (error) {
    return handleApiError(error)
  }
}

function generateTokenNumber(): string {
  const date = new Date()
  const prefix = `TK${date.getFullYear().toString().slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  const suffix = uuidv4().slice(0, 6).toUpperCase()
  return `${prefix}-${suffix}`
}

async function allocateSlot(data: {
  parkingLotId: string
  vehicleType?: string
  preferredZoneType?: string
  isAccessible?: boolean
  needsEvCharging?: boolean
}) {
  // Build slot query conditions
  const conditions: any = {
    zone: { parkingLotId: data.parkingLotId },
    status: 'AVAILABLE',
    isOccupied: false,
    isUnderMaintenance: false,
  }

  if (data.vehicleType) {
    conditions.OR = [
      { vehicleType: data.vehicleType },
      { vehicleType: 'ANY' },
    ]
  }

  if (data.isAccessible) {
    conditions.isAccessible = true
  }

  if (data.needsEvCharging) {
    conditions.hasEvCharger = true
  }

  if (data.preferredZoneType) {
    conditions.zone.zoneType = data.preferredZoneType
  }

  // Find available slot
  const slot = await prisma.slot.findFirst({
    where: conditions,
    orderBy: [
      { zone: { level: 'asc' } },
      { zone: { sortOrder: 'asc' } },
      { slotNumber: 'asc' },
    ],
    select: {
      id: true,
      slotNumber: true,
      zone: {
        select: { id: true, name: true, code: true, level: true },
      },
    },
  })

  return slot
}
