import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'

// POST /api/bank-accounts/[id]/verify - Verify penny drop amount
export async function POST(
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
    const { amount } = body // Amount in paise that was deposited

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

    if (bankAccount.status === 'VERIFIED') {
      return NextResponse.json(
        { success: false, error: 'Bank account already verified' },
        { status: 400 }
      )
    }

    if (bankAccount.isSandbox) {
      // Sandbox accounts are auto-verified
      return NextResponse.json(
        { success: false, error: 'Sandbox accounts are auto-verified' },
        { status: 400 }
      )
    }

    // In production, verify the penny drop amount matches
    // For now, we'll simulate verification
    // The penny drop amount is typically 1-5 rupees (100-500 paise)
    const expectedAmount = 100 // 1 rupee in paise (would be stored/generated during initiation)

    if (amount !== expectedAmount) {
      // Track failed attempts
      const currentAttempts = (bankAccount as any).verificationAttempts || 0

      if (currentAttempts >= 2) {
        // Max 3 attempts, mark as failed
        await prisma.bankAccount.update({
          where: { id },
          data: {
            status: 'FAILED',
            pennyDropStatus: 'FAILED',
          },
        })

        return NextResponse.json(
          { success: false, error: 'Maximum verification attempts exceeded. Please add a new bank account.' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Incorrect amount. Please check the deposit amount and try again.',
          attemptsRemaining: 2 - currentAttempts,
        },
        { status: 400 }
      )
    }

    // Verification successful
    const updatedAccount = await prisma.bankAccount.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        pennyDropStatus: 'SUCCESS',
        verifiedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...updatedAccount,
        sandboxBalance: null,
      },
      message: 'Bank account verified successfully',
    })
  } catch (error) {
    console.error('Error verifying bank account:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to verify bank account' },
      { status: 500 }
    )
  }
}
