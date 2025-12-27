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
        transactionId: razorpay_payment_id,
        paidAt: new Date(),
        metadata: {
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          method: razorpayPayment.method
        }
      },
      include: {
        token: true
      }
    })

    // Update token status
    if (payment.tokenId) {
      await prisma.token.update({
        where: { id: payment.tokenId },
        data: {
          status: 'PAID',
          paymentId: payment.id,
          fee: payment.amount
        }
      })

      // Send payment confirmation notification
      if (payment.token?.email) {
        await sendNotification({
          type: 'PAYMENT_SUCCESS',
          email: payment.token.email,
          title: 'Payment Successful',
          message: `Your payment of ₹${payment.amount} for token ${payment.token.tokenNumber} has been processed.`,
          data: {
            tokenNumber: payment.token.tokenNumber,
            amount: payment.amount,
            transactionId: razorpay_payment_id
          }
        })
      }
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
