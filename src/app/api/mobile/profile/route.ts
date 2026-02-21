import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { getAuthUser } from '@/lib/auth/getAuthUser'
import { updateProfileSchema } from '@/lib/validators/mobile'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    return successResponse({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone || '',
      avatarUrl: user.avatar,
      createdAt: user.createdAt.toISOString(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    const body = await request.json()
    const data = updateProfileSchema.parse(body)

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.avatar !== undefined && { avatar: data.avatar }),
      },
    })

    return successResponse({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      phone: updated.phone || '',
      avatarUrl: updated.avatar,
      createdAt: updated.createdAt.toISOString(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
