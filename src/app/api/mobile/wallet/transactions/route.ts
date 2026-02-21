import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { getAuthUser } from '@/lib/auth/getAuthUser'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    const wallet = await prisma.wallet.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })

    if (!wallet) {
      return errorResponse('Wallet not found', 404)
    }

    const [sent, received] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { senderWalletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, amount: true, txnType: true, status: true,
          description: true, referenceId: true, createdAt: true,
        },
      }),
      prisma.walletTransaction.findMany({
        where: { receiverWalletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, amount: true, txnType: true, status: true,
          description: true, referenceId: true, createdAt: true,
        },
      }),
    ])

    const TXN_TYPE_MAP: Record<string, string> = {
      DEPOSIT: 'deposit', PAYMENT: 'payment', REFUND: 'refund',
      TRANSFER: 'transfer', WITHDRAWAL: 'deposit', FEE: 'payment', ADJUSTMENT: 'refund',
    }
    const TXN_STATUS_MAP: Record<string, string> = {
      COMPLETED: 'completed', PENDING: 'pending', PROCESSING: 'pending',
      FAILED: 'failed', CANCELLED: 'failed', REVERSED: 'failed',
    }

    // Deduplicate by id, merge, sort, paginate
    const txnMap = new Map<string, typeof sent[0]>()
    for (const t of [...sent, ...received]) {
      if (!txnMap.has(t.id)) txnMap.set(t.id, t)
    }

    const all = Array.from(txnMap.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    const total = all.length
    const paginated = all.slice((page - 1) * limit, page * limit)

    return successResponse({
      transactions: paginated.map((t) => ({
        id: t.id,
        userId: user.id,
        type: TXN_TYPE_MAP[t.txnType] || 'payment',
        amount: Number(t.amount) / 100,
        description: t.description || '',
        reference: t.referenceId,
        createdAt: t.createdAt.toISOString(),
        status: TXN_STATUS_MAP[t.status] || 'pending',
      })),
      total,
      page,
      pageSize: limit,
      hasMore: page * limit < total,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
