import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { logger } from '@/lib/logger'

// GET /api/wallet/[id] - Get wallet details
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
        OR: [
          { userId: user.id },
          // Admins can view any wallet
          ...(user.role === 'ADMIN' ? [{}] : []),
        ],
      },
      include: {
        bankAccounts: true,
        sandboxConfig: true,
        sentTransactions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            receiverWallet: {
              select: { id: true, walletType: true },
            },
          },
        },
        receivedTransactions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            senderWallet: {
              select: { id: true, walletType: true },
            },
          },
        },
      },
    })

    if (!wallet) {
      return NextResponse.json({ success: false, error: 'Wallet not found' }, { status: 404 })
    }

    // Format BigInt values
    const formattedWallet = {
      ...wallet,
      balance: Number(wallet.balance),
      dailyLimit: Number(wallet.dailyLimit),
      monthlyLimit: Number(wallet.monthlyLimit),
      singleTxnLimit: Number(wallet.singleTxnLimit),
      bankAccounts: wallet.bankAccounts.map((acc) => ({
        ...acc,
        sandboxBalance: acc.sandboxBalance ? Number(acc.sandboxBalance) : null,
      })),
      sentTransactions: wallet.sentTransactions.map((txn) => ({
        ...txn,
        amount: Number(txn.amount),
        fee: Number(txn.fee),
        balanceAfter: txn.balanceAfter ? Number(txn.balanceAfter) : null,
      })),
      receivedTransactions: wallet.receivedTransactions.map((txn) => ({
        ...txn,
        amount: Number(txn.amount),
        fee: Number(txn.fee),
        balanceAfter: txn.balanceAfter ? Number(txn.balanceAfter) : null,
      })),
    }

    return NextResponse.json({ success: true, data: formattedWallet })
  } catch (error) {
    logger.error('Error fetching wallet:', error instanceof Error ? error : undefined)
    return NextResponse.json({ success: false, error: 'Failed to fetch wallet' }, { status: 500 })
  }
}

// PATCH /api/wallet/[id] - Update wallet settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { dailyLimit, monthlyLimit, singleTxnLimit } = body

    // Verify ownership
    const wallet = await prisma.wallet.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!wallet) {
      return NextResponse.json({ success: false, error: 'Wallet not found' }, { status: 404 })
    }

    // Update wallet limits
    const updatedWallet = await prisma.wallet.update({
      where: { id },
      data: {
        ...(dailyLimit !== undefined && { dailyLimit: BigInt(dailyLimit) }),
        ...(monthlyLimit !== undefined && { monthlyLimit: BigInt(monthlyLimit) }),
        ...(singleTxnLimit !== undefined && { singleTxnLimit: BigInt(singleTxnLimit) }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...updatedWallet,
        balance: Number(updatedWallet.balance),
        dailyLimit: Number(updatedWallet.dailyLimit),
        monthlyLimit: Number(updatedWallet.monthlyLimit),
        singleTxnLimit: Number(updatedWallet.singleTxnLimit),
      },
    })
  } catch (error) {
    logger.error('Error updating wallet:', error instanceof Error ? error : undefined)
    return NextResponse.json({ success: false, error: 'Failed to update wallet' }, { status: 500 })
  }
}
