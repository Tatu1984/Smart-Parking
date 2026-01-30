/**
 * Sandbox Payment Simulation API
 * Simulates payment processing for demo/testing
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db'
import { isSandboxMode, getSandboxConfig, SANDBOX_CARDS, SANDBOX_UPI } from '@/lib/sandbox'
import { v4 as uuid } from 'uuid'
import { logger } from '@/lib/logger'

interface PaymentRequest {
  amount: number
  method: 'card' | 'upi' | 'wallet'
  tokenId?: string
  parkingLotId: string
  // Card details (sandbox)
  cardNumber?: string
  cardExpiry?: string
  cardCvv?: string
  // UPI details
  upiId?: string
}

// POST /api/sandbox/payment - Simulate payment
export async function POST(request: NextRequest) {
  if (!isSandboxMode()) {
    return NextResponse.json(
      { error: 'Sandbox mode is not enabled' },
      { status: 400 }
    )
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body: PaymentRequest = await request.json()
    const config = getSandboxConfig()

    // Simulate processing delay
    if (config.simulatePayments) {
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000))
    }

    // Check for simulated failures
    const shouldFail = Math.random() > config.paymentSuccessRate

    // Determine payment result based on test credentials
    let paymentStatus: 'success' | 'failed' | 'pending' = 'success'
    let failureReason: string | undefined

    if (body.method === 'card' && body.cardNumber) {
      if (body.cardNumber.replace(/\s/g, '') === SANDBOX_CARDS.decline.number) {
        paymentStatus = 'failed'
        failureReason = 'Card declined by issuer'
      } else if (body.cardNumber.replace(/\s/g, '') === SANDBOX_CARDS.insufficientFunds.number) {
        paymentStatus = 'failed'
        failureReason = 'Insufficient funds'
      }
    }

    if (body.method === 'upi' && body.upiId) {
      if (body.upiId === SANDBOX_UPI.failure) {
        paymentStatus = 'failed'
        failureReason = 'UPI transaction failed'
      } else if (body.upiId === SANDBOX_UPI.pending) {
        paymentStatus = 'pending'
      }
    }

    // Override with random failure if configured
    if (shouldFail && paymentStatus === 'success') {
      paymentStatus = 'failed'
      failureReason = 'Simulated random failure for testing'
    }

    const paymentRef = `SANDBOX-${uuid().slice(0, 8).toUpperCase()}`
    const transactionId = `TXN-${Date.now()}`

    // Get merchant wallet
    const merchantWallet = await prisma.wallet.findFirst({
      where: { parkingLotId: body.parkingLotId },
    })

    if (!merchantWallet) {
      return NextResponse.json(
        { error: 'Merchant wallet not found' },
        { status: 400 }
      )
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        payeeWalletId: merchantWallet.id,
        amount: BigInt(body.amount),
        currency: 'INR',
        paymentType: 'PARKING',
        status: paymentStatus === 'success' ? 'COMPLETED' : paymentStatus === 'pending' ? 'PENDING' : 'FAILED',
        paymentRef,
        parkingLotId: body.parkingLotId,
        tokenId: body.tokenId,
        description: 'Sandbox payment simulation',
        isSandbox: true,
        completedAt: paymentStatus === 'success' ? new Date() : undefined,
        metadata: {
          sandbox: true,
          method: body.method,
          simulatedAt: new Date().toISOString(),
          failureReason,
        },
      },
    })

    // Update token if payment successful
    if (paymentStatus === 'success' && body.tokenId) {
      await prisma.token.update({
        where: { id: body.tokenId },
        data: {
          status: 'COMPLETED',
          exitTime: new Date(),
        },
      })

      // Create transaction record
      const token = await prisma.token.findUnique({
        where: { id: body.tokenId },
      })

      if (token) {
        const duration = token.entryTime
          ? Math.ceil((Date.now() - token.entryTime.getTime()) / (1000 * 60))
          : 0

        await prisma.transaction.create({
          data: {
            parkingLotId: body.parkingLotId,
            tokenId: body.tokenId,
            entryTime: token.entryTime,
            exitTime: new Date(),
            duration,
            grossAmount: body.amount,
            netAmount: body.amount,
            currency: 'INR',
            paymentStatus: 'COMPLETED',
            paymentMethod: body.method.toUpperCase() as any,
            paymentRef,
            paidAt: new Date(),
            receiptNumber: `RCP-${Date.now()}`,
          },
        })
      }
    }

    return NextResponse.json({
      success: paymentStatus === 'success',
      data: {
        paymentId: payment.id,
        paymentRef,
        transactionId,
        status: paymentStatus,
        amount: body.amount,
        amountFormatted: `₹${(body.amount / 100).toFixed(2)}`,
        method: body.method,
        failureReason,
        sandbox: true,
        timestamp: new Date().toISOString(),
      },
      message: paymentStatus === 'success'
        ? 'Payment processed successfully (sandbox)'
        : paymentStatus === 'pending'
          ? 'Payment pending (sandbox)'
          : `Payment failed: ${failureReason}`,
    })
  } catch (error) {
    logger.error('Sandbox payment error:', error instanceof Error ? error : undefined)
    return NextResponse.json(
      {
        success: false,
        error: 'Payment simulation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// GET /api/sandbox/payment - Get sandbox payment instructions
export async function GET() {
  return NextResponse.json({
    success: true,
    sandbox: true,
    instructions: {
      card: {
        success: SANDBOX_CARDS.success,
        decline: SANDBOX_CARDS.decline,
        insufficientFunds: SANDBOX_CARDS.insufficientFunds,
      },
      upi: {
        success: SANDBOX_UPI.success,
        failure: SANDBOX_UPI.failure,
        pending: SANDBOX_UPI.pending,
      },
      notes: [
        'All sandbox payments are simulated and do not involve real money',
        'Use the provided test credentials for different scenarios',
        'Sandbox mode can be toggled via /api/sandbox endpoint',
      ],
    },
  })
}
