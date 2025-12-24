import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, handleApiError } from '@/lib/utils/api'
import type { DashboardStats, ZoneOccupancy } from '@/types'

// GET /api/parking-lots/[id]/stats - Get real-time stats for a parking lot
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Parallel queries for performance
    const [
      slotStats,
      activeTokens,
      cameraStats,
      todayTokens,
      todayExits,
      todayRevenue,
      zoneOccupancy,
    ] = await Promise.all([
      // Total and occupied slots
      prisma.slot.groupBy({
        by: ['isOccupied', 'status'],
        where: {
          zone: { parkingLotId: id },
        },
        _count: true,
      }),

      // Active tokens count
      prisma.token.count({
        where: {
          parkingLotId: id,
          status: 'ACTIVE',
        },
      }),

      // Camera stats
      prisma.camera.groupBy({
        by: ['status'],
        where: { parkingLotId: id },
        _count: true,
      }),

      // Today's entries
      prisma.token.count({
        where: {
          parkingLotId: id,
          entryTime: { gte: today },
        },
      }),

      // Today's exits
      prisma.token.count({
        where: {
          parkingLotId: id,
          exitTime: { gte: today },
        },
      }),

      // Today's revenue
      prisma.transaction.aggregate({
        where: {
          parkingLotId: id,
          createdAt: { gte: today },
          paymentStatus: 'COMPLETED',
        },
        _sum: { netAmount: true },
      }),

      // Zone-wise occupancy
      prisma.zone.findMany({
        where: { parkingLotId: id },
        include: {
          slots: {
            select: {
              isOccupied: true,
              status: true,
            },
          },
        },
        orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
      }),
    ])

    // Calculate totals
    type SlotStat = { status: string; isOccupied: boolean; _count: number }
    type CameraStat = { status: string; _count: number }
    const totalSlots = slotStats.reduce((sum: number, stat: SlotStat) => sum + stat._count, 0)
    const occupiedSlots = slotStats
      .filter((s: SlotStat) => s.isOccupied)
      .reduce((sum: number, s: SlotStat) => sum + s._count, 0)
    const availableSlots = slotStats
      .filter((s: SlotStat) => !s.isOccupied && s.status !== 'MAINTENANCE' && s.status !== 'BLOCKED')
      .reduce((sum: number, s: SlotStat) => sum + s._count, 0)

    const totalCameras = cameraStats.reduce((sum: number, stat: CameraStat) => sum + stat._count, 0)
    const onlineCameras = cameraStats.find((c: CameraStat) => c.status === 'ONLINE')?._count || 0

    const stats: DashboardStats = {
      totalSlots,
      occupiedSlots,
      availableSlots,
      occupancyRate: totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0,
      todayEntries: todayTokens,
      todayExits,
      todayRevenue: (todayRevenue._sum.netAmount || 0) / 100, // Convert paisa to rupees
      activeTokens,
      onlineCameras,
      totalCameras,
    }

    type ZoneSlot = { isOccupied: boolean; status: string }
    type ZoneData = { id: string; name: string; code: string; slots: ZoneSlot[] }
    const zones: ZoneOccupancy[] = zoneOccupancy.map((zone: ZoneData) => {
      const zoneTotal = zone.slots.length
      const zoneOccupied = zone.slots.filter((s: ZoneSlot) => s.isOccupied).length
      const zoneAvailable = zone.slots.filter(
        (s: ZoneSlot) => !s.isOccupied && s.status !== 'MAINTENANCE' && s.status !== 'BLOCKED'
      ).length

      return {
        zoneId: zone.id,
        zoneName: zone.name,
        zoneCode: zone.code,
        totalSlots: zoneTotal,
        occupiedSlots: zoneOccupied,
        availableSlots: zoneAvailable,
        occupancyRate: zoneTotal > 0 ? (zoneOccupied / zoneTotal) * 100 : 0,
      }
    })

    return successResponse({ stats, zones })
  } catch (error) {
    return handleApiError(error)
  }
}
