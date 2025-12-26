import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, paginatedResponse, handleApiError, parseQueryParams } from '@/lib/utils/api'
import { createUserSchema } from '@/lib/validators'
import bcrypt from 'bcryptjs'

// GET /api/users - List all users
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, search } = parseQueryParams(searchParams)
    const role = searchParams.get('role')
    const status = searchParams.get('status')
    const organizationId = searchParams.get('organizationId')

    const where = {
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
