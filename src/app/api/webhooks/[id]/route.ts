import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  getWebhook,
  updateWebhook,
  unregisterWebhook,
  WebhookEventType
} from '@/lib/webhooks'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Get webhook details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const webhook = await getWebhook(id)

    if (!webhook) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      webhook: {
        ...webhook,
        secret: webhook.secret.substring(0, 8) + '...'
      }
    })
  } catch (error) {
    console.error('Get webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to get webhook' },
      { status: 500 }
    )
  }
}

/**
 * Update webhook configuration
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { url, events, enabled, metadata } = body

    const updates: {
      url?: string
      events?: WebhookEventType[]
      enabled?: boolean
      metadata?: Record<string, string>
    } = {}

    if (url !== undefined) {
      try {
        new URL(url)
        updates.url = url
      } catch {
        return NextResponse.json(
          { error: 'Invalid URL format' },
          { status: 400 }
        )
      }
    }

    if (events !== undefined) {
      updates.events = events
    }

    if (enabled !== undefined) {
      updates.enabled = enabled
    }

    if (metadata !== undefined) {
      updates.metadata = metadata
    }

    const webhook = await updateWebhook(id, updates)

    if (!webhook) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      webhook: {
        ...webhook,
        secret: webhook.secret.substring(0, 8) + '...'
      }
    })
  } catch (error) {
    console.error('Update webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to update webhook' },
      { status: 500 }
    )
  }
}

/**
 * Delete webhook
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const deleted = await unregisterWebhook(id)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Webhook deleted successfully' })
  } catch (error) {
    console.error('Delete webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to delete webhook' },
      { status: 500 }
    )
  }
}
