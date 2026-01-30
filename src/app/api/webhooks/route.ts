import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  registerWebhook,
  listWebhooks,
  WebhookEventType
} from '@/lib/webhooks'
import { logger } from '@/lib/logger'

const VALID_EVENTS: WebhookEventType[] = [
  'vehicle.entry',
  'vehicle.exit',
  'payment.completed',
  'payment.failed',
  'slot.occupied',
  'slot.vacated',
  'token.created',
  'token.completed',
  'alert.triggered',
  'occupancy.threshold'
]

/**
 * List all webhooks
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parkingLotId = searchParams.get('parkingLotId') || undefined

    const webhooks = await listWebhooks(parkingLotId)

    // Hide secrets in response
    const safeWebhooks = webhooks.map(w => ({
      ...w,
      secret: w.secret.substring(0, 8) + '...'
    }))

    return NextResponse.json({ webhooks: safeWebhooks })
  } catch (error) {
    logger.error('List webhooks error', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to list webhooks' },
      { status: 500 }
    )
  }
}

/**
 * Register a new webhook
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { url, events, parkingLotId, metadata } = body

    // Validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Valid URL is required' },
        { status: 400 }
      )
    }

    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Validate events
    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'At least one event type is required' },
        { status: 400 }
      )
    }

    const invalidEvents = events.filter(e => !VALID_EVENTS.includes(e))
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { error: `Invalid event types: ${invalidEvents.join(', ')}` },
        { status: 400 }
      )
    }

    // Register the webhook
    const webhook = await registerWebhook({
      url,
      events: events as WebhookEventType[],
      parkingLotId,
      metadata
    })

    return NextResponse.json({
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        enabled: webhook.enabled,
        secret: webhook.secret, // Only shown once on creation
        createdAt: webhook.createdAt
      },
      message: 'Webhook registered successfully. Save the secret - it will not be shown again.'
    }, { status: 201 })
  } catch (error) {
    logger.error('Register webhook error', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to register webhook' },
      { status: 500 }
    )
  }
}
