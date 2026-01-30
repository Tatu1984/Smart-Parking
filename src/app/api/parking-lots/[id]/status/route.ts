import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

// GET /api/parking-lots/[id]/status - Get real-time parking lot status (public endpoint for kiosk)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const parkingLot = await prisma.parkingLot.findUnique({
      where: { id },
      include: {
        zones: {
          include: {
            slots: true,
          },
        },
        pricingRules: {
          where: { isActive: true },
          orderBy: { priority: 'desc' },
          take: 5,
        },
      },
    })

    if (!parkingLot) {
      return NextResponse.json(
        { success: false, error: 'Parking lot not found' },
        { status: 404 }
      )
    }

    // Calculate slot statistics
    let totalSlots = 0
    let availableSlots = 0

    const zones = parkingLot.zones.map((zone) => {
      const zoneTotal = zone.slots.length
      const zoneAvailable = zone.slots.filter((s) => s.status === 'AVAILABLE').length
      totalSlots += zoneTotal
      availableSlots += zoneAvailable

      // Find pricing rule for this zone type
      const pricingRule = parkingLot.pricingRules.find(
        (rule) => rule.zoneTypes.includes(zone.zoneType)
      )

      return {
        id: zone.id,
        name: zone.name,
        type: zone.zoneType,
        total: zoneTotal,
        available: zoneAvailable,
        hourlyRate: pricingRule?.hourlyRate || pricingRule?.baseRate || 0,
      }
    })

    // Get recent entries
    const recentEntries = await prisma.token.findMany({
      where: {
        parkingLotId: id,
        status: 'ACTIVE',
      },
      orderBy: { entryTime: 'desc' },
      take: 10,
      include: {
        allocatedSlot: {
          include: {
            zone: true,
          },
        },
      },
    })

    // Get active pricing
    const pricing = parkingLot.pricingRules.map((rule) => ({
      type: rule.name,
      rate: rule.hourlyRate || rule.baseRate,
      unit: 'hour',
    }))

    return NextResponse.json({
      success: true,
      data: {
        id: parkingLot.id,
        name: parkingLot.name,
        address: parkingLot.address,
        totalSlots,
        availableSlots,
        occupiedSlots: totalSlots - availableSlots,
        zones,
        pricing,
        recentEntries: recentEntries.map((entry) => ({
          tokenNumber: entry.tokenNumber,
          vehicleNumber: entry.licensePlate || '',
          entryTime: entry.entryTime.toISOString(),
          zone: entry.allocatedSlot?.zone?.name || 'Unknown',
        })),
      },
    })
  } catch (error) {
    logger.error('Error fetching parking status:', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch parking status' },
      { status: 500 }
    )
  }
}
