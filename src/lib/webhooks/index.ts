/**
 * Generic Webhook System
 * Allows external systems to subscribe to parking events
 */

import crypto from 'crypto'
import { prisma } from '@/lib/db'

// ============================================
// TYPES
// ============================================

export type WebhookEventType =
  | 'vehicle.entry'
  | 'vehicle.exit'
  | 'payment.completed'
  | 'payment.failed'
  | 'slot.occupied'
  | 'slot.vacated'
  | 'token.created'
  | 'token.completed'
  | 'alert.triggered'
  | 'occupancy.threshold'

export interface WebhookConfig {
  id: string
  url: string
  secret: string
  events: WebhookEventType[]
  enabled: boolean
  parkingLotId?: string
  metadata?: Record<string, string>
  retryCount: number
  createdAt: Date
}

export interface WebhookPayload {
  id: string
  event: WebhookEventType
  timestamp: string
  parkingLotId: string
  data: Record<string, unknown>
}

export interface WebhookDeliveryResult {
  webhookId: string
  success: boolean
  statusCode?: number
  responseTime: number
  error?: string
  retryScheduled: boolean
}

// ============================================
// WEBHOOK REGISTRY (In-memory, would be DB in production)
// ============================================

const webhookRegistry: Map<string, WebhookConfig> = new Map()

/**
 * Register a new webhook
 */
export async function registerWebhook(config: {
  url: string
  events: WebhookEventType[]
  parkingLotId?: string
  metadata?: Record<string, string>
}): Promise<WebhookConfig> {
  const id = crypto.randomUUID()
  const secret = crypto.randomBytes(32).toString('hex')

  const webhook: WebhookConfig = {
    id,
    url: config.url,
    secret,
    events: config.events,
    enabled: true,
    parkingLotId: config.parkingLotId,
    metadata: config.metadata,
    retryCount: 0,
    createdAt: new Date()
  }

  webhookRegistry.set(id, webhook)

  // In production, store in database
  console.log(`Webhook registered: ${id} -> ${config.url}`)

  return webhook
}

/**
 * Unregister a webhook
 */
export async function unregisterWebhook(webhookId: string): Promise<boolean> {
  return webhookRegistry.delete(webhookId)
}

/**
 * Get webhook by ID
 */
export async function getWebhook(webhookId: string): Promise<WebhookConfig | undefined> {
  return webhookRegistry.get(webhookId)
}

/**
 * List all webhooks
 */
export async function listWebhooks(parkingLotId?: string): Promise<WebhookConfig[]> {
  const webhooks = Array.from(webhookRegistry.values())
  if (parkingLotId) {
    return webhooks.filter(w => !w.parkingLotId || w.parkingLotId === parkingLotId)
  }
  return webhooks
}

/**
 * Update webhook configuration
 */
export async function updateWebhook(
  webhookId: string,
  updates: Partial<Pick<WebhookConfig, 'url' | 'events' | 'enabled' | 'metadata'>>
): Promise<WebhookConfig | null> {
  const webhook = webhookRegistry.get(webhookId)
  if (!webhook) return null

  const updated = { ...webhook, ...updates }
  webhookRegistry.set(webhookId, updated)

  return updated
}

// ============================================
// WEBHOOK DELIVERY
// ============================================

/**
 * Dispatch webhook event to all subscribers
 */
export async function dispatchWebhook(
  event: WebhookEventType,
  parkingLotId: string,
  data: Record<string, unknown>
): Promise<WebhookDeliveryResult[]> {
  const payload: WebhookPayload = {
    id: crypto.randomUUID(),
    event,
    timestamp: new Date().toISOString(),
    parkingLotId,
    data
  }

  // Find matching webhooks
  const webhooks = await listWebhooks(parkingLotId)
  const matchingWebhooks = webhooks.filter(
    w => w.enabled && w.events.includes(event)
  )

  // Deliver to each webhook
  const results = await Promise.all(
    matchingWebhooks.map(webhook => deliverWebhook(webhook, payload))
  )

  return results
}

/**
 * Deliver payload to a single webhook
 */
