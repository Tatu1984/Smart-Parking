import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { getAuthUser } from '@/lib/auth/getAuthUser'
import { processPaymentSchema } from '@/lib/validators/mobile'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    const body = await request.json()
    const { sessionId, amount, paymentMethod } = processPaymentSchema.parse(body)

    // Find the token (parking session)
    const token = await prisma.token.findUnique({
      where: { id: sessionId },
      include: { vehicle: { select: { userId: true } } },
    })

    if (!token) {
      return errorResponse('Session not found', 404)
    }

    if (token.vehicle?.userId !== user.id) {
      return errorResponse('Not authorized for this session', 403)
    }

    if (token.status !== 'ACTIVE') {
      return errorResponse('Session is not active', 400)
    }

    const amountInPaisa = Math.round(amount * 100)

    if (paymentMethod === 'WALLET') {
      const wallet = await prisma.wallet.findUnique({
        where: { userId: user.id },
      })

      if (!wallet) {
        return errorResponse('Wallet not found', 404)
      }

      if (Number(wallet.balance) < amountInPaisa) {
        return errorResponse('Insufficient wallet balance', 400)
      }

      // Process wallet payment
      await prisma.$transaction(async (tx) => {
        // Debit wallet
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: wallet.balance - BigInt(amountInPaisa) },
        })

        // Create wallet transaction
        await tx.walletTransaction.create({
          data: {
            senderWalletId: wallet.id,
            amount: BigInt(amountInPaisa),
            txnType: 'PAYMENT',
            status: 'COMPLETED',
            description: `Parking payment - ${token.tokenNumber}`,
            balanceAfter: wallet.balance - BigInt(amountInPaisa),
            completedAt: new Date(),
          },
        })

        // Create parking transaction
        await tx.transaction.create({
          data: {
            parkingLotId: token.parkingLotId,
            tokenId: token.id,
            entryTime: token.entryTime,
            exitTime: new Date(),
            duration: Math.ceil((Date.now() - token.entryTime.getTime()) / 60000),
            grossAmount: amountInPaisa,
            netAmount: amountInPaisa,
            paymentStatus: 'COMPLETED',
            paymentMethod: 'WALLET',
            paidAt: new Date(),
          },
        })

        // Complete the token
        await tx.token.update({
          where: { id: sessionId },
          data: { status: 'COMPLETED', exitTime: new Date() },
        })
      })
    } else {
      // For UPI/CARD: create transaction record (in MVP, auto-complete)
      await prisma.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            parkingLotId: token.parkingLotId,
            tokenId: token.id,
            entryTime: token.entryTime,
            exitTime: new Date(),
            duration: Math.ceil((Date.now() - token.entryTime.getTime()) / 60000),
            grossAmount: amountInPaisa,
            netAmount: amountInPaisa,
            paymentStatus: 'COMPLETED',
            paymentMethod: paymentMethod === 'UPI' ? 'UPI' : 'CARD',
            paidAt: new Date(),
          },
        })

        await tx.token.update({
          where: { id: sessionId },
          data: { status: 'COMPLETED', exitTime: new Date() },
        })
      })
    }

    return successResponse({
      success: true,
      message: 'Payment processed successfully',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
