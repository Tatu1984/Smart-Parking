import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { updateUserSchema } from '@/lib/validators'
import bcrypt from 'bcryptjs'

// GET /api/users/[id] - Get a single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
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
            slug: true,
          },
        },
        assignedLots: {
          select: {
            assignedAt: true,
            parkingLot: {
              select: {
                id: true,
                name: true,
                slug: true,
                venueType: true,
              },
            },
          },
        },
        sessions: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            createdAt: true,
            userAgent: true,
            ipAddress: true,
          },
        },
      },
    })

    if (!user) {
      return errorResponse('User not found', 404)
    }

    return successResponse({
      ...user,
      lastLoginAt: user.sessions[0]?.createdAt || null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/users/[id] - Update a user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = updateUserSchema.parse(body)

    // Check if updating password
    let updateData: any = { ...data }
    if (body.password) {
      updateData.passwordHash = await bcrypt.hash(body.password, 12)
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
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
      },
    })

    return successResponse(user, 'User updated successfully')
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/users/[id] - Delete a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })

    if (!user) {
      return errorResponse('User not found', 404)
    }

    // Prevent deletion of super admins (safety measure)
    if (user.role === 'SUPER_ADMIN') {
      // Check if this is the last super admin
      const superAdminCount = await prisma.user.count({
        where: { role: 'SUPER_ADMIN' },
      })
      if (superAdminCount <= 1) {
        return errorResponse('Cannot delete the last super admin', 400)
      }
    }

    // Delete user (cascades to sessions, assignments, etc.)
    await prisma.user.delete({
      where: { id },
    })

    return successResponse(null, 'User deleted successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
