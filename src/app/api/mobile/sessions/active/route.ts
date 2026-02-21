import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { getAuthUser } from '@/lib/auth/getAuthUser'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    const vehicles = await prisma.vehicle.findMany({
      where: { userId: user.id },
      select: { id: true },
    })
    const vehicleIds = vehicles.map((v) => v.id)

    if (vehicleIds.length === 0) {
      return successResponse(null)
    }

    const token = await prisma.token.findFirst({
      where: {
        vehicleId: { in: vehicleIds },
        status: 'ACTIVE',
      },
      include: {
        allocatedSlot: {
          include: { zone: { select: { name: true, code: true } } },
        },
        parkingLot: {
          select: { id: true, name: true, address: true, latitude: true, longitude: true },
        },
        vehicle: {
          select: { id: true, licensePlate: true, vehicleType: true, make: true, model: true, color: true, isDefault: true, userId: true },
        },
      },
      orderBy: { entryTime: 'desc' },
    })

    if (!token) {
      return successResponse(null)
    }

    const BACKEND_TO_MOBILE_TYPE: Record<string, string> = {
      CAR: 'car', MOTORCYCLE: 'motorcycle', SUV: 'suv', TRUCK: 'truck',
    }

    return successResponse({
      id: token.id,
      userId: user.id,
      vehicleId: token.vehicleId || '',
      lotId: token.parkingLotId,
      spotNumber: token.allocatedSlot?.slotNumber || '',
      zone: token.allocatedSlot?.zone?.name || '',
      status: 'active',
      startTime: token.entryTime.toISOString(),
      endTime: null,
      amount: 0,
      paymentMethod: '',
      vehicle: token.vehicle ? {
        id: token.vehicle.id,
        userId: token.vehicle.userId || '',
        licensePlate: token.vehicle.licensePlate,
        type: BACKEND_TO_MOBILE_TYPE[token.vehicle.vehicleType] || 'car',
        make: token.vehicle.make || '',
        model: token.vehicle.model || '',
        color: token.vehicle.color || '',
        isDefault: token.vehicle.isDefault,
      } : undefined,
      lot: {
        id: token.parkingLot.id,
        name: token.parkingLot.name,
        address: token.parkingLot.address || '',
        latitude: token.parkingLot.latitude || 0,
        longitude: token.parkingLot.longitude || 0,
        totalSpots: 0,
        availableSpots: 0,
        ratePerHour: 0,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
