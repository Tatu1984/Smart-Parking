import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { getAuthUser } from '@/lib/auth/getAuthUser'
import { qrValidateSchema } from '@/lib/validators/mobile'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    const body = await request.json()
    const { code } = qrValidateSchema.parse(body)

    const token = await prisma.token.findUnique({
      where: { qrCode: code },
      include: {
        parkingLot: {
          select: { id: true, name: true, address: true },
        },
        allocatedSlot: {
          include: { zone: { select: { name: true, code: true } } },
        },
      },
    })

    if (!token) {
      return errorResponse('Invalid QR code', 404)
    }

    return successResponse({
      sessionId: token.id,
      status: token.status === 'ACTIVE' ? 'active' : token.status === 'COMPLETED' ? 'completed' : 'cancelled',
      lotName: token.parkingLot.name,
      lotAddress: token.parkingLot.address || '',
      spotNumber: token.allocatedSlot?.slotNumber || '',
      zone: token.allocatedSlot?.zone?.name || '',
      entryTime: token.entryTime.toISOString(),
      exitTime: token.exitTime?.toISOString() || null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
