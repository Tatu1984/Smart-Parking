import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { logger } from '@/lib/logger'

// GET /api/wallet/[id]/transactions - Get wallet transaction history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const wallet = await prisma.wallet.findFirst({
      where: {
        id,
        OR: [{ userId: user.id }, ...(user.role === 'ADMIN' ? [{}] : [])],
      },
    })

    if (!wallet) {
      return NextResponse.json({ success: false, error: 'Wallet not found' }, { status: 404 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const type = searchParams.get('type') // DEPOSIT, WITHDRAWAL, TRANSFER, etc.
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const skip = (page - 1) * limit

    const where: any = {
      OR: [{ senderWalletId: id }, { receiverWalletId: id }],
    }

    if (type) {
      where.txnType = type
    }
    if (status) {
      where.status = status
    }
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        include: {
          senderWallet: {
            select: { id: true, walletType: true, userId: true },
          },
          receiverWallet: {
            select: { id: true, walletType: true, userId: true },
          },
          withdrawalBank: {
            select: { id: true, bankName: true, accountNumberLast4: true },
          },
          depositBank: {
            select: { id: true, bankName: true, accountNumberLast4: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.walletTransaction.count({ where }),
    ])

    // Format transactions with direction indicator
    const formattedTransactions = transactions.map((txn) => {
      const isOutgoing = txn.senderWalletId === id
      return {
        ...txn,
        amount: Number(txn.amount),
        fee: Number(txn.fee),
        balanceAfter: txn.balanceAfter ? Number(txn.balanceAfter) : null,
        direction: isOutgoing ? 'OUT' : 'IN',
        displayAmount: isOutgoing ? -Number(txn.amount) : Number(txn.amount),
      }
    })

    return NextResponse.json({
      success: true,
      data: formattedTransactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    logger.error('Error fetching transactions:', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}
