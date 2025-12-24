import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-min-32-characters-long!'
)

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return errorResponse('Not authenticated', 401)
    }

    // Verify JWT
    const { payload } = await jwtVerify(token, JWT_SECRET)

    // Get user with fresh data
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as string },
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
