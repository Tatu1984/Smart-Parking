import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { loginSchema } from '@/lib/validators'
import bcrypt from 'bcryptjs'
import { signToken } from '@/lib/auth/jwt'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { email },
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

    if (!user) {
      return errorResponse('Invalid email or password', 401)
    }

    if (user.status !== 'ACTIVE') {
      return errorResponse('Account is not active', 403)
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    if (!isValidPassword) {
      return errorResponse('Invalid email or password', 401)
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

    // Note: Token is set in httpOnly cookie, not returned in response body for security
    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization: user.organization,
        assignedLots: user.assignedLots.map((a: { parkingLot: { id: string; name: string; slug: string } }) => a.parkingLot),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
