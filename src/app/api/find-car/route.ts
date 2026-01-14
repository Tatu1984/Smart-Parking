import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Find My Car API
 * Locate a parked vehicle by token number or license plate
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const plate = searchParams.get('plate')

    if (!token && !plate) {
      return NextResponse.json(
        { error: 'Please provide either token or plate parameter' },
        { status: 400 }
      )
    }

    // Build query based on search type
    const whereClause: Record<string, unknown> = {
      status: 'ACTIVE'
    }

    if (token) {
      whereClause.tokenNumber = token.toUpperCase()
    }

    if (plate) {
      whereClause.licensePlate = plate.toUpperCase()
    }

    // Find the active token
    const activeToken = await prisma.token.findFirst({
      where: whereClause,
      include: {
        allocatedSlot: {
          include: {
            zone: {
              include: {
                parkingLot: true
              }
            }
          }
        }
      }
    })

    if (!activeToken) {
      return NextResponse.json({
        found: false,
        message: 'No active parking session found'
      })
    }

    // Generate walking directions based on slot location
    const directions = generateDirections(activeToken.allocatedSlot)

    return NextResponse.json({
      found: true,
      token: {
        id: activeToken.id,
        tokenNumber: activeToken.tokenNumber,
        entryTime: activeToken.entryTime,
        licensePlate: activeToken.licensePlate
      },
      slot: activeToken.allocatedSlot ? {
        id: activeToken.allocatedSlot.id,
        slotNumber: activeToken.allocatedSlot.slotNumber,
        zone: {
          name: activeToken.allocatedSlot.zone.name,
          code: activeToken.allocatedSlot.zone.code,
          level: activeToken.allocatedSlot.zone.level
        }
      } : null,
      parkingLot: activeToken.allocatedSlot?.zone.parkingLot ? {
        name: activeToken.allocatedSlot.zone.parkingLot.name,
        address: activeToken.allocatedSlot.zone.parkingLot.address
      } : null,
      directions
    })
  } catch (error) {
    console.error('Find car error:', error)
    return NextResponse.json(
      { error: 'Failed to search for vehicle' },
      { status: 500 }
    )
  }
}

function generateDirections(slot: {
  slotNumber: string
  zone: {
    name: string
    code: string
    level: number
  }
} | null): { steps: string[]; estimatedWalkTime: number } | null {
  if (!slot) return null

  const steps: string[] = []
  const level = slot.zone.level

  // Entry point
  steps.push('Start from the main entrance')

  // Level directions
  if (level < 0) {
    steps.push(`Take the elevator or ramp down to Basement ${Math.abs(level)}`)
  } else if (level > 0) {
    steps.push(`Take the elevator or stairs up to Floor ${level}`)
  }

  // Zone directions
  const zoneCode = slot.zone.code.toUpperCase()
  if (zoneCode.includes('A') || zoneCode.includes('1')) {
    steps.push(`Turn left and proceed to Zone ${slot.zone.name}`)
  } else if (zoneCode.includes('B') || zoneCode.includes('2')) {
    steps.push(`Turn right and proceed to Zone ${slot.zone.name}`)
  } else if (zoneCode.includes('C') || zoneCode.includes('3')) {
    steps.push(`Go straight and proceed to Zone ${slot.zone.name}`)
  } else {
    steps.push(`Follow signs to Zone ${slot.zone.name}`)
  }

  // Slot number directions
  const slotNum = parseInt(slot.slotNumber.replace(/\D/g, '')) || 1
  if (slotNum <= 20) {
    steps.push(`Your car is in slot ${slot.slotNumber} near the zone entrance`)
  } else if (slotNum <= 50) {
    steps.push(`Continue to the middle of the zone - slot ${slot.slotNumber}`)
  } else {
    steps.push(`Proceed to the far end of the zone - slot ${slot.slotNumber}`)
  }

  // Estimate walking time (roughly 30 seconds per level + 10 seconds per 10 slots)
  const levelTime = Math.abs(level) * 0.5
  const slotTime = Math.ceil(slotNum / 10) * 0.15
  const estimatedWalkTime = Math.max(1, Math.round(levelTime + slotTime + 1))

  return { steps, estimatedWalkTime }
}
