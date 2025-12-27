import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPaymentSignature, getPayment } from '@/lib/payments/razorpay'
import { sendNotification } from '@/lib/notifications'

// POST /api/payments/verify - Verify Razorpay payment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentId
    } = body

    // Verify signature
    const isValid = verifyPaymentSignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    })

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid payment signature' },
        { status: 400 }
      )
    }

    // Get payment details from Razorpay
    const razorpayPayment = await getPayment(razorpay_payment_id)

    if (razorpayPayment.status !== 'captured') {
      return NextResponse.json(
        { error: 'Payment not captured' },
        { status: 400 }
      )
    }

    // Update payment record
    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        metadata: {
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          method: razorpayPayment.method
        }
      }
    })

    // Update token status and send notification if token exists
    if (payment.tokenId) {
      const token = await prisma.token.update({
        where: { id: payment.tokenId },
        data: {
          status: 'COMPLETED'
        }
      })

      // Send payment confirmation notification
      // Note: Token doesn't have email field, would need to look up via vehicle or other means
      await sendNotification({
        type: 'PAYMENT_SUCCESS',
        title: 'Payment Successful',
        message: `Payment of ₹${payment.amount} for token ${token.tokenNumber} has been processed.`,
        data: {
          tokenNumber: token.tokenNumber,
          amount: Number(payment.amount),
          transactionId: razorpay_payment_id
        }
      })
    }

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      transactionId: razorpay_payment_id,
      message: 'Payment verified successfully'
    })
  } catch (error) {
    console.error('Payment verification error:', error)
    return NextResponse.json(
      { error: 'Payment verification failed' },
      { status: 500 }
    )
  }
}
