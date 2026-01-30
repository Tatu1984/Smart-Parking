import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { nanoid } from 'nanoid'
import { logger } from '@/lib/logger'

// Sandbox bank data for testing
const SANDBOX_BANKS = [
  { ifscPrefix: 'SBIN', name: 'State Bank of India (Sandbox)' },
  { ifscPrefix: 'HDFC', name: 'HDFC Bank (Sandbox)' },
  { ifscPrefix: 'ICIC', name: 'ICICI Bank (Sandbox)' },
  { ifscPrefix: 'AXIS', name: 'Axis Bank (Sandbox)' },
  { ifscPrefix: 'KKBK', name: 'Kotak Mahindra Bank (Sandbox)' },
]

// GET /api/bank-accounts - Get user's linked bank accounts
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const walletId = searchParams.get('walletId')

    // Get user's wallets first
    const wallets = await prisma.wallet.findMany({
      where: { userId: user.id },
      select: { id: true },
    })

    const walletIds = wallets.map((w) => w.id)

    const where: any = {
      walletId: { in: walletIds },
    }

    if (walletId && walletIds.includes(walletId)) {
      where.walletId = walletId
    }

    const bankAccounts = await prisma.bankAccount.findMany({
      where,
      include: {
        wallet: {
          select: { id: true, walletType: true, currency: true },
        },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    })

    const formattedAccounts = bankAccounts.map((acc) => ({
      ...acc,
      sandboxBalance: acc.sandboxBalance ? Number(acc.sandboxBalance) : null,
      // Mask account number for security
      accountNumber: acc.isSandbox ? acc.accountNumber : undefined,
    }))

    return NextResponse.json({ success: true, data: formattedAccounts })
  } catch (error) {
    logger.error('Error fetching bank accounts:', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bank accounts' },
      { status: 500 }
    )
  }
}

// POST /api/bank-accounts - Link a new bank account
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      walletId,
      accountHolderName,
      bankName,
      accountNumber,
      ifscCode,
      accountType = 'SAVINGS',
      isSandbox = false,
    } = body

    // Validate required fields
    if (!walletId || !accountHolderName || !accountNumber || !ifscCode) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify wallet ownership
    const wallet = await prisma.wallet.findFirst({
      where: {
        id: walletId,
        userId: user.id,
      },
      include: { sandboxConfig: true },
    })

    if (!wallet) {
      return NextResponse.json({ success: false, error: 'Wallet not found' }, { status: 404 })
    }

    // Check if account already linked
    const existingAccount = await prisma.bankAccount.findFirst({
      where: {
        walletId,
        accountNumber,
        ifscCode,
      },
    })

    if (existingAccount) {
      return NextResponse.json(
        { success: false, error: 'Bank account already linked' },
        { status: 400 }
      )
    }

    // Check if this is the first bank account (make it primary)
    const existingAccounts = await prisma.bankAccount.count({
      where: { walletId },
    })

    // Determine bank name from IFSC for sandbox
    let resolvedBankName = bankName
    if (isSandbox && !bankName) {
      const ifscPrefix = ifscCode.substring(0, 4)
      const sandboxBank = SANDBOX_BANKS.find((b) => b.ifscPrefix === ifscPrefix)
      resolvedBankName = sandboxBank?.name || 'Sandbox Bank'
    }

    // Create bank account
    const bankAccount = await prisma.bankAccount.create({
      data: {
        walletId,
        accountHolderName,
        bankName: resolvedBankName,
        accountNumber,
        accountNumberLast4: accountNumber.slice(-4),
        ifscCode: ifscCode.toUpperCase(),
        accountType,
        isSandbox,
        isPrimary: existingAccounts === 0,
        status: isSandbox ? 'VERIFIED' : 'PENDING',
        sandboxBalance: isSandbox ? BigInt(10000000000) : null, // 1 crore for sandbox
        pennyDropRef: isSandbox ? `SANDBOX_${nanoid(10)}` : null,
        pennyDropStatus: isSandbox ? 'SUCCESS' : 'PENDING',
      },
    })

    // If not sandbox, initiate penny drop verification (mock for now)
    if (!isSandbox) {
      // In production, this would call actual bank verification API
      await prisma.bankAccount.update({
        where: { id: bankAccount.id },
        data: {
          pennyDropRef: `PD_${nanoid(12)}`,
          pennyDropStatus: 'INITIATED',
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        ...bankAccount,
        sandboxBalance: bankAccount.sandboxBalance ? Number(bankAccount.sandboxBalance) : null,
        message: isSandbox
          ? 'Sandbox bank account linked and verified'
          : 'Bank account added. Penny drop verification initiated.',
      },
    })
  } catch (error) {
    logger.error('Error linking bank account:', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { success: false, error: 'Failed to link bank account' },
      { status: 500 }
    )
  }
}
