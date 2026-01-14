import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'
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

    // Note: Slot is already marked as reserved within allocateSlot transaction
    // This prevents race conditions where multiple requests could allocate the same slot

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
  // Use transaction with row-level locking to prevent race conditions
  return await prisma.$transaction(async (tx) => {
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

    // Find available slot with FOR UPDATE lock using raw query
    // This prevents race conditions where multiple requests could allocate the same slot
    const slots = await tx.$queryRaw<Array<{
      id: string
      slotNumber: string
      zone_id: string
      zone_name: string
      zone_code: string
      zone_level: number
    }>>`
      SELECT s.id, s.slot_number as "slotNumber", z.id as zone_id, z.name as zone_name, z.code as zone_code, z.level as zone_level
      FROM slots s
      JOIN zones z ON s.zone_id = z.id
      WHERE z.parking_lot_id = ${data.parkingLotId}
        AND s.status = 'AVAILABLE'
        AND s.is_occupied = false
        AND s.is_under_maintenance = false
        ${data.vehicleType ? Prisma.sql`AND (s.vehicle_type = ${data.vehicleType} OR s.vehicle_type = 'ANY')` : Prisma.empty}
        ${data.isAccessible ? Prisma.sql`AND s.is_accessible = true` : Prisma.empty}
        ${data.needsEvCharging ? Prisma.sql`AND s.has_ev_charger = true` : Prisma.empty}
        ${data.preferredZoneType ? Prisma.sql`AND z.zone_type = ${data.preferredZoneType}` : Prisma.empty}
      ORDER BY z.level ASC, z.sort_order ASC, s.slot_number ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `

    if (slots.length === 0) {
      return null
    }

    const slot = slots[0]

    // Immediately mark the slot as reserved within the same transaction
    await tx.slot.update({
      where: { id: slot.id },
      data: {
        status: 'RESERVED',
        isOccupied: false,
      },
    })

    return {
      id: slot.id,
      slotNumber: slot.slotNumber,
      zone: {
        id: slot.zone_id,
        name: slot.zone_name,
        code: slot.zone_code,
        level: slot.zone_level,
      },
    }
  }, {
    isolationLevel: 'Serializable',
    timeout: 10000, // 10 second timeout
  })
}
