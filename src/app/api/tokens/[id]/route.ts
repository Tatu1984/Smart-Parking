import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { completeTokenSchema } from '@/lib/validators'

// GET /api/tokens/[id] - Get a single token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const token = await prisma.token.findUnique({
      where: { id },
      include: {
        parkingLot: {
          select: { id: true, name: true, slug: true },
        },
        allocatedSlot: {
          include: {
            zone: {
              select: { id: true, name: true, code: true, level: true },
            },
          },
        },
        vehicle: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
        occupancies: {
          orderBy: { startTime: 'desc' },
          include: {
            slot: {
              select: { id: true, slotNumber: true },
            },
          },
        },
      },
    })

    if (!token) {
      return errorResponse('Token not found', 404)
    }

    // Calculate current duration
    const duration = token.exitTime
      ? Math.round((token.exitTime.getTime() - token.entryTime.getTime()) / 60000)
      : Math.round((Date.now() - token.entryTime.getTime()) / 60000)

    // Calculate estimated fee if still active
    let estimatedFee = 0
    if (token.status === 'ACTIVE') {
      estimatedFee = await calculateParkingFee(
        token.parkingLotId,
        token.entryTime,
        new Date()
      )
    }

    return successResponse({
      ...token,
      duration, // in minutes
      estimatedFee, // in paisa
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/tokens/[id] - Update token (e.g., mark as completed/exit)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const token = await prisma.token.findUnique({
      where: { id },
      include: {
        allocatedSlot: true,
      },
    })

    if (!token) {
      return errorResponse('Token not found', 404)
    }

    // Handle token completion (exit)
    if (body.action === 'complete') {
      const data = completeTokenSchema.parse({ tokenId: id, ...body })
      const exitTime = new Date()
      const duration = Math.round((exitTime.getTime() - token.entryTime.getTime()) / 60000)

      // Calculate parking fee
      const grossAmount = await calculateParkingFee(
        token.parkingLotId,
        token.entryTime,
        exitTime
      )
      const tax = Math.round(grossAmount * 0.18) // 18% GST
      const netAmount = grossAmount + tax

      // Create transaction
      const transaction = await prisma.transaction.create({
        data: {
          parkingLotId: token.parkingLotId,
          tokenId: token.id,
          entryTime: token.entryTime,
          exitTime,
          duration,
          grossAmount,
          tax,
          netAmount,
          paymentStatus: data.paymentMethod ? 'COMPLETED' : 'PENDING',
          paymentMethod: data.paymentMethod,
          paymentRef: data.paymentRef,
          paidAt: data.paymentMethod ? new Date() : null,
          receiptNumber: generateReceiptNumber(),
        },
      })

      // Update token
      const updatedToken = await prisma.token.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          exitTime,
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
                select: { name: true, code: true },
              },
            },
          },
        },
      })

      // Free up the slot
      if (token.allocatedSlot) {
        await prisma.slot.update({
          where: { id: token.allocatedSlot.id },
          data: {
            status: 'AVAILABLE',
            isOccupied: false,
          },
        })

        // End occupancy record
        await prisma.slotOccupancy.updateMany({
          where: {
            slotId: token.allocatedSlot.id,
            tokenId: token.id,
            endTime: null,
          },
          data: {
            endTime: exitTime,
          },
        })
      }

      return successResponse(
        {
          token: updatedToken,
          transaction,
        },
        'Token completed successfully'
      )
    }

    // Handle status updates
    if (body.status) {
      const updatedToken = await prisma.token.update({
        where: { id },
        data: { status: body.status },
      })
      return successResponse(updatedToken, 'Token updated successfully')
    }

    return errorResponse('Invalid action', 400)
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/tokens/[id] - Cancel a token
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const token = await prisma.token.findUnique({
      where: { id },
      select: { allocatedSlotId: true },
    })

    if (!token) {
      return errorResponse('Token not found', 404)
    }

    // Free up allocated slot
    if (token.allocatedSlotId) {
      await prisma.slot.update({
        where: { id: token.allocatedSlotId },
        data: {
          status: 'AVAILABLE',
          isOccupied: false,
        },
      })
    }

    await prisma.token.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })

    return successResponse(null, 'Token cancelled successfully')
  } catch (error) {
    return handleApiError(error)
  }
}

async function calculateParkingFee(
  parkingLotId: string,
  entryTime: Date,
  exitTime: Date
): Promise<number> {
  const durationMinutes = Math.round((exitTime.getTime() - entryTime.getTime()) / 60000)
  const durationHours = Math.ceil(durationMinutes / 60)

  // Get applicable pricing rule
  const pricingRule = await prisma.pricingRule.findFirst({
    where: {
      parkingLotId,
      isActive: true,
    },
    orderBy: { priority: 'desc' },
  })

  if (!pricingRule) {
    // Default: Rs 50 per hour
    return durationHours * 5000 // in paisa
  }

  switch (pricingRule.pricingModel) {
    case 'FLAT_RATE':
      return pricingRule.baseRate

    case 'HOURLY':
      const hourlyTotal = pricingRule.baseRate + (Math.max(0, durationHours - 1) * (pricingRule.hourlyRate || 0))
      return pricingRule.dailyMaxRate
        ? Math.min(hourlyTotal, pricingRule.dailyMaxRate)
        : hourlyTotal

    case 'SLAB':
      if (pricingRule.slabs && Array.isArray(pricingRule.slabs)) {
        let total = 0
        let remainingHours = durationHours
        const slabs = pricingRule.slabs as { upToHours: number; rate: number }[]

        for (const slab of slabs.sort((a, b) => a.upToHours - b.upToHours)) {
          if (remainingHours <= 0) break
          const hoursInSlab = Math.min(remainingHours, slab.upToHours)
          total += hoursInSlab * slab.rate
          remainingHours -= hoursInSlab
        }

        return total
      }
      return pricingRule.baseRate

    case 'FREE':
      return 0

    default:
      return pricingRule.baseRate
  }
}

function generateReceiptNumber(): string {
  const date = new Date()
  const prefix = `RCP${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  const suffix = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${prefix}-${suffix}`
}
