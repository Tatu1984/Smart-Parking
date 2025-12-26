import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { nanoid } from 'nanoid'
import { emitBalanceUpdate, emitWalletTransaction } from '@/lib/socket/server'

// POST /api/payments/deposit - Add money to wallet from bank account
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

    // Check if sandbox mode
    const isSandbox = bankAccount.isSandbox

    // For sandbox, check if there's enough balance in test bank
    if (isSandbox) {
      const sandboxBalance = bankAccount.sandboxBalance || BigInt(0)
      if (sandboxBalance < BigInt(amount)) {
        return NextResponse.json(
          { success: false, error: 'Insufficient sandbox bank balance' },
          { status: 400 }
        )
      }
    }

    const referenceId = `DEP_${nanoid(12)}`

    // Create transaction and update balances atomically
    const result = await prisma.$transaction(async (tx) => {
      // Create the wallet transaction
      const transaction = await tx.walletTransaction.create({
        data: {
          receiverWalletId: walletId,
          bankAccountId,
          amount: BigInt(amount),
          fee: BigInt(0), // No fee for deposits
          txnType: 'DEPOSIT',
          status: isSandbox ? 'COMPLETED' : 'PENDING', // Sandbox deposits are instant
          referenceId,
          description: description || 'Deposit from bank account',
          isSandbox,
        },
      })

      if (isSandbox || wallet.sandboxConfig?.autoApproveDeposits) {
        // Instant processing for sandbox
        const newBalance = BigInt(wallet.balance) + BigInt(amount)

        // Update wallet balance
        await tx.wallet.update({
          where: { id: walletId },
          data: { balance: newBalance },
        })

        // Deduct from sandbox bank balance
        if (isSandbox) {
          await tx.bankAccount.update({
            where: { id: bankAccountId },
            data: {
              sandboxBalance: (bankAccount.sandboxBalance || BigInt(0)) - BigInt(amount),
            },
          })
        }

        // Update transaction with final balance
        await tx.walletTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'COMPLETED',
            balanceAfter: newBalance,
            completedAt: new Date(),
          },
        })

        return {
          transaction: { ...transaction, status: 'COMPLETED', balanceAfter: newBalance },
          newBalance,
        }
      }

      return { transaction, newBalance: null }
    })

    // Emit real-time updates
    if (result.newBalance !== null) {
      emitBalanceUpdate(walletId, {
        newBalance: Number(result.newBalance),
        currency: wallet.currency,
        changeAmount: amount,
        changeType: 'credit',
      })

      emitWalletTransaction(walletId, {
        transactionId: result.transaction.id,
        amount,
        txnType: 'DEPOSIT',
        status: 'COMPLETED',
        description: description || 'Deposit from bank account',
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result.transaction,
        amount: Number(result.transaction.amount),
        fee: 0,
        balanceAfter: result.newBalance ? Number(result.newBalance) : null,
      },
      message: isSandbox
        ? 'Deposit completed instantly (sandbox mode)'
        : 'Deposit initiated. Funds will be available after bank confirmation.',
    })
  } catch (error) {
    console.error('Error processing deposit:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process deposit' },
      { status: 500 }
    )
  }
}
