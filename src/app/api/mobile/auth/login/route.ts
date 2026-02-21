import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { mobileLoginSchema } from '@/lib/validators/mobile'
import bcrypt from 'bcryptjs'
import { signToken } from '@/lib/auth/jwt'
import crypto from 'crypto'
import { withRateLimit } from '@/lib/rate-limit/with-rate-limit'

export const POST = withRateLimit(async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = mobileLoginSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return errorResponse('Invalid email or password', 401)
    }

    if (user.status !== 'ACTIVE') {
      return errorResponse('Account is not active', 403)
    }

    if (!user.passwordHash) {
      return errorResponse('This account uses Microsoft login', 400)
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    if (!isValidPassword) {
      return errorResponse('Invalid email or password', 401)
    }

    // Manage concurrent mobile sessions (limit 3)
    const maxMobileSessions = 3
    const activeMobileSessions = await prisma.session.count({
      where: {
        userId: user.id,
        platform: 'mobile',
        expiresAt: { gt: new Date() },
      },
    })

    if (activeMobileSessions >= maxMobileSessions) {
      const oldest = await prisma.session.findMany({
        where: {
          userId: user.id,
          platform: 'mobile',
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'asc' },
        take: activeMobileSessions - maxMobileSessions + 1,
        select: { id: true },
      })
      await prisma.session.deleteMany({
        where: { id: { in: oldest.map((s) => s.id) } },
      })
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    })

    const refreshToken = crypto.randomBytes(64).toString('hex')

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        refreshToken,
        platform: 'mobile',
        expiresAt,
        userAgent: request.headers.get('user-agent') || undefined,
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
      },
    })

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone || '',
        avatarUrl: user.avatar,
        createdAt: user.createdAt.toISOString(),
      },
      token,
      refreshToken,
    })
  } catch (error) {
    return handleApiError(error)
  }
})
