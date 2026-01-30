import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { verifyToken } from '@/lib/auth/jwt'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return errorResponse('Not authenticated', 401)
    }

    // Verify JWT using shared utility
    const payload = await verifyToken(token)

    if (!payload) {
      return errorResponse('Invalid or expired token', 401)
    }

    // Get user with fresh data
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        assignedLots: {
          include: {
            parkingLot: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
    })

    if (!user || user.status !== 'ACTIVE') {
      return errorResponse('User not found or inactive', 401)
    }

    return successResponse({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      organization: user.organization,
      assignedLots: user.assignedLots.map((a: { parkingLot: { id: string; name: string; slug: string } }) => a.parkingLot),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
