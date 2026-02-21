import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { getAuthUser } from '@/lib/auth/getAuthUser'
import { createVehicleSchema } from '@/lib/validators/mobile'
import { VehicleType } from '@prisma/client'

const MOBILE_TO_BACKEND_TYPE: Record<string, VehicleType> = {
  car: 'CAR',
  motorcycle: 'MOTORCYCLE',
  suv: 'SUV',
  truck: 'TRUCK',
}

const BACKEND_TO_MOBILE_TYPE: Record<string, string> = {
  CAR: 'car',
  MOTORCYCLE: 'motorcycle',
  SUV: 'suv',
  TRUCK: 'truck',
}

function mapVehicle(v: { id: string; userId: string | null; licensePlate: string; vehicleType: VehicleType; make: string | null; model: string | null; color: string | null; isDefault: boolean }) {
  return {
    id: v.id,
    userId: v.userId || '',
    licensePlate: v.licensePlate,
    type: BACKEND_TO_MOBILE_TYPE[v.vehicleType] || 'car',
    make: v.make || '',
    model: v.model || '',
    color: v.color || '',
    isDefault: v.isDefault,
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    const vehicles = await prisma.vehicle.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(vehicles.map(mapVehicle))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    const body = await request.json()
    const data = createVehicleSchema.parse(body)

    // Check if license plate already exists for this user
    const existing = await prisma.vehicle.findUnique({
      where: { licensePlate: data.licensePlate },
    })
    if (existing && existing.userId === user.id) {
      return errorResponse('You already have this vehicle registered', 409)
    }
    if (existing && existing.userId) {
      return errorResponse('This vehicle is registered to another user', 409)
    }

    // If vehicle exists without a user, claim it
    if (existing && !existing.userId) {
      const updated = await prisma.vehicle.update({
        where: { id: existing.id },
        data: {
          userId: user.id,
          vehicleType: MOBILE_TO_BACKEND_TYPE[data.type] || 'CAR',
          make: data.make || existing.make,
          model: data.model || existing.model,
          color: data.color || existing.color,
          isDefault: data.isDefault ?? false,
        },
      })
      return successResponse(mapVehicle(updated))
    }

    // If this will be the first vehicle, make it default
    const vehicleCount = await prisma.vehicle.count({ where: { userId: user.id } })

    const vehicle = await prisma.vehicle.create({
      data: {
        licensePlate: data.licensePlate,
        userId: user.id,
        vehicleType: MOBILE_TO_BACKEND_TYPE[data.type] || 'CAR',
        make: data.make,
        model: data.model,
        color: data.color,
        isDefault: data.isDefault ?? vehicleCount === 0,
      },
    })

    return successResponse(mapVehicle(vehicle))
  } catch (error) {
    return handleApiError(error)
  }
}
