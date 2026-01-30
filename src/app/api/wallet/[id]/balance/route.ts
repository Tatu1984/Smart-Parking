import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { logger } from '@/lib/logger'

// GET /api/wallet/[id]/balance - Get wallet balance
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

    const wallet = await prisma.wallet.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
        balance: true,
        currency: true,
        status: true,
        dailyLimit: true,
        monthlyLimit: true,
        singleTxnLimit: true,
      },
    })

    if (!wallet) {
      return NextResponse.json({ success: false, error: 'Wallet not found' }, { status: 404 })
    }

    // Calculate used limits today and this month
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    const [dailyUsage, monthlyUsage] = await Promise.all([
      prisma.walletTransaction.aggregate({
        where: {
          senderWalletId: id,
          createdAt: { gte: today },
          status: { in: ['COMPLETED', 'PENDING'] },
        },
        _sum: { amount: true },
      }),
      prisma.walletTransaction.aggregate({
        where: {
          senderWalletId: id,
          createdAt: { gte: monthStart },
          status: { in: ['COMPLETED', 'PENDING'] },
        },
        _sum: { amount: true },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        id: wallet.id,
        balance: Number(wallet.balance),
        currency: wallet.currency,
        status: wallet.status,
        limits: {
          daily: {
            limit: Number(wallet.dailyLimit),
            used: Number(dailyUsage._sum.amount || 0),
            remaining: Number(wallet.dailyLimit) - Number(dailyUsage._sum.amount || 0),
          },
          monthly: {
            limit: Number(wallet.monthlyLimit),
            used: Number(monthlyUsage._sum.amount || 0),
            remaining: Number(wallet.monthlyLimit) - Number(monthlyUsage._sum.amount || 0),
          },
          singleTransaction: Number(wallet.singleTxnLimit),
        },
      },
    })
  } catch (error) {
    logger.error('Error fetching balance:', error instanceof Error ? error : undefined)
    return NextResponse.json({ success: false, error: 'Failed to fetch balance' }, { status: 500 })
  }
}
