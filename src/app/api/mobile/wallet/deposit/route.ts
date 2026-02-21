import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { getAuthUser } from '@/lib/auth/getAuthUser'
import { depositSchema } from '@/lib/validators/mobile'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    const body = await request.json()
    const { amount } = depositSchema.parse(body)

    const wallet = await prisma.wallet.findUnique({
      where: { userId: user.id },
    })

    if (!wallet) {
      return errorResponse('Wallet not found', 404)
    }

    const amountInPaisa = BigInt(Math.round(amount * 100))

    // MVP: auto-complete deposit (sandbox mode)
    const result = await prisma.$transaction(async (tx) => {
      const newBalance = wallet.balance + amountInPaisa

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      })

      const txn = await tx.walletTransaction.create({
        data: {
          receiverWalletId: wallet.id,
          amount: amountInPaisa,
          txnType: 'DEPOSIT',
          status: 'COMPLETED',
          description: 'Wallet top-up',
          balanceAfter: newBalance,
          completedAt: new Date(),
        },
      })

      return { balance: newBalance, txn }
    })

    return successResponse({
      balance: Number(result.balance) / 100,
      transaction: {
        id: result.txn.id,
        userId: user.id,
        type: 'deposit',
        amount,
        description: 'Wallet top-up',
        reference: result.txn.referenceId,
        createdAt: result.txn.createdAt.toISOString(),
        status: 'completed',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