async function deliverWebhook(
  webhook: WebhookConfig,
  payload: WebhookPayload
): Promise<WebhookDeliveryResult> {
  const startTime = Date.now()

  try {
    // Generate signature
    const signature = generateSignature(payload, webhook.secret)

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-ID': webhook.id,
        'X-Event-Type': payload.event,
        'X-Delivery-ID': payload.id
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    })

    const responseTime = Date.now() - startTime

    if (response.ok) {
      // Reset retry count on success
      webhook.retryCount = 0
      webhookRegistry.set(webhook.id, webhook)

      return {
        webhookId: webhook.id,
        success: true,
        statusCode: response.status,
        responseTime,
        retryScheduled: false
      }
    } else {
      return handleDeliveryFailure(webhook, payload, response.status, responseTime)
    }
  } catch (error) {
    const responseTime = Date.now() - startTime
    return handleDeliveryFailure(
      webhook,
      payload,
      0,
      responseTime,
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}

function handleDeliveryFailure(
  webhook: WebhookConfig,
  payload: WebhookPayload,
  statusCode: number,
  responseTime: number,
  errorMessage?: string
): WebhookDeliveryResult {
  webhook.retryCount++
  webhookRegistry.set(webhook.id, webhook)

  const shouldRetry = webhook.retryCount < 5
  const retryScheduled = shouldRetry

  if (shouldRetry) {
    // Schedule retry with exponential backoff
    const delay = Math.pow(2, webhook.retryCount) * 1000 // 2s, 4s, 8s, 16s, 32s
    setTimeout(() => deliverWebhook(webhook, payload), delay)
  } else {
    // Disable webhook after too many failures
    webhook.enabled = false
    webhookRegistry.set(webhook.id, webhook)
    console.error(`Webhook ${webhook.id} disabled after ${webhook.retryCount} failures`)
  }

  return {
    webhookId: webhook.id,
    success: false,
    statusCode,
    responseTime,
    error: errorMessage || `HTTP ${statusCode}`,
    retryScheduled
  }
}

// ============================================
// SIGNATURE VERIFICATION
// ============================================

/**
 * Generate HMAC signature for payload
 */
export function generateSignature(payload: WebhookPayload, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(JSON.stringify(payload))
  return `sha256=${hmac.digest('hex')}`
}

/**
 * Verify webhook signature
 */
export function verifySignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  const expected = `sha256=${expectedSignature}`

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Emit vehicle entry event
 */
export async function emitVehicleEntry(
  parkingLotId: string,
  data: {
    tokenId: string
    tokenNumber: string
    licensePlate?: string
    vehicleType?: string
    slotId?: string
    entryTime: Date
  }
): Promise<WebhookDeliveryResult[]> {
  return dispatchWebhook('vehicle.entry', parkingLotId, data)
}

/**
 * Emit vehicle exit event
 */
export async function emitVehicleExit(
  parkingLotId: string,
  data: {
    tokenId: string
    tokenNumber: string
    licensePlate?: string
    duration: number
    amount: number
    paymentMethod?: string
    exitTime: Date
  }
): Promise<WebhookDeliveryResult[]> {
  return dispatchWebhook('vehicle.exit', parkingLotId, data)
}

/**
 * Emit payment event
 */
export async function emitPaymentEvent(
  parkingLotId: string,
  event: 'payment.completed' | 'payment.failed',
  data: {
    paymentId: string
    tokenId?: string
    amount: number
    method: string
    transactionId?: string
    error?: string
  }
): Promise<WebhookDeliveryResult[]> {
  return dispatchWebhook(event, parkingLotId, data)
}

/**
 * Emit occupancy threshold event
 */
export async function emitOccupancyThreshold(
  parkingLotId: string,
  data: {
    currentOccupancy: number
    threshold: number
    totalSlots: number
    availableSlots: number
  }
): Promise<WebhookDeliveryResult[]> {
  return dispatchWebhook('occupancy.threshold', parkingLotId, data)
}

/**
 * Emit alert event
 */
export async function emitAlert(
  parkingLotId: string,
  data: {
    alertType: string
    severity: 'low' | 'medium' | 'high'
    message: string
    details?: Record<string, unknown>
  }
): Promise<WebhookDeliveryResult[]> {
  return dispatchWebhook('alert.triggered', parkingLotId, data)
}
