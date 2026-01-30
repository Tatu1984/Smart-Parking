import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { nanoid } from 'nanoid'
import { emitBalanceUpdate, emitWalletTransaction } from '@/lib/socket/server'
import { logger } from '@/lib/logger'

// POST /api/payments/request/[id]/pay - Pay a payment request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { walletId, note } = body

    // Find the payment request
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [{ id }, { paymentRef: id }],
      },
      include: {
        payeeWallet: true,
      },
    })

    if (!payment) {
      return NextResponse.json({ success: false, error: 'Payment request not found' }, { status: 404 })
    }

    if (payment.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: `Payment is ${payment.status.toLowerCase()}` },
        { status: 400 }
      )
    }

    if (payment.expiresAt && new Date() > payment.expiresAt) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'EXPIRED' },
      })
      return NextResponse.json({ success: false, error: 'Payment request has expired' }, { status: 400 })
    }

    // Verify payer wallet ownership
    const payerWallet = await prisma.wallet.findFirst({
      where: { id: walletId, userId: user.id },
    })

    if (!payerWallet) {
      return NextResponse.json({ success: false, error: 'Payer wallet not found' }, { status: 404 })
    }

    // If payment has a specific payer, verify it's this wallet
    if (payment.payerWalletId && payment.payerWalletId !== walletId) {
      return NextResponse.json(
        { success: false, error: 'This payment request is for a different wallet' },
        { status: 403 }
      )
    }

    // Can't pay to yourself
    if (payerWallet.id === payment.payeeWalletId) {
      return NextResponse.json(
        { success: false, error: 'Cannot pay to yourself' },
        { status: 400 }
      )
    }

    const amount = Number(payment.amount)

    // Check sufficient balance
    if (BigInt(payerWallet.balance) < payment.amount) {
      return NextResponse.json(
        { success: false, error: 'Insufficient balance' },
        { status: 400 }
      )
    }

    const referenceId = `TXN_${nanoid(12)}`

    // Execute payment atomically
    const result = await prisma.$transaction(async (tx) => {
      const payerNewBalance = BigInt(payerWallet.balance) - payment.amount
      const payeeNewBalance = BigInt(payment.payeeWallet.balance) + payment.amount

      // Update payer balance
      await tx.wallet.update({
        where: { id: payerWallet.id },
        data: { balance: payerNewBalance },
      })

      // Update payee balance
      await tx.wallet.update({
        where: { id: payment.payeeWalletId },
        data: { balance: payeeNewBalance },
      })

      // Create transaction record
      const transaction = await tx.walletTransaction.create({
        data: {
          senderWalletId: payerWallet.id,
          receiverWalletId: payment.payeeWalletId,
          amount: payment.amount,
          fee: BigInt(0),
          txnType: 'PAYMENT',
          status: 'COMPLETED',
          referenceId,
          description: payment.description || 'Payment',
          ...(note && { metadata: JSON.stringify({ note }) }),
          balanceAfter: payerNewBalance,
          isSandbox: payment.isSandbox,
          completedAt: new Date(),
        },
      })

      // Update payment status
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          payerWalletId: payerWallet.id,
          transactionId: transaction.id,
          completedAt: new Date(),
        },
      })

      return {
        transaction,
        payerNewBalance,
        payeeNewBalance,
      }
    })

    // Emit real-time updates
    emitBalanceUpdate(payerWallet.id, {
      newBalance: Number(result.payerNewBalance),
      currency: payerWallet.currency,
      changeAmount: amount,
      changeType: 'debit',
    })

    emitWalletTransaction(payerWallet.id, {
      transactionId: result.transaction.id,
      amount,
      txnType: 'PAYMENT',
      status: 'COMPLETED',
      description: payment.description || 'Payment',
    })

    emitBalanceUpdate(payment.payeeWalletId, {
      newBalance: Number(result.payeeNewBalance),
      currency: payment.payeeWallet.currency,
      changeAmount: amount,
      changeType: 'credit',
    })

    emitWalletTransaction(payment.payeeWalletId, {
      transactionId: result.transaction.id,
      amount,
      txnType: 'PAYMENT',
      status: 'COMPLETED',
      description: 'Payment received',
    })

    return NextResponse.json({
      success: true,
      data: {
        paymentId: payment.id,
        transactionId: result.transaction.id,
        amount,
        balanceAfter: Number(result.payerNewBalance),
      },
      message: 'Payment completed successfully',
    })
  } catch (error) {
    logger.error('Error processing payment:', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { success: false, error: 'Failed to process payment' },
      { status: 500 }
    )
  }
}
