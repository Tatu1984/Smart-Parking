import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { loginSchema } from '@/lib/validators'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { cookies } from 'next/headers'

// Development-only fallback secret (NEVER use in production)
const DEV_SECRET = 'dev-only-secret-key-min-32-chars-long!'

// Lazy-loaded JWT secret to avoid build-time errors
let _jwtSecret: Uint8Array | null = null

function getJwtSecret(): Uint8Array {
  if (_jwtSecret) return _jwtSecret

  const secret = process.env.JWT_SECRET

  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required in production')
    }
    if (secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long')
    }
    _jwtSecret = new TextEncoder().encode(secret)
    return _jwtSecret
  }

  // Development mode: use provided secret or fallback
  if (secret) {
    _jwtSecret = new TextEncoder().encode(secret)
    return _jwtSecret
  }

  console.warn('WARNING: Using development fallback JWT secret')
  _jwtSecret = new TextEncoder().encode(DEV_SECRET)
  return _jwtSecret
}

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

    // Create JWT token
    const token = await new SignJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(getJwtSecret())

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
