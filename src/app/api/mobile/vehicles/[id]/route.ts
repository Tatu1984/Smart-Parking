import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { getAuthUser } from '@/lib/auth/getAuthUser'
import { updateVehicleSchema } from '@/lib/validators/mobile'
import { VehicleType } from '@prisma/client'

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    const { id } = await params

    const vehicle = await prisma.vehicle.findUnique({ where: { id } })
    if (!vehicle || vehicle.userId !== user.id) {
      return errorResponse('Vehicle not found', 404)
    }

    return successResponse(mapVehicle(vehicle))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    const { id } = await params
    const body = await request.json()
    const data = updateVehicleSchema.parse(body)

    const vehicle = await prisma.vehicle.findUnique({ where: { id } })
    if (!vehicle || vehicle.userId !== user.id) {
      return errorResponse('Vehicle not found', 404)
    }

    // If setting as default, unset all others first
    if (data.isDefault) {
      await prisma.vehicle.updateMany({
        where: { userId: user.id, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        ...(data.make !== undefined && { make: data.make }),
        ...(data.model !== undefined && { model: data.model }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
    })

    return successResponse(mapVehicle(updated))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    const { id } = await params

    const vehicle = await prisma.vehicle.findUnique({ where: { id } })
    if (!vehicle || vehicle.userId !== user.id) {
      return errorResponse('Vehicle not found', 404)
    }

    // Soft-unlink: set userId to null (vehicle may be referenced by tokens)
    await prisma.vehicle.update({
      where: { id },
      data: { userId: null, isDefault: false },
    })

    return successResponse({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
