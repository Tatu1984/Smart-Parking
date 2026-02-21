import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, paginatedResponse, handleApiError, parseQueryParams, errorResponse } from '@/lib/utils/api'
import { createUserSchema } from '@/lib/validators'
import { getAuthUser } from '@/lib/auth/getAuthUser'
import bcrypt from 'bcryptjs'

// GET /api/users - List all users
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    const { searchParams } = new URL(request.url)
    const { page, limit, search } = parseQueryParams(searchParams)
    const role = searchParams.get('role')
    const status = searchParams.get('status')
    const organizationId = searchParams.get('organizationId')

    const where: Record<string, any> = {
      ...(role && { role: role as any }),
      ...(status && { status: status as any }),
      ...(organizationId && { organizationId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }

    // Org isolation: non-SUPER_ADMIN only see their org's users
    if (user.role !== 'SUPER_ADMIN') {
      where.organizationId = user.organizationId
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          avatar: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
          assignedLots: {
            select: {
              parkingLot: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          sessions: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    // Transform to add lastLoginAt
    const usersWithLogin = users.map(user => ({
      ...user,
      lastLoginAt: user.sessions[0]?.createdAt || null,
      sessions: undefined,
    }))

    return paginatedResponse(usersWithLogin, page, limit, total)
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return errorResponse('Unauthorized', 401)

    if (!['ADMIN', 'SUPER_ADMIN'].includes(authUser.role)) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const data = createUserSchema.parse(body)

    // Hash the password
    const passwordHash = await bcrypt.hash(data.password, 12)

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        phone: data.phone,
        role: data.role,
        organizationId: data.organizationId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return successResponse(user, 'User created successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
