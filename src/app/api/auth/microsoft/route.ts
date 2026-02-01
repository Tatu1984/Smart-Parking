import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { signToken } from '@/lib/auth/jwt'
import { verifyMicrosoftToken, findOrCreateMicrosoftUser, UserWithRelations } from '@/lib/auth/microsoft'
import { cookies } from 'next/headers'
import { z } from 'zod'

const microsoftLoginSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { idToken } = microsoftLoginSchema.parse(body)

    // Verify the Microsoft ID token
    const verifiedUser = await verifyMicrosoftToken(idToken)

    // Find or create the user
    const user = await findOrCreateMicrosoftUser(verifiedUser)

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      return errorResponse('Account is not active', 403)
    }

    // Check concurrent session limit
    const maxSessions = parseInt(process.env.MAX_SESSIONS_PER_USER || '5')
    const activeSessions = await prisma.session.count({
      where: {
        userId: user.id,
        expiresAt: { gt: new Date() },
      },
    })

    // If at or over limit, remove oldest session(s)
    if (activeSessions >= maxSessions) {
      const sessionsToRemove = activeSessions - maxSessions + 1
      const oldestSessions = await prisma.session.findMany({
        where: {
          userId: user.id,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'asc' },
        take: sessionsToRemove,
        select: { id: true },
      })

      await prisma.session.deleteMany({
        where: {
          id: { in: oldestSessions.map((s) => s.id) },
        },
      })
    }

    // Create JWT token using shared utility
    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    })

    // Store session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
        userAgent: request.headers.get('user-agent') || undefined,
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
      },
    })

    // Set cookie
    const cookieStore = await cookies()
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    })

    // Return user info (token is in httpOnly cookie)
    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization: user.organization,
        assignedLots: user.assignedLots.map((a: UserWithRelations['assignedLots'][number]) => a.parkingLot),
      },
    })
  } catch (error) {
    // Handle specific Microsoft auth errors
    if (error instanceof Error) {
      if (error.message.includes('Token verification failed')) {
        return errorResponse(error.message, 401)
      }
      if (error.message.includes('User not found')) {
        return errorResponse(error.message, 403)
      }
      if (error.message.includes('No organization available')) {
        return errorResponse(error.message, 500)
      }
    }
    return handleApiError(error)
  }
}
