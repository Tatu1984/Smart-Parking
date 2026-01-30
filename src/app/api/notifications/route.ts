import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { logger } from '@/lib/logger'

// GET /api/notifications - Get user notifications
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.userId,
        ...(unreadOnly && { read: false })
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    const unreadCount = await prisma.notification.count({
      where: {
        userId: session.userId,
        read: false
      }
    })

    return NextResponse.json({
      notifications,
      unreadCount,
      hasMore: notifications.length === limit
    })
  } catch (error) {
    logger.error('Notifications GET error:', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

// POST /api/notifications - Create a notification (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.userId }
    })

    if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, type, title, message, data } = body

    const notification = await prisma.notification.create({
      data: {
        userId,
        type: type || 'SYSTEM_ALERT',
        title,
        message,
        data: data || {},
        read: false
      }
    })

    return NextResponse.json({ notification })
  } catch (error) {
    logger.error('Notification create error:', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    )
  }
}

// PATCH /api/notifications - Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notificationIds, markAllRead } = body

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: {
          userId: session.userId,
          read: false
        },
        data: { read: true }
      })
    } else if (notificationIds && Array.isArray(notificationIds)) {
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: session.userId
        },
        data: { read: true }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Notification update error:', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    )
  }
}

// DELETE /api/notifications - Delete notifications
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const notificationId = searchParams.get('id')
    const deleteAll = searchParams.get('all') === 'true'

    if (deleteAll) {
      await prisma.notification.deleteMany({
        where: { userId: session.userId }
      })
    } else if (notificationId) {
      // Use deleteMany with composite where clause instead of delete
      // Prisma delete() doesn't support composite where clauses
      const result = await prisma.notification.deleteMany({
        where: {
          id: notificationId,
          userId: session.userId
        }
      })

      if (result.count === 0) {
        return NextResponse.json(
          { error: 'Notification not found or access denied' },
          { status: 404 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Notification delete error:', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    )
  }
}
