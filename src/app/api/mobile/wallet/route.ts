import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { getAuthUser } from '@/lib/auth/getAuthUser'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    const wallet = await prisma.wallet.findUnique({
      where: { userId: user.id },
      include: {
        sentTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            amount: true,
            txnType: true,
            status: true,
            description: true,
            referenceId: true,
            createdAt: true,
          },
        },
        receivedTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            amount: true,
            txnType: true,
            status: true,
            description: true,
            referenceId: true,
            createdAt: true,
          },
        },
      },
    })

    if (!wallet) {
      return errorResponse('Wallet not found', 404)
    }

    // Merge and sort recent transactions
    const TXN_TYPE_MAP: Record<string, string> = {
      DEPOSIT: 'deposit',
      PAYMENT: 'payment',
      REFUND: 'refund',
      TRANSFER: 'transfer',
      WITHDRAWAL: 'deposit',
      FEE: 'payment',
      ADJUSTMENT: 'refund',
    }

    const TXN_STATUS_MAP: Record<string, string> = {
      COMPLETED: 'completed',
      PENDING: 'pending',
      PROCESSING: 'pending',
      FAILED: 'failed',
      CANCELLED: 'failed',
      REVERSED: 'failed',
    }

    const allTxns = [
      ...wallet.sentTransactions.map((t) => ({ ...t, direction: 'sent' as const })),
      ...wallet.receivedTransactions.map((t) => ({ ...t, direction: 'received' as const })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        userId: user.id,
        type: TXN_TYPE_MAP[t.txnType] || 'payment',
        amount: Number(t.amount) / 100,
        description: t.description || '',
        reference: t.referenceId,
        createdAt: t.createdAt.toISOString(),
        status: TXN_STATUS_MAP[t.status] || 'pending',
      }))

    return successResponse({
      balance: Number(wallet.balance) / 100,
      transactions: allTxns,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
