import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { mobileRegisterSchema } from '@/lib/validators/mobile'
import bcrypt from 'bcryptjs'
import { signToken } from '@/lib/auth/jwt'
import crypto from 'crypto'
import { withRateLimit } from '@/lib/rate-limit/with-rate-limit'

const SYSTEM_ORG_SLUG = 'sparking-customers'

export const POST = withRateLimit(async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password, phone } = mobileRegisterSchema.parse(body)

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return errorResponse('An account with this email already exists', 409)
    }

    // Find or create the system "Sparking" organization for customers
    let org = await prisma.organization.findUnique({
      where: { slug: SYSTEM_ORG_SLUG },
    })
    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: 'Sparking',
          slug: SYSTEM_ORG_SLUG,
        },
      })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    // Create user + wallet in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          name,
          phone: phone || null,
          passwordHash,
          role: 'CUSTOMER',
          organizationId: org.id,
        },
      })

      // Create personal wallet
      await tx.wallet.create({
        data: {
          userId: newUser.id,
          walletType: 'PERSONAL',
          currency: 'INR',
        },
      })

      return newUser
    })

    // Sign JWT
    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    })

    // Generate refresh token
    const refreshToken = crypto.randomBytes(64).toString('hex')

    // Create session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
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
