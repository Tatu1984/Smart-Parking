import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { nanoid } from 'nanoid'
import { emitBalanceUpdate, emitWalletTransaction, emitPaymentEvent } from '@/lib/socket/server'
import { logger } from '@/lib/logger'

// POST /api/payments/parking - Pay for parking using wallet
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { walletId, tokenId, amount } = body

    if (!walletId || !tokenId || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: walletId, tokenId, amount' },
        { status: 400 }
      )
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

    // Find the parking token
    const token = await prisma.token.findFirst({
      where: { id: tokenId },
      include: {
        parkingLot: true,
        allocatedSlot: true,
      },
    })

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 })
    }

    if (token.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Token is not active' },
        { status: 400 }
      )
    }

    // Find merchant wallet (parking lot's wallet)
    const merchantWallet = await prisma.wallet.findFirst({
      where: {
        parkingLotId: token.parkingLotId,
        walletType: 'MERCHANT',
      },
    })

    if (!merchantWallet) {
      return NextResponse.json(
        { success: false, error: 'Parking facility wallet not configured' },
        { status: 400 }
      )
    }

    const referenceId = `PKG_${nanoid(12)}`
    const isSandbox = wallet.sandboxConfig !== undefined

    // Execute payment atomically
    const result = await prisma.$transaction(async (tx) => {
      const customerNewBalance = BigInt(wallet.balance) - BigInt(amount)
      const merchantNewBalance = BigInt(merchantWallet.balance) + BigInt(amount)

      // Update customer wallet
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: customerNewBalance },
      })

      // Update merchant wallet
      await tx.wallet.update({
        where: { id: merchantWallet.id },
        data: { balance: merchantNewBalance },
      })

      // Create wallet transaction
      const walletTxn = await tx.walletTransaction.create({
        data: {
          senderWalletId: wallet.id,
          receiverWalletId: merchantWallet.id,
          amount: BigInt(amount),
          fee: BigInt(0),
          txnType: 'PAYMENT',
          status: 'COMPLETED',
          referenceId,
          description: `Parking payment - ${token.tokenNumber}`,
          parkingTxnId: null, // Will update after creating parking transaction
          balanceAfter: customerNewBalance,
          isSandbox,
          completedAt: new Date(),
        },
      })

      // Create parking transaction
      const parkingTxn = await tx.transaction.create({
        data: {
          parkingLotId: token.parkingLotId,
          tokenId,
          entryTime: token.entryTime,
          exitTime: new Date(),
          duration: Math.floor((Date.now() - token.entryTime.getTime()) / 60000), // minutes
          grossAmount: amount,
          netAmount: amount,
          paymentMethod: 'WALLET',
          paymentStatus: 'COMPLETED',
          paymentRef: referenceId,
          paidAt: new Date(),
        },
      })

      // Update wallet transaction with parking transaction ID
      await tx.walletTransaction.update({
        where: { id: walletTxn.id },
        data: { parkingTxnId: parkingTxn.id },
      })

      // Update token status
      await tx.token.update({
        where: { id: tokenId },
        data: {
          status: 'COMPLETED',
          exitTime: new Date(),
        },
      })

      // Free up the parking slot if allocated
      if (token.allocatedSlotId) {
        await tx.slot.update({
          where: { id: token.allocatedSlotId },
          data: {
            status: 'AVAILABLE',
            isOccupied: false,
          },
        })
      }

      return {
        walletTxn,
        parkingTxn,
        customerNewBalance,
        merchantNewBalance,
        parkingLotId: token.parkingLotId,
        zoneId: token.allocatedSlot?.zoneId,
      }
    })

    // Emit real-time updates
    emitBalanceUpdate(wallet.id, {
      newBalance: Number(result.customerNewBalance),
      currency: wallet.currency,
      changeAmount: amount,
      changeType: 'debit',
    })

    emitWalletTransaction(wallet.id, {
      transactionId: result.walletTxn.id,
      amount,
      txnType: 'PAYMENT',
      status: 'COMPLETED',
      description: `Parking payment - ${token.tokenNumber}`,
    })

    emitPaymentEvent(result.parkingLotId, {
      transactionId: result.parkingTxn.id,
      tokenId,
      amount,
      method: 'WALLET',
      status: 'COMPLETED',
    })

    return NextResponse.json({
      success: true,
      data: {
        walletTransactionId: result.walletTxn.id,
        parkingTransactionId: result.parkingTxn.id,
        amount,
        tokenNumber: token.tokenNumber,
        balanceAfter: Number(result.customerNewBalance),
      },
      message: 'Parking payment completed successfully',
    })
  } catch (error) {
    logger.error('Error processing parking payment:', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { success: false, error: 'Failed to process parking payment' },
      { status: 500 }
    )
  }
}
