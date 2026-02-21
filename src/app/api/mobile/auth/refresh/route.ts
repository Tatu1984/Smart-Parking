import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { refreshTokenSchema } from '@/lib/validators/mobile'
import { signToken } from '@/lib/auth/jwt'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { refreshToken } = refreshTokenSchema.parse(body)

    // Find session by refresh token
    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date()) {
      return errorResponse('Invalid or expired refresh token', 401)
    }

    if (session.user.status !== 'ACTIVE') {
      return errorResponse('Account is not active', 403)
    }

    // Issue new token pair
    const newToken = await signToken({
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
      organizationId: session.user.organizationId,
    })

    const newRefreshToken = crypto.randomBytes(64).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    // Update session with new tokens
    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
        expiresAt,
      },
    })

    return successResponse({
      token: newToken,
      refreshToken: newRefreshToken,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
