import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { logger } from '@/lib/logger'

// GET /api/wallet - Get current user's wallet(s)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const wallets = await prisma.wallet.findMany({
      where: { userId: user.id },
      include: {
        bankAccounts: {
          select: {
            id: true,
            bankName: true,
            accountNumberLast4: true,
            accountType: true,
            status: true,
            isPrimary: true,
            isSandbox: true,
          },
        },
        sandboxConfig: true,
        _count: {
          select: {
            sentTransactions: true,
            receivedTransactions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Format balances from BigInt to number (in paise/cents)
    const formattedWallets = wallets.map((wallet) => ({
      ...wallet,
      balance: Number(wallet.balance),
      dailyLimit: Number(wallet.dailyLimit),
      monthlyLimit: Number(wallet.monthlyLimit),
      singleTxnLimit: Number(wallet.singleTxnLimit),
    }))

    return NextResponse.json({ success: true, data: formattedWallets })
  } catch (error) {
    logger.error('Error fetching wallets:', error instanceof Error ? error : undefined)
    return NextResponse.json({ success: false, error: 'Failed to fetch wallets' }, { status: 500 })
  }
}

// POST /api/wallet - Create a new wallet
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { walletType = 'PERSONAL', currency = 'INR', isSandbox = false } = body

    // Check if user already has a wallet of this type
    const existingWallet = await prisma.wallet.findFirst({
      where: {
        userId: user.id,
        walletType,
      },
    })

    if (existingWallet) {
      return NextResponse.json(
        { success: false, error: `You already have a ${walletType} wallet` },
        { status: 400 }
      )
    }

    // Create wallet with sandbox config if requested
    const wallet = await prisma.wallet.create({
      data: {
        userId: user.id,
        walletType,
        currency,
        balance: isSandbox ? BigInt(10000000) : BigInt(0), // 100,000 in paise for sandbox
        kycLevel: 'BASIC',
        status: 'ACTIVE',
        sandboxConfig: isSandbox
          ? {
              create: {
                autoApproveDeposits: true,
                autoApproveWithdrawals: true,
                simulateFailures: false,
                testBankBalance: BigInt(10000000000), // 1 crore in paise
              },
            }
          : undefined,
      },
      include: {
        sandboxConfig: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...wallet,
        balance: Number(wallet.balance),
        dailyLimit: Number(wallet.dailyLimit),
        monthlyLimit: Number(wallet.monthlyLimit),
        singleTxnLimit: Number(wallet.singleTxnLimit),
      },
    })
  } catch (error) {
    logger.error('Error creating wallet:', error instanceof Error ? error : undefined)
    return NextResponse.json({ success: false, error: 'Failed to create wallet' }, { status: 500 })
  }
}
