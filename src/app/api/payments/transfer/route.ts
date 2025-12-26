import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { nanoid } from 'nanoid'
import { emitBalanceUpdate, emitWalletTransaction } from '@/lib/socket/server'

// POST /api/payments/transfer - Transfer money between wallets (PayPal-style)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { fromWalletId, toWalletId, toEmail, amount, description, note } = body

    // Validate amount (in paise)
    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 })
    }

    // Need either toWalletId or toEmail
    if (!toWalletId && !toEmail) {
      return NextResponse.json(
        { success: false, error: 'Recipient wallet ID or email required' },
        { status: 400 }
      )
    }

    // Verify sender wallet ownership
    const senderWallet = await prisma.wallet.findFirst({
      where: { id: fromWalletId, userId: user.id },
      include: { sandboxConfig: true },
    })

    if (!senderWallet) {
      return NextResponse.json({ success: false, error: 'Sender wallet not found' }, { status: 404 })
    }

    // Check sufficient balance
    if (BigInt(senderWallet.balance) < BigInt(amount)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient balance' },
        { status: 400 }
      )
    }

    // Check transaction limits
    if (BigInt(amount) > BigInt(senderWallet.singleTxnLimit)) {
      return NextResponse.json(
        { success: false, error: 'Amount exceeds single transaction limit' },
        { status: 400 }
      )
    }

    // Find recipient wallet
    let receiverWallet
    if (toWalletId) {
      receiverWallet = await prisma.wallet.findFirst({
        where: { id: toWalletId },
      })
    } else if (toEmail) {
      // Find user by email, then their primary wallet
      const recipientUser = await prisma.user.findUnique({
        where: { email: toEmail },
      })

      if (recipientUser) {
        receiverWallet = await prisma.wallet.findFirst({
          where: { userId: recipientUser.id, walletType: 'PERSONAL' },
        })
      }
    }

    if (!receiverWallet) {
      return NextResponse.json(
        { success: false, error: 'Recipient wallet not found' },
        { status: 404 }
      )
    }

    // Prevent self-transfer
    if (senderWallet.id === receiverWallet.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot transfer to same wallet' },
        { status: 400 }
      )
    }

    // Check currency match
    if (senderWallet.currency !== receiverWallet.currency) {
      return NextResponse.json(
        { success: false, error: 'Currency mismatch. Cross-currency transfers not supported yet.' },
        { status: 400 }
      )
    }

    const referenceId = `TRF_${nanoid(12)}`
    const isSandbox = senderWallet.sandboxConfig !== null

    // Execute transfer atomically
    const result = await prisma.$transaction(async (tx) => {
      const senderNewBalance = BigInt(senderWallet.balance) - BigInt(amount)
      const receiverNewBalance = BigInt(receiverWallet.balance) + BigInt(amount)

      // Update sender balance
      await tx.wallet.update({
        where: { id: senderWallet.id },
        data: { balance: senderNewBalance },
      })

      // Update receiver balance
      await tx.wallet.update({
        where: { id: receiverWallet.id },
        data: { balance: receiverNewBalance },
      })

      // Create transaction record
      const transaction = await tx.walletTransaction.create({
        data: {
          senderWalletId: senderWallet.id,
          receiverWalletId: receiverWallet.id,
          amount: BigInt(amount),
          fee: BigInt(0), // No fee for wallet-to-wallet transfers
          txnType: 'TRANSFER',
          status: 'COMPLETED',
          referenceId,
          description: description || 'Wallet transfer',
          ...(note && { metadata: JSON.stringify({ note }) }),
          balanceAfter: senderNewBalance,
          isSandbox,
          completedAt: new Date(),
        },
      })

      return {
        transaction,
        senderNewBalance,
        receiverNewBalance,
      }
    })

    // Emit real-time updates to both wallets
    emitBalanceUpdate(senderWallet.id, {
      newBalance: Number(result.senderNewBalance),
      currency: senderWallet.currency,
      changeAmount: amount,
      changeType: 'debit',
    })

    emitWalletTransaction(senderWallet.id, {
      transactionId: result.transaction.id,
      amount,
      txnType: 'TRANSFER',
      status: 'COMPLETED',
      description: description || 'Wallet transfer',
      counterparty: toEmail || toWalletId,
    })

    emitBalanceUpdate(receiverWallet.id, {
      newBalance: Number(result.receiverNewBalance),
      currency: receiverWallet.currency,
      changeAmount: amount,
      changeType: 'credit',
    })

    emitWalletTransaction(receiverWallet.id, {
      transactionId: result.transaction.id,
      amount,
      txnType: 'TRANSFER',
      status: 'COMPLETED',
      description: description || 'Received transfer',
      counterparty: user.email || senderWallet.id,
    })

    return NextResponse.json({
      success: true,
      data: {
        ...result.transaction,
        amount: Number(result.transaction.amount),
        fee: 0,
        balanceAfter: Number(result.senderNewBalance),
      },
      message: 'Transfer completed successfully',
    })
  } catch (error) {
    console.error('Error processing transfer:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process transfer' },
      { status: 500 }
    )
  }
}
