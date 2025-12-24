import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { z } from 'zod'

const updateVehicleSchema = z.object({
  vehicleType: z.enum(['CAR', 'SUV', 'MOTORCYCLE', 'BUS', 'TRUCK', 'VAN', 'BICYCLE', 'ANY']).optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  color: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  ownerEmail: z.string().email().optional(),
  isBlacklisted: z.boolean().optional(),
  isWhitelisted: z.boolean().optional(),
  isVip: z.boolean().optional(),
  membershipId: z.string().optional(),
})

// GET /api/vehicles/[id] - Get a single vehicle
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        tokens: {
          take: 20,
          orderBy: { entryTime: 'desc' },
          include: {
            parkingLot: {
              select: { id: true, name: true },
            },
            transactions: {
              select: {
                id: true,
                netAmount: true,
                paymentStatus: true,
                duration: true,
              },
            },
          },
        },
        occupancies: {
          take: 20,
          orderBy: { startTime: 'desc' },
          include: {
            slot: {
              select: {
                id: true,
                slotNumber: true,
                zone: {
                  select: { name: true, code: true },
                },
              },
            },
          },
        },
      },
    })

    if (!vehicle) {
      return errorResponse('Vehicle not found', 404)
    }

    // Calculate total spend
    const totalSpend = await prisma.transaction.aggregate({
      where: {
        token: { vehicleId: id },
        paymentStatus: 'COMPLETED',
      },
      _sum: { netAmount: true },
    })

    return successResponse({
      ...vehicle,
      totalSpend: totalSpend._sum.netAmount || 0,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/vehicles/[id] - Update a vehicle
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = updateVehicleSchema.parse(body)

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data,
    })

    return successResponse(vehicle, 'Vehicle updated successfully')
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/vehicles/[id] - Delete a vehicle
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.vehicle.delete({
      where: { id },
    })

    return successResponse(null, 'Vehicle deleted successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
