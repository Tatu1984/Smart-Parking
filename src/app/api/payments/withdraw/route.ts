import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { nanoid } from 'nanoid'
import { emitBalanceUpdate, emitWalletTransaction } from '@/lib/socket/server'
import { logger } from '@/lib/logger'

// POST /api/payments/withdraw - Withdraw money from wallet to bank account
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { walletId, bankAccountId, amount, description } = body

    // Validate amount (in paise)
    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 })
    }

    // Verify wallet ownership
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, userId: user.id },
      include: { sandboxConfig: true },
    })

    if (!wallet) {
      return NextResponse.json({ success: false, error: 'Wallet not found' }, { status: 404 })
    }

    // Check sufficient balance
    if (BigInt(wallet.balance) < BigInt(amount)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient wallet balance' },
        { status: 400 }
      )
    }

    // Check transaction limits
    if (BigInt(amount) > BigInt(wallet.singleTxnLimit)) {
      return NextResponse.json(
        { success: false, error: `Amount exceeds single transaction limit of ${Number(wallet.singleTxnLimit) / 100}` },
        { status: 400 }
      )
    }

    // Check daily limit
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dailyWithdrawals = await prisma.walletTransaction.aggregate({
      where: {
        senderWalletId: walletId,
        txnType: 'WITHDRAWAL',
        createdAt: { gte: today },
        status: { in: ['COMPLETED', 'PENDING'] },
      },
      _sum: { amount: true },
    })

    const dailyUsed = Number(dailyWithdrawals._sum.amount || 0)
    if (dailyUsed + amount > Number(wallet.dailyLimit)) {
      return NextResponse.json(
        { success: false, error: 'Daily withdrawal limit exceeded' },
        { status: 400 }
      )
    }

    // Verify bank account ownership and status
    const bankAccount = await prisma.bankAccount.findFirst({
      where: {
        id: bankAccountId,
        walletId,
        status: 'VERIFIED',
      },
    })

    if (!bankAccount) {
      return NextResponse.json(
        { success: false, error: 'Bank account not found or not verified' },
        { status: 404 }
      )
    }

    const isSandbox = bankAccount.isSandbox
    const referenceId = `WD_${nanoid(12)}`

    // Calculate fee (0.5% for withdrawals, min 5 rupees, max 50 rupees) - waived for sandbox
    let fee = 0
    if (!isSandbox) {
      fee = Math.min(Math.max(Math.floor(amount * 0.005), 500), 5000)
    }
    const totalDeduction = amount + fee

    if (BigInt(wallet.balance) < BigInt(totalDeduction)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient balance including fees' },
        { status: 400 }
      )
    }

    // Create transaction and update balances atomically
    const result = await prisma.$transaction(async (tx) => {
      const newBalance = BigInt(wallet.balance) - BigInt(totalDeduction)

      // Deduct from wallet immediately (hold)
      await tx.wallet.update({
        where: { id: walletId },
        data: { balance: newBalance },
      })

      // Create the wallet transaction
      const transaction = await tx.walletTransaction.create({
        data: {
          senderWalletId: walletId,
          bankAccountId,
          amount: BigInt(amount),
          fee: BigInt(fee),
          txnType: 'WITHDRAWAL',
          status: isSandbox ? 'COMPLETED' : 'PENDING',
          referenceId,
          description: description || 'Withdrawal to bank account',
          balanceAfter: newBalance,
          isSandbox,
          completedAt: isSandbox ? new Date() : null,
        },
      })

      // For sandbox, credit the bank account balance
      if (isSandbox) {
        await tx.bankAccount.update({
          where: { id: bankAccountId },
          data: {
            sandboxBalance: (bankAccount.sandboxBalance || BigInt(0)) + BigInt(amount),
          },
        })
      }

      return { transaction, newBalance }
    })

    // Emit real-time updates
    emitBalanceUpdate(walletId, {
      newBalance: Number(result.newBalance),
      currency: wallet.currency,
      changeAmount: totalDeduction,
      changeType: 'debit',
    })

    emitWalletTransaction(walletId, {
      transactionId: result.transaction.id,
      amount,
      txnType: 'WITHDRAWAL',
      status: isSandbox ? 'COMPLETED' : 'PENDING',
      description: description || 'Withdrawal to bank account',
    })

    return NextResponse.json({
      success: true,
      data: {
        ...result.transaction,
        amount: Number(result.transaction.amount),
        fee: Number(result.transaction.fee),
        balanceAfter: Number(result.newBalance),
        estimatedArrival: isSandbox ? 'Instant' : '1-3 business days',
      },
      message: isSandbox
        ? 'Withdrawal completed instantly (sandbox mode)'
        : 'Withdrawal initiated. Funds will reach your bank in 1-3 business days.',
    })
  } catch (error) {
    logger.error('Error processing withdrawal:', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { success: false, error: 'Failed to process withdrawal' },
      { status: 500 }
    )
  }
}
