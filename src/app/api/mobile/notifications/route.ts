import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { getAuthUser } from '@/lib/auth/getAuthUser'

const NOTIF_TYPE_MAP: Record<string, string> = {
  PAYMENT_SUCCESS: 'payment',
  PAYMENT_FAILED: 'payment',
  SESSION_START: 'parking',
  SESSION_END: 'parking',
  OVERSTAY_WARNING: 'parking',
  WELCOME: 'system',
  ACCOUNT_UPDATE: 'system',
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return successResponse(
      notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: NOTIF_TYPE_MAP[n.type] || 'system',
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      }))
    )
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    const body = await request.json()
    const { id } = body as { id: string }

    if (!id) {
      return errorResponse('Notification ID is required', 400)
    }

    const notification = await prisma.notification.findUnique({ where: { id } })
    if (!notification || notification.userId !== user.id) {
      return errorResponse('Notification not found', 404)
    }

    await prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    })

    return successResponse({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
