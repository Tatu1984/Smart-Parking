import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'
import { sendNotification } from '@/lib/notifications'

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || ''

// POST /api/payments/webhook - Razorpay webhook handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-razorpay-signature')

    // Verify webhook signature
    if (RAZORPAY_WEBHOOK_SECRET && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
        .update(body)
        .digest('hex')

      if (signature !== expectedSignature) {
        console.error('Invalid webhook signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
      }
    }

    const payload = JSON.parse(body)
    const { event, payload: eventPayload } = payload

    console.log(`Razorpay webhook received: ${event}`)

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
        console.log(`Unhandled webhook event: ${event}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
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
    // Find payment by order ID
    const payment = await prisma.payment.findFirst({
      where: { orderId: paymentEntity.order_id },
      include: { token: true }
    })

    if (!payment) {
      console.log(`Payment not found for order: ${paymentEntity.order_id}`)
      return
    }

    // Update payment status
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        transactionId: paymentEntity.id,
        paidAt: new Date(),
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
          status: 'PAID',
          paymentId: payment.id,
          fee: payment.amount
        }
      })
    }

    console.log(`Payment captured: ${paymentEntity.id}`)
  } catch (error) {
    console.error('Error handling payment captured:', error)
  }
}

async function handlePaymentFailed(paymentEntity: {
  id: string
  order_id: string
  error_code?: string
  error_description?: string
}) {
  try {
    const payment = await prisma.payment.findFirst({
      where: { orderId: paymentEntity.order_id },
      include: { token: true }
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

    // Send failure notification
    if (payment.token?.email) {
      await sendNotification({
        type: 'PAYMENT_FAILED',
        email: payment.token.email,
        title: 'Payment Failed',
        message: `Your payment for token ${payment.token.tokenNumber} failed. Please try again.`,
        data: {
          tokenNumber: payment.token.tokenNumber,
          error: paymentEntity.error_description
        }
      })
    }

    console.log(`Payment failed: ${paymentEntity.id}`)
  } catch (error) {
    console.error('Error handling payment failed:', error)
  }
}

async function handleRefundCreated(refundEntity: {
  id: string
  payment_id: string
  amount: number
  status: string
}) {
  try {
    const payment = await prisma.payment.findFirst({
      where: { transactionId: refundEntity.payment_id }
    })

    if (!payment) return

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
        refundAmount: refundEntity.amount / 100,
        metadata: {
          ...((payment.metadata as object) || {}),
          refundId: refundEntity.id
        }
      }
    })

    console.log(`Refund created: ${refundEntity.id}`)
  } catch (error) {
    console.error('Error handling refund created:', error)
  }
}

async function handleOrderPaid(
  orderEntity: { id: string; receipt: string },
  paymentEntity: { id: string }
) {
  try {
    const payment = await prisma.payment.findFirst({
      where: { orderId: orderEntity.id }
    })

    if (!payment) return

    if (payment.status !== 'COMPLETED') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          transactionId: paymentEntity.id,
          paidAt: new Date()
        }
      })
    }

    console.log(`Order paid: ${orderEntity.id}`)
  } catch (error) {
    console.error('Error handling order paid:', error)
  }
}
