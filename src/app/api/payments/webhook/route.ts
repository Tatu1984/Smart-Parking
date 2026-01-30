import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'
import { sendNotification } from '@/lib/notifications'
import { logger } from '@/lib/logger'

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET

// POST /api/payments/webhook - Razorpay webhook handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-razorpay-signature')

    // In production, require proper signature verification
    if (process.env.NODE_ENV === 'production') {
      if (!RAZORPAY_WEBHOOK_SECRET) {
        logger.error('RAZORPAY_WEBHOOK_SECRET not configured')
        return NextResponse.json(
          { error: 'Webhook not configured' },
          { status: 500 }
        )
      }

      if (!signature) {
        logger.error('Missing webhook signature')
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
      }

      // Verify webhook signature using timing-safe comparison
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
        .update(body)
        .digest('hex')

      const signatureBuffer = Buffer.from(signature, 'hex')
      const expectedBuffer = Buffer.from(expectedSignature, 'hex')

      if (signatureBuffer.length !== expectedBuffer.length ||
          !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        logger.error('Invalid webhook signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } else {
      // Development mode: verify if secret is configured, otherwise skip silently
      if (RAZORPAY_WEBHOOK_SECRET && signature) {
        const expectedSignature = crypto
          .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
          .update(body)
          .digest('hex')

        if (signature !== expectedSignature) {
          logger.debug('Webhook signature mismatch in development')
        }
      } else {
        logger.debug('Webhook signature verification skipped in development')
      }
    }

    const payload = JSON.parse(body)
    const { event, payload: eventPayload } = payload

    logger.info(`Razorpay webhook received: ${event}`)

    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(eventPayload.payment.entity)
        break

      case 'payment.failed':
        await handlePaymentFailed(eventPayload.payment.entity)
        break

      case 'refund.created':
        await handleRefundCreated(eventPayload.refund.entity)
        break

      case 'order.paid':
        await handleOrderPaid(eventPayload.order.entity, eventPayload.payment.entity)
        break

      default:
        logger.debug(`Unhandled webhook event: ${event}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('Webhook processing error:', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handlePaymentCaptured(paymentEntity: {
  id: string
  order_id: string
  amount: number
  currency: string
  method: string
  email?: string
  contact?: string
}) {
  try {
    // Find payment by razorpay order ID stored in metadata
    const payments = await prisma.payment.findMany({
      where: { status: 'PENDING' }
    })

    // Find payment with matching razorpay order ID in metadata
    const payment = payments.find(p => {
      const metadata = p.metadata as Record<string, unknown> | null
      return metadata?.razorpayOrderId === paymentEntity.order_id
    })

    if (!payment) {
      logger.debug(`Payment not found for order: ${paymentEntity.order_id}`)
      return
    }

    // Update payment status
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        metadata: {
          ...((payment.metadata as object) || {}),
          razorpayPaymentId: paymentEntity.id,
          method: paymentEntity.method,
          email: paymentEntity.email,
          contact: paymentEntity.contact
        }
      }
    })

    // Update token if present
    if (payment.tokenId) {
      await prisma.token.update({
        where: { id: payment.tokenId },
        data: {
          status: 'COMPLETED'
        }
      })
    }

    logger.info(`Payment captured: ${paymentEntity.id}`)
  } catch (error) {
    logger.error('Error handling payment captured:', error instanceof Error ? error : undefined)
  }
}

async function handlePaymentFailed(paymentEntity: {
  id: string
  order_id: string
  error_code?: string
  error_description?: string
}) {
  try {
    // Find payment by razorpay order ID stored in metadata
    const payments = await prisma.payment.findMany({
      where: { status: 'PENDING' }
    })

    const payment = payments.find(p => {
      const metadata = p.metadata as Record<string, unknown> | null
      return metadata?.razorpayOrderId === paymentEntity.order_id
    })

    if (!payment) return

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        metadata: {
          ...((payment.metadata as object) || {}),
          errorCode: paymentEntity.error_code,
          errorDescription: paymentEntity.error_description
        }
      }
    })

    // Send failure notification if token exists
    if (payment.tokenId) {
      const token = await prisma.token.findUnique({
        where: { id: payment.tokenId }
      })

      if (token) {
        await sendNotification({
          type: 'PAYMENT_FAILED',
          title: 'Payment Failed',
          message: `Your payment for token ${token.tokenNumber} failed. Please try again.`,
          data: {
            tokenNumber: token.tokenNumber,
            error: paymentEntity.error_description
          }
        })
      }
    }

    logger.info(`Payment failed: ${paymentEntity.id}`)
  } catch (error) {
    logger.error('Error handling payment failed:', error instanceof Error ? error : undefined)
  }
}

async function handleRefundCreated(refundEntity: {
  id: string
  payment_id: string
  amount: number
  status: string
}) {
  try {
    // Find payment by razorpay payment ID stored in metadata
    const payments = await prisma.payment.findMany({
      where: { status: 'COMPLETED' }
    })

    const payment = payments.find(p => {
      const metadata = p.metadata as Record<string, unknown> | null
      return metadata?.razorpayPaymentId === refundEntity.payment_id
    })

    if (!payment) return

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'REFUNDED',
        metadata: {
          ...((payment.metadata as object) || {}),
          refundId: refundEntity.id,
          refundAmount: refundEntity.amount / 100,
          refundedAt: new Date().toISOString()
        }
      }
    })

    logger.info(`Refund created: ${refundEntity.id}`)
  } catch (error) {
    logger.error('Error handling refund created:', error instanceof Error ? error : undefined)
  }
}

async function handleOrderPaid(
  orderEntity: { id: string; receipt: string },
  paymentEntity: { id: string }
) {
  try {
    // Find payment by razorpay order ID stored in metadata
    const payments = await prisma.payment.findMany({
      where: { status: { in: ['PENDING', 'AWAITING_PAYMENT', 'PROCESSING'] } }
    })

    const payment = payments.find(p => {
      const metadata = p.metadata as Record<string, unknown> | null
      return metadata?.razorpayOrderId === orderEntity.id
    })

    if (!payment) return

    if (payment.status !== 'COMPLETED') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          metadata: {
            ...((payment.metadata as object) || {}),
            razorpayPaymentId: paymentEntity.id
          }
        }
      })
    }

    logger.info(`Order paid: ${orderEntity.id}`)
  } catch (error) {
    logger.error('Error handling order paid:', error instanceof Error ? error : undefined)
  }
}
