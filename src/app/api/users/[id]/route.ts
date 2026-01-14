import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { updateUserSchema } from '@/lib/validators'
import bcrypt from 'bcryptjs'

// GET /api/users/[id] - Get a single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Users can view their own profile, admins can view anyone
    if (id !== currentUser.id && !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Users can update their own profile (limited fields), admins can update anyone
    const isOwnProfile = id === currentUser.id
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)

    if (!isOwnProfile && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = updateUserSchema.parse(body)

    // Non-admins can only update certain fields on their own profile
    if (isOwnProfile && !isAdmin) {
      const allowedFields = ['name', 'phone', 'avatar', 'password']
      for (const key of Object.keys(data)) {
        if (!allowedFields.includes(key)) {
          return NextResponse.json(
            { error: `Cannot update field: ${key}` },
            { status: 403 }
          )
        }
      }
    }

    // Prevent non-super-admins from creating super admins
    if (data.role === 'SUPER_ADMIN' && currentUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only super admins can assign super admin role' },
        { status: 403 }
      )
    }

    // Check if updating password
    let updateData: Record<string, unknown> = { ...data }
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12)
      delete updateData.password
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
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN or SUPER_ADMIN can delete users
    if (!['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Prevent self-deletion
    if (id === currentUser.id) {
      return errorResponse('Cannot delete your own account', 400)
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })

    if (!user) {
      return errorResponse('User not found', 404)
    }

    // Only SUPER_ADMIN can delete other admins
    if (user.role === 'ADMIN' && currentUser.role !== 'SUPER_ADMIN') {
      return errorResponse('Only super admins can delete admin users', 403)
    }

    // Prevent deletion of super admins (safety measure)
    if (user.role === 'SUPER_ADMIN') {
      // Only super admins can delete super admins
      if (currentUser.role !== 'SUPER_ADMIN') {
        return errorResponse('Cannot delete super admin', 403)
      }
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
