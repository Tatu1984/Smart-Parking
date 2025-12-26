import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'

// GET /api/bank-accounts/[id] - Get bank account details
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

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id },
      include: {
        wallet: {
          select: { id: true, userId: true, walletType: true },
        },
      },
    })

    if (!bankAccount || bankAccount.wallet.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Bank account not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        ...bankAccount,
        sandboxBalance: bankAccount.sandboxBalance ? Number(bankAccount.sandboxBalance) : null,
      },
    })
  } catch (error) {
    console.error('Error fetching bank account:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bank account' },
      { status: 500 }
    )
  }
}

// PATCH /api/bank-accounts/[id] - Update bank account (set primary, etc.)
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
    const { isPrimary } = body

    // Verify ownership
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id },
      include: {
        wallet: {
          select: { id: true, userId: true },
        },
      },
    })

    if (!bankAccount || bankAccount.wallet.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Bank account not found' }, { status: 404 })
    }

    // If setting as primary, unset other primary accounts
    if (isPrimary) {
      await prisma.bankAccount.updateMany({
        where: {
          walletId: bankAccount.walletId,
          id: { not: id },
        },
        data: { isPrimary: false },
      })
    }

    const updatedAccount = await prisma.bankAccount.update({
      where: { id },
      data: { isPrimary },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...updatedAccount,
        sandboxBalance: updatedAccount.sandboxBalance ? Number(updatedAccount.sandboxBalance) : null,
      },
    })
  } catch (error) {
    console.error('Error updating bank account:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update bank account' },
      { status: 500 }
    )
  }
}

// DELETE /api/bank-accounts/[id] - Remove bank account
export async function DELETE(
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
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id },
      include: {
        wallet: {
          select: { id: true, userId: true },
        },
      },
    })

    if (!bankAccount || bankAccount.wallet.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Bank account not found' }, { status: 404 })
    }

    // Check if there are pending transactions
    const pendingTxns = await prisma.walletTransaction.count({
      where: {
        bankAccountId: id,
        status: 'PENDING',
      },
    })

    if (pendingTxns > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot remove bank account with pending transactions' },
        { status: 400 }
      )
    }

    await prisma.bankAccount.delete({
      where: { id },
    })

    // If this was primary, set another account as primary
    if (bankAccount.isPrimary) {
      const nextAccount = await prisma.bankAccount.findFirst({
        where: { walletId: bankAccount.walletId },
        orderBy: { createdAt: 'asc' },
      })

      if (nextAccount) {
        await prisma.bankAccount.update({
          where: { id: nextAccount.id },
          data: { isPrimary: true },
        })
      }
    }

    return NextResponse.json({ success: true, message: 'Bank account removed' })
  } catch (error) {
    console.error('Error removing bank account:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove bank account' },
      { status: 500 }
    )
  }
}
